import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { put } from '@vercel/blob'
import { encryptFile } from "@/lib/crypto"
import { emitSocketEvent } from "@/lib/socket"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { sendFileShareNotification, sendBulkShareNotification } from "@/lib/email"
import { deliveryTracker } from "@/lib/delivery-tracker"

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

    // Enhanced sharing parameters
    let recipients = []
    let groups = []
    let permissions = ['VIEW'] // Default permissions
    let expiresAt: Date | null = null
    let password: string | null = null
    let maxAccessCount: number | null = null

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

    try {
      const groupsStr = formData.get('groups') as string || '[]'
      groups = JSON.parse(groupsStr)
    } catch (parseError) {
      console.error('Failed to parse groups:', parseError)
      return NextResponse.json({
        error: "Invalid groups format",
        details: "Groups must be a valid JSON array of group IDs."
      }, { status: 400 })
    }

    try {
      const permissionsStr = formData.get('permissions') as string || '["VIEW"]'
      permissions = JSON.parse(permissionsStr)
      // Validate permissions
      const validPermissions = ['VIEW', 'DOWNLOAD', 'EDIT']
      if (!permissions.every(p => validPermissions.includes(p))) {
        return NextResponse.json({
          error: "Invalid permissions",
          details: "Permissions must be one of: VIEW, DOWNLOAD, EDIT"
        }, { status: 400 })
      }
    } catch (parseError) {
      console.error('Failed to parse permissions:', parseError)
      return NextResponse.json({
        error: "Invalid permissions format",
        details: "Permissions must be a valid JSON array."
      }, { status: 400 })
    }

    // Parse expiration date
    const expiresAtStr = formData.get('expiresAt') as string
    if (expiresAtStr) {
      try {
        expiresAt = new Date(expiresAtStr)
        if (isNaN(expiresAt.getTime())) {
          return NextResponse.json({
            error: "Invalid expiration date",
            details: "Expiration date must be a valid ISO date string."
          }, { status: 400 })
        }
      } catch (error) {
        return NextResponse.json({
          error: "Invalid expiration date format",
          details: "Expiration date must be a valid ISO date string."
        }, { status: 400 })
      }
    }

    // Parse password protection
    password = formData.get('password') as string || null

    // Parse max access count
    const maxAccessCountStr = formData.get('maxAccessCount') as string
    if (maxAccessCountStr) {
      maxAccessCount = parseInt(maxAccessCountStr)
      if (isNaN(maxAccessCount) || maxAccessCount < 1) {
        return NextResponse.json({
          error: "Invalid max access count",
          details: "Max access count must be a positive integer."
        }, { status: 400 })
      }
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
    let newFile: any = null

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

    // Handle sharing if recipients or groups are provided
    if (shareMode === 'share' && (recipients.length > 0 || groups.length > 0)) {
      console.log('=== ENHANCED SHARING LOGIC START ===')
      console.log('Recipients:', recipients.length, 'Groups:', groups.length)
      console.log('Permissions:', permissions, 'Expires:', expiresAt, 'Password:', !!password)

      // Validate and process user shares
      if (recipients.length > 0) {
        const userShareResults = await processUserShares(
          prisma,
          newFile.id,
          session.user.id,
          recipients,
          permissions,
          expiresAt,
          password,
          maxAccessCount
        )
        shareResults.push(...userShareResults)

        // Track deliveries for successful user shares
        const successfulUserShares = userShareResults.filter(r => r.success)
        for (const result of successfulUserShares) {
          const deliveryId = deliveryTracker.trackDelivery({
            shareId: result.share.id,
            recipientId: result.recipientUser.id,
            recipientEmail: result.email,
            status: 'pending',
            notificationChannels: ['email', 'push'], // Default channels
            sentAt: new Date(),
            retryCount: 0,
            maxRetries: 3
          })

          console.log(`📬 Delivery tracking created for ${result.email}: ${deliveryId}`)
        }
      }

      // Validate and process group shares
      if (groups.length > 0) {
        const groupShareResults = await processGroupShares(
          prisma,
          newFile.id,
          session.user.id,
          groups,
          permissions,
          expiresAt,
          password,
          maxAccessCount
        )
        shareResults.push(...groupShareResults)
      }

      // Audit logging for sharing activity
      await logAuditEvent({
        userId: session.user.id,
        action: AuditAction.FILE_SHARE,
        resource: 'file',
        resourceId: newFile.id,
        details: {
          fileName: newFile.name,
          recipientsCount: recipients.length,
          groupsCount: groups.length,
          permissions,
          expiresAt: expiresAt?.toISOString(),
          hasPassword: !!password,
          maxAccessCount
        },
        severity: AuditSeverity.LOW
      })

      // Emit enhanced real-time notifications
      const successfulShares = shareResults.filter(r => r.success)
      for (const result of successfulShares) {
        emitSocketEvent('file-shared', {
          fileId: newFile.id,
          fileName: newFile.name,
          senderEmail: session.user.email,
          senderId: session.user.id,
          receiverEmail: result.email || result.groupName,
          receiverId: result.recipientUser?.id || result.groupId,
          permissions,
          expiresAt: expiresAt?.toISOString(),
          sharedAt: new Date().toISOString(),
          shareType: result.shareType
        })
      }

      console.log('=== ENHANCED SHARING LOGIC END ===')
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

    // Send email notifications asynchronously (don't block response)
    if (shareMode === 'share' && shareResults) {
      const successfulUserShares = shareResults.filter(r => r.success && r.shareType === 'USER')
      if (successfulUserShares.length > 0) {
        setImmediate(async () => {
          try {
            // Send individual notifications for single shares
            if (successfulUserShares.length === 1) {
              const share = successfulUserShares[0]
              const shareRecord = share.share

              // Generate download URL with token
              const downloadToken = `share_${shareRecord.id}_${Date.now()}`
              const downloadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/receive?token=${downloadToken}&share=${shareRecord.id}`

              await sendFileShareNotification({
                recipientEmail: share.email,
                recipientName: share.recipientUser?.name || undefined,
                senderEmail: session.user.email!,
                senderName: session.user.name || undefined,
                fileName: newFile.originalName || newFile.name,
                fileSize: newFile.size,
                fileType: newFile.type,
                permissions: shareRecord.permissions,
                expiresAt: shareRecord.expiresAt || undefined,
                downloadUrl,
                shareId: shareRecord.id,
                encrypted: newFile.encrypted,
              })
            } else {
              // Send bulk notification for multiple shares
              const bulkFiles = successfulUserShares.map(share => {
                const shareRecord = share.share
                const downloadToken = `share_${shareRecord.id}_${Date.now()}`
                const downloadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/receive?token=${downloadToken}&share=${shareRecord.id}`

                return {
                  name: newFile.originalName || newFile.name,
                  size: newFile.size,
                  type: newFile.type,
                  permissions: shareRecord.permissions,
                  expiresAt: shareRecord.expiresAt || undefined,
                  downloadUrl,
                  shareId: shareRecord.id,
                }
              })

              // Send bulk notifications to each recipient
              for (const share of successfulUserShares) {
                await sendBulkShareNotification({
                  recipientEmail: share.email,
                  recipientName: share.recipientUser?.name || undefined,
                  senderEmail: session.user.email!,
                  senderName: session.user.name || undefined,
                  files: bulkFiles,
                  totalFiles: bulkFiles.length,
                })
              }
            }
          } catch (error) {
            console.error('Failed to send email notifications:', error)
          }
        })
      }
    }

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

// Helper function to process user shares
async function processUserShares(
  prisma: any,
  fileId: string,
  creatorId: string,
  recipients: string[],
  permissions: string[],
  expiresAt: Date | null,
  password: string | null,
  maxAccessCount: number | null
) {
  const results = []

  for (const email of recipients) {
    try {
      const normalizedEmail = email.trim().toLowerCase()

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(normalizedEmail)) {
        results.push({
          email,
          success: false,
          error: 'Invalid email format',
          shareType: 'USER'
        })
        continue
      }

      // Check if user exists
      const recipientUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true, name: true }
      })

      if (!recipientUser) {
        results.push({
          email,
          success: false,
          error: 'User not registered in the system',
          shareType: 'USER'
        })
        continue
      }

      // Create share record
      const share = await prisma.fileShare.create({
        data: {
          fileId,
          userId: recipientUser.id,
          sharedWithEmail: normalizedEmail,
          shareType: 'USER',
          permissions,
          password,
          expiresAt,
          maxAccessCount,
          createdBy: creatorId
        }
      })

      results.push({
        email,
        success: true,
        share,
        recipientUser,
        shareType: 'USER'
      })

    } catch (error) {
      console.error('Error processing user share for', email, ':', error)
      results.push({
        email,
        success: false,
        error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        shareType: 'USER'
      })
    }
  }

  return results
}

// Helper function to process group shares
async function processGroupShares(
  prisma: any,
  fileId: string,
  creatorId: string,
  groups: string[],
  permissions: string[],
  expiresAt: Date | null,
  password: string | null,
  maxAccessCount: number | null
) {
  const results = []

  for (const groupId of groups) {
    try {
      // Validate group exists and user has access
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: { select: { id: true, email: true, name: true } },
          creator: { select: { id: true } }
        }
      })

      if (!group) {
        results.push({
          groupId,
          success: false,
          error: 'Group not found',
          shareType: 'GROUP'
        })
        continue
      }

      // Check if user is creator or member of the group
      if (group.creatorId !== creatorId && !group.members.some((m: any) => m.id === creatorId)) {
        results.push({
          groupId,
          success: false,
          error: 'Access denied: not a member of this group',
          shareType: 'GROUP'
        })
        continue
      }

      // Create share record for the group
      const share = await prisma.fileShare.create({
        data: {
          fileId,
          groupId,
          shareType: 'GROUP',
          permissions,
          password,
          expiresAt,
          maxAccessCount,
          createdBy: creatorId
        }
      })

      results.push({
        groupId,
        groupName: group.name,
        success: true,
        share,
        memberCount: group.members.length,
        shareType: 'GROUP'
      })

    } catch (error) {
      console.error('Error processing group share for', groupId, ':', error)
      results.push({
        groupId,
        success: false,
        error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        shareType: 'GROUP'
      })
    }
  }

  return results
}