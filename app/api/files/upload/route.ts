import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth'
import { getPrismaClient } from '@/lib/prisma'
import { encryptFile } from '@/lib/crypto'
import { emitSocketEvent } from '@/lib/socket'
import { logAuditEvent, AuditAction, AuditSeverity } from '@/lib/audit'
import { PathSanitizer, ContentSecurity } from '@/lib/security'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const ALLOWED_MIME_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/*',
  'application/zip',
  'application/x-rar-compressed'
]

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
      }, { status: 400 })
    }

    // Validate file type
    const isAllowedType = ALLOWED_MIME_TYPES.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type
    })

    if (!isAllowedType) {
      return NextResponse.json({
        error: 'File type not allowed'
      }, { status: 400 })
    }

    // Additional security validation
    await ContentSecurity.validateFileUpload(file, ALLOWED_MIME_TYPES, MAX_FILE_SIZE)

    const encrypt = formData.get('encrypt') === 'true'
    const encryptionKey = formData.get('encryptionKey') as string
    const recipients = JSON.parse(formData.get('recipients') as string || '[]')
    const permissions = JSON.parse(formData.get('permissions') as string || '["VIEW"]')

    console.log('Starting secure file upload for:', file.name, 'Size:', file.size)

    // Process file data
    let fileData: ArrayBuffer
    let finalFileName = file.name

    try {
      fileData = await file.arrayBuffer()
    } catch (error) {
      console.error('Failed to read file data:', error)
      return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
    }

    // Encrypt if requested
    if (encrypt && encryptionKey) {
      try {
        console.log('Encrypting file...')
        const encrypted = encryptFile(fileData, encryptionKey)
        fileData = new TextEncoder().encode(encrypted).buffer
        finalFileName = `${file.name}.encrypted`
        console.log('Encryption completed')
      } catch (error) {
        console.error('Encryption failed:', error)
        return NextResponse.json({ error: 'Encryption failed' }, { status: 500 })
      }
    }

    // Generate secure filename and path
    const uniqueId = crypto.randomUUID()
    const sanitizedFileName = PathSanitizer.sanitizeFilename(finalFileName)
    const secureFileName = PathSanitizer.generateSecureFilename(sanitizedFileName, 'upload')
    const uploadDir = path.resolve(process.cwd(), 'storage', 'uploads')

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 })

    // Write file securely
    const filePath = path.join(uploadDir, secureFileName)
    const sanitizedFilePath = PathSanitizer.sanitizeFilePath(filePath, uploadDir)

    try {
      await fs.writeFile(sanitizedFilePath, Buffer.from(fileData))
      console.log('File written successfully to:', sanitizedFilePath)
    } catch (error) {
      console.error('Failed to write file:', error)
      return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
    }

    // Create local URL for access
    const localUrl = `/api/files/download/local/${secureFileName}`

    // Save to database
    const newFile = await prisma.file.create({
      data: {
        name: file.name,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: localUrl,
        encrypted: encrypt,
        encryptionKey: encrypt ? encryptionKey : null,
        userId: session.user.id
      }
    })

    console.log('Database record created:', newFile.id)

    // Handle sharing if recipients provided
    let shareResults = []
    if (recipients.length > 0) {
      for (const email of recipients) {
        try {
          const recipientUser = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() }
          })

          if (recipientUser) {
            const share = await prisma.fileShare.create({
              data: {
                fileId: newFile.id,
                userId: recipientUser.id,
                sharedWithEmail: email.trim().toLowerCase(),
                permissions,
                createdBy: session.user.id
              }
            })

            shareResults.push({ email, success: true, shareId: share.id })

            // Emit real-time notification
            emitSocketEvent('file-shared', {
              shareId: share.id,
              fileId: newFile.id,
              fileName: newFile.name,
              senderEmail: session.user.email,
              receiverEmail: email,
              permissions
            })
          } else {
            shareResults.push({ email, success: false, error: 'User not found' })
          }
        } catch (error) {
          console.error('Failed to share with:', email, error)
          shareResults.push({ email, success: false, error: 'Share failed' })
        }
      }
    }

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.FILE_UPLOAD,
      resource: 'file',
      resourceId: newFile.id,
      details: {
        fileName: newFile.name,
        fileSize: newFile.size,
        encrypted: encrypt,
        recipientsCount: recipients.length,
        successfulShares: shareResults.filter(r => r.success).length
      },
      severity: AuditSeverity.LOW
    })

    return NextResponse.json({
      success: true,
      file: newFile,
      localUrl,
      sharingResults: shareResults
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}