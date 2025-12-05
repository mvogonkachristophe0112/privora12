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

    console.log('=== UPLOAD REQUEST START ===')
    console.log('File provided:', !!file)
    console.log('File name:', file?.name)
    console.log('File size:', file?.size)
    console.log('Parsed recipients:', recipients)
    console.log('Recipients length:', recipients.length)
    console.log('Share mode:', shareMode)
    console.log('Encrypt:', encrypt)
    console.log('Encryption key provided:', !!encryptionKey)

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check file size limit (500MB)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit` }, { status: 400 })
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
      console.log('=== SHARING LOGIC START ===')
      console.log('Share mode is "share" and recipients provided:', recipients.length, 'recipients')
      const shareResults = []

      for (const email of recipients) {
        console.log('--- Processing recipient:', email, '---')
        // Normalize email to lowercase for consistency
        const normalizedEmail = email.trim().toLowerCase()
        console.log('Original email:', email, '-> Normalized:', normalizedEmail)

        // Validate that recipient exists as a user
        console.log('Checking if user exists in database...')
        const recipientUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, name: true }
        })

        console.log('Database query result:', recipientUser ? 'USER FOUND' : 'USER NOT FOUND')
        if (recipientUser) {
          console.log('User details:', { id: recipientUser.id, email: recipientUser.email, name: recipientUser.name })
        }

        if (!recipientUser) {
          console.error('❌ RECIPIENT VALIDATION FAILED: User not found for email:', normalizedEmail)
          shareResults.push({
            email: normalizedEmail,
            success: false,
            error: 'User not found'
          })
          continue
        }

        console.log('✅ Recipient validation passed for:', normalizedEmail)

        console.log('Found recipient user:', recipientUser.id, recipientUser.email)

        try {
          // Generate unique share token
          const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

          // Create share record with sender information
          const share = await prisma.fileShare.create({
            data: {
              fileId: newFile.id,
              userId: session.user.id, // Sender ID
              sharedWithEmail: normalizedEmail, // Receiver email
              permissions: 'view', // Default permission
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            }
          })

          console.log('Successfully created file share:', {
            shareId: share.id,
            fileId: newFile.id,
            senderId: session.user.id,
            receiverEmail: normalizedEmail,
            receiverUserId: recipientUser.id
          })

          shareResults.push({
            email: normalizedEmail,
            success: true,
            share,
            recipientUser
          })

        } catch (shareError) {
          console.error('Error creating file share for', normalizedEmail, ':', shareError)
          shareResults.push({
            email: normalizedEmail,
            success: false,
            error: shareError
          })
        }
      }

      // Log share results
      const successfulShares = shareResults.filter(r => r.success).length
      const failedShares = shareResults.filter(r => !r.success).length
      console.log(`=== SHARING RESULTS ===`)
      console.log(`Total recipients processed: ${recipients.length}`)
      console.log(`Successful shares: ${successfulShares}`)
      console.log(`Failed shares: ${failedShares}`)

      if (failedShares > 0) {
        console.log('Failed share details:')
        shareResults.filter(r => !r.success).forEach(result => {
          console.log(`  - ${result.email}: ${result.error}`)
        })
      }

      console.log('=== SHARING LOGIC END ===')

      // Emit real-time notifications for successful shares
      const successfulShareResults = shareResults.filter(r => r.success)
      for (const result of successfulShareResults) {
        emitSocketEvent('file-shared', {
          fileId: newFile.id,
          fileName: newFile.name,
          senderEmail: session.user.email,
          senderId: session.user.id,
          receiverEmail: result.email,
          receiverId: result.recipientUser.id,
          sharedAt: new Date().toISOString(),
        })
      }
    }

    const responseMessage = shareMode === 'share' ? 'File uploaded and shared successfully' : 'File uploaded successfully'
    console.log('=== UPLOAD RESPONSE ===')
    console.log('File ID:', newFile.id)
    console.log('File name:', newFile.name)
    console.log('Share mode:', shareMode)
    console.log('Response message:', responseMessage)
    console.log('=== UPLOAD REQUEST END ===\n')

    return NextResponse.json({
      ...newFile,
      blobUrl: blob.url,
      success: true,
      message: responseMessage
    })

  } catch (error) {
    console.error('POST /api/files error:', error)
    return NextResponse.json({
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}