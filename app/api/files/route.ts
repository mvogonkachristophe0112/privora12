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

    let prisma
    try {
      prisma = await getPrismaClient()
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      return NextResponse.json({
        error: "Database connection failed",
        details: "Unable to connect to database. Please try again later."
      }, { status: 503 })
    }

    let formData
    try {
      formData = await request.formData()
    } catch (formError) {
      console.error('Failed to parse form data:', formError)
      return NextResponse.json({
        error: "Invalid form data",
        details: "Unable to process the uploaded file data."
      }, { status: 400 })
    }

    const file = formData.get('file') as File
    const encrypt = formData.get('encrypt') === 'true'
    const encryptionKey = formData.get('encryptionKey') as string
    const type = formData.get('type') as string

    let recipients = []
    try {
      const recipientsStr = formData.get('recipients') as string || '[]'
      recipients = JSON.parse(recipientsStr)
    } catch (parseError) {
      console.error('Failed to parse recipients:', parseError)
      return NextResponse.json({
        error: "Invalid recipients format",
        details: "Recipients must be a valid JSON array of email addresses."
      }, { status: 400 })
    }

    const shareMode = formData.get('shareMode') as string

    console.log('=== UPLOAD REQUEST START ===')
    console.log('File provided:', !!file)
    console.log('File name:', file?.name)
    console.log('File size:', file?.size)
    console.log('Raw recipients from form:', formData.get('recipients'))
    console.log('Parsed recipients:', recipients)
    console.log('Recipients length:', recipients.length)
    console.log('Share mode:', shareMode)
    console.log('Encrypt:', encrypt)
    console.log('Encryption key provided:', !!encryptionKey)
    console.log('Session user email:', session.user.email)
    console.log('Session user id:', session.user.id)

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
    const maxRetries = 3
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Database save attempt ${attempt}/${maxRetries}`)
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
        console.log('✅ Database save successful, file ID:', newFile.id)
        break // Success, exit retry loop
      } catch (dbError) {
        console.error(`❌ Database save attempt ${attempt} failed:`, dbError)
        lastError = dbError

        if (attempt === maxRetries) {
          console.error('❌ All database save attempts failed')
          // Note: Vercel Blob doesn't have a delete API easily accessible
          return NextResponse.json({
            error: "Failed to save file to database",
            details: "Database operation failed after multiple attempts. Please try again."
          }, { status: 500 })
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }

    // Initialize sharing results
    let shareResults: any[] = []

    // Handle sharing if recipients are provided
    if (shareMode === 'share' && recipients.length > 0) {
      console.log('=== SHARING LOGIC START ===')
      console.log('Share mode is "share" and recipients provided:', recipients.length, 'recipients')

      // Validate recipients array
      if (!Array.isArray(recipients)) {
        console.error('❌ Recipients is not an array:', recipients)
        return NextResponse.json({
          error: "Invalid recipients format",
          details: "Recipients must be an array of email addresses"
        }, { status: 400 })
      }
      const validRecipients = []
      const invalidRecipients = []

      // Pre-validate all recipients
      for (const email of recipients) {
        if (!email || typeof email !== 'string') {
          console.warn('⚠️ Invalid recipient format:', email)
          invalidRecipients.push({ email, reason: 'Invalid format' })
          continue
        }

        const normalizedEmail = email.trim().toLowerCase()

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(normalizedEmail)) {
          console.warn('⚠️ Invalid email format:', email)
          invalidRecipients.push({ email, reason: 'Invalid email format' })
          continue
        }

        validRecipients.push({ original: email, normalized: normalizedEmail })
      }

      console.log(`📊 Pre-validation results: ${validRecipients.length} valid, ${invalidRecipients.length} invalid`)

      // Debug: Check all users in database
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
      })
      console.log('All users in database:', allUsers.length)
      allUsers.forEach(user => {
        console.log(`  User: ${user.email} (ID: ${user.id})`)
      })

      // Process valid recipients
      for (const recipient of validRecipients) {
        console.log('--- Processing recipient:', recipient.original, 'normalized:', recipient.normalized, '---')

        try {
          // Check if user exists in database
          console.log('Checking if user exists in database...')
          const recipientUser = await prisma.user.findUnique({
            where: { email: recipient.normalized },
            select: { id: true, email: true, name: true }
          })

          if (!recipientUser) {
            console.warn('⚠️ RECIPIENT NOT FOUND:', recipient.normalized)
            shareResults.push({
              email: recipient.original,
              success: false,
              error: 'User not registered in the system'
            })
            continue
          }

          console.log('✅ User found:', recipientUser.email, '(ID:', recipientUser.id + ')')

          try {
            // Create share record with sender information
            const share = await prisma.fileShare.create({
              data: {
                fileId: newFile.id,
                userId: session.user.id, // Sender ID
                sharedWithEmail: recipient.normalized, // Receiver email
                permissions: 'view', // Default permission
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              }
            })

            console.log('✅ Successfully created file share:', {
              shareId: share.id,
              fileId: newFile.id,
              senderId: session.user.id,
              receiverEmail: recipient.normalized,
              receiverUserId: recipientUser.id
            })

            shareResults.push({
              email: recipient.original,
              success: true,
              share,
              recipientUser
            })

          } catch (shareError) {
            console.error('❌ Error creating file share for', recipient.original, ':', shareError)
            shareResults.push({
              email: recipient.original,
              success: false,
              error: `Database error: ${shareError instanceof Error ? shareError.message : 'Unknown error'}`
            })
          }
        } catch (validationError) {
          console.error('❌ Error validating recipient', recipient.original, ':', validationError)
          shareResults.push({
            email: recipient.original,
            success: false,
            error: 'Validation failed'
          })
        }
      }

      // Handle invalid recipients
      invalidRecipients.forEach(invalid => {
        shareResults.push({
          email: invalid.email,
          success: false,
          error: invalid.reason
        })
      })

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

    // Prepare response with detailed sharing results
    const successfulShares = shareResults?.filter(r => r.success).length || 0
    const failedShares = shareResults?.filter(r => !r.success).length || 0

    let responseMessage = 'File uploaded successfully'
    if (shareMode === 'share') {
      if (successfulShares > 0 && failedShares === 0) {
        responseMessage = `${successfulShares} file(s) uploaded and shared successfully`
      } else if (successfulShares > 0 && failedShares > 0) {
        responseMessage = `${successfulShares} file(s) uploaded and shared successfully, ${failedShares} failed`
      } else if (failedShares > 0) {
        responseMessage = `File uploaded but sharing failed for ${failedShares} recipient(s)`
      }
    }

    console.log('=== UPLOAD RESPONSE ===')
    console.log('File ID:', newFile.id)
    console.log('File name:', newFile.name)
    console.log('Share mode:', shareMode)
    console.log('Successful shares:', successfulShares)
    console.log('Failed shares:', failedShares)
    console.log('Response message:', responseMessage)
    console.log('=== UPLOAD REQUEST END ===\n')

    return NextResponse.json({
      ...newFile,
      blobUrl: blob.url,
      success: true,
      message: responseMessage,
      sharingResults: shareMode === 'share' ? {
        totalRecipients: recipients?.length || 0,
        successfulShares,
        failedShares,
        results: shareResults
      } : null
    })

  } catch (error) {
    console.error('POST /api/files error:', error)
    return NextResponse.json({
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}