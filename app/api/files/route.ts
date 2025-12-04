import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { put } from '@vercel/blob'
import { encryptFile } from "@/lib/crypto"
import { emitSocketEvent } from "@/lib/socket"

export async function GET() {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const files = await prisma.file.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(files)
  } catch (error) {
    console.error('GET /api/files error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const formData = await request.formData()
    const file = formData.get('file') as File
    const encrypt = formData.get('encrypt') === 'true'
    const encryptionKey = formData.get('encryptionKey') as string
    const type = formData.get('type') as string
    const recipients = JSON.parse(formData.get('recipients') as string || '[]')
    const shareMode = formData.get('shareMode') as string

    console.log('Parsed recipients:', recipients)
    console.log('Share mode:', shareMode)

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check file size limit (100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 100MB limit" }, { status: 400 })
    }

    console.log('Starting file processing...')
    let fileData = await file.arrayBuffer()
    console.log('File data loaded, size:', fileData.byteLength)
    let finalFileName = file.name
    let finalEncryptionKey = encryptionKey || ""

    // Encrypt file if requested
    if (encrypt && finalEncryptionKey) {
      try {
        console.log('Starting encryption...')
        const encrypted = encryptFile(fileData, finalEncryptionKey)
        console.log('Encryption completed, encrypted string length:', encrypted.length)
        fileData = new TextEncoder().encode(encrypted).buffer
        finalFileName = `${file.name}.encrypted`
        console.log('Final encrypted buffer size:', fileData.byteLength)
      } catch (error) {
        console.error('Encryption error:', error)
        return NextResponse.json({ error: "Encryption failed" }, { status: 500 })
      }
    } else {
      console.log('No encryption applied')
    }

    console.log('Starting Vercel Blob upload...')
    // Upload to Vercel Blob
    const blob = await put(finalFileName, fileData, {
      access: 'public',
      contentType: encrypt ? 'application/octet-stream' : file.type || 'application/octet-stream'
    })
    console.log('Blob upload successful, URL:', blob.url)

    console.log('Saving to database...')
    let newFile
    try {
      // Save to database
      newFile = await prisma.file.create({
        data: {
          name: file.name,
          originalName: file.name,
          size: file.size,
          type: file.type,
          url: blob.url,
          encrypted: encrypt,
          encryptionKey: encrypt ? finalEncryptionKey : null,
          fileType: type,
          userId: session.user.id
        }
      })
      console.log('Database save successful, file ID:', newFile.id)
    } catch (dbError) {
      console.error('Database save failed:', dbError)
      // Clean up blob if database save fails
      // Note: Vercel Blob doesn't have a delete API easily accessible
      throw new Error('Failed to save file to database')
    }

    // Handle sharing if recipients are provided
    if (shareMode === 'share' && recipients.length > 0) {
      console.log('Creating file shares for recipients:', recipients)
      const shareResults = []
      for (const email of recipients) {
        // Normalize email to lowercase for consistency
        const normalizedEmail = email.trim().toLowerCase()
        console.log('Processing recipient:', email, '-> normalized:', normalizedEmail)

        try {
          // Create share record
          const share = await prisma.fileShare.create({
            data: {
              fileId: newFile.id,
              sharedWithEmail: normalizedEmail,
              permissions: 'view', // Default permission
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            }
          })
          console.log('Successfully created file share for', normalizedEmail, ':', share.id)

          // Emit real-time notification for file sharing
          emitSocketEvent('file-shared', {
            fileId: newFile.id,
            fileName: newFile.name,
            senderEmail: session.user.email,
            receiverEmail: normalizedEmail,
            sharedAt: share.createdAt.toISOString(),
          })

          shareResults.push({ email: normalizedEmail, success: true, share })
        } catch (shareError) {
          console.error('Error creating file share for', email, '(', normalizedEmail, '):', shareError)
          shareResults.push({ email: normalizedEmail, success: false, error: shareError })
        }
      }

      // Log share results
      const successfulShares = shareResults.filter(r => r.success).length
      const failedShares = shareResults.filter(r => !r.success).length
      console.log(`File shares: ${successfulShares} successful, ${failedShares} failed`)

      // Debug: Verify shares were created
      const verifyShares = await prisma.fileShare.findMany({
        where: { fileId: newFile.id }
      })
      console.log('Verification: Found', verifyShares.length, 'shares for file', newFile.id)
    }

    return NextResponse.json({
      ...newFile,
      blobUrl: blob.url,
      success: true,
      message: shareMode === 'share' ? 'File uploaded and shared successfully' : 'File uploaded successfully'
    })

  } catch (error) {
    console.error('POST /api/files error:', error)
    return NextResponse.json({
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}