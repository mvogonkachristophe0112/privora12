import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { put } from '@vercel/blob'
import { encryptFile } from "@/lib/crypto"
import { triggerPusherEvent } from "@/lib/pusher"

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

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check file size limit (100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 100MB limit" }, { status: 400 })
    }

    let fileData = await file.arrayBuffer()
    let finalFileName = file.name
    let finalEncryptionKey = encryptionKey || ""

    // Encrypt file if requested
    if (encrypt && finalEncryptionKey) {
      try {
        const encrypted = encryptFile(fileData, finalEncryptionKey)
        fileData = new TextEncoder().encode(encrypted).buffer
        finalFileName = `${file.name}.encrypted`
      } catch (error) {
        console.error('Encryption error:', error)
        return NextResponse.json({ error: "Encryption failed" }, { status: 500 })
      }
    }

    // Upload to Vercel Blob
    const blob = await put(finalFileName, fileData, {
      access: 'public',
      contentType: encrypt ? 'application/octet-stream' : file.type || 'application/octet-stream'
    })

    // Save to database
    const newFile = await prisma.file.create({
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

    // Handle sharing if recipients are provided
    if (shareMode === 'share' && recipients.length > 0) {
      for (const email of recipients) {
        // Create share record
        await prisma.fileShare.create({
          data: {
            fileId: newFile.id,
            sharedWithEmail: email,
            permissions: 'view', // Default permission
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          }
        })

        // Trigger Pusher event for file sharing notification
        await triggerPusherEvent(`user-${email}`, 'file-shared', {
          fileId: newFile.id,
          fileName: newFile.name,
          sharedBy: session.user.email,
          sharedAt: new Date(),
          url: newFile.url,
          encrypted: newFile.encrypted
        })
      }
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