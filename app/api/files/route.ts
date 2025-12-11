import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { encryptFile } from "@/lib/crypto"
import { emitSocketEvent } from "@/lib/socket"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { deliveryTracker } from "@/lib/delivery-tracker"
import { PathSanitizer, InputValidator, ContentSecurity, RateLimiter } from "@/lib/security"
import { createValidationError, createQuotaExceededError, handleApiError } from "@/lib/error-handling"
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const includeShares = searchParams.get('includeShares') === 'true'
    const includeStats = searchParams.get('includeStats') === 'true'

    const skip = (page - 1) * limit

    // Build query
    const where = { userId: session.user.id }
    const orderBy = { createdAt: 'desc' as const }

    // Get files with optional includes
    const filesQuery = prisma.file.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: includeShares ? {
        shares: {
          where: { revoked: false },
          select: {
            id: true,
            sharedWithEmail: true,
            permissions: true,
            expiresAt: true,
            status: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      } : undefined
    })

    // Get total count for pagination
    const totalQuery = prisma.file.count({ where })

    // Execute queries
    const [files, total] = await Promise.all([filesQuery, totalQuery])

    // Calculate stats if requested
    let stats = null
    if (includeStats) {
      const [
        totalFiles,
        encryptedFiles,
        sharedFiles,
        totalSizeResult,
        recentUploads
      ] = await Promise.all([
        prisma.file.count({ where: { userId: session.user.id } }),
        prisma.file.count({ where: { userId: session.user.id, encrypted: true } }),
        prisma.fileShare.count({
          where: {
            file: { userId: session.user.id },
            revoked: false
          }
        }),
        prisma.file.aggregate({
          where: { userId: session.user.id },
          _sum: { size: true }
        }),
        prisma.file.count({
          where: {
            userId: session.user.id,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        })
      ])

      stats = {
        totalFiles,
        totalSize: totalSizeResult._sum.size || 0,
        encryptedFiles,
        sharedFiles,
        recentUploads,
        storageUsed: totalSizeResult._sum.size || 0,
        storageLimit: 5 * 1024 * 1024 * 1024 // 5GB default limit
      }
    }

    // Transform files to include computed fields
    const transformedFiles = files.map((file: any) => ({
      ...file,
      downloadCount: 0, // Would need to implement download tracking
      viewCount: 0, // Would need to implement view tracking
      shareCount: file.shares?.length || 0,
      lastAccessed: file.updatedAt // Using updatedAt as proxy
    }))

    return NextResponse.json({
      files: transformedFiles,
      total,
      page,
      limit,
      hasMore: skip + files.length < total,
      stats
    })
  } catch (error) {
    console.error('GET /api/files error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    RateLimiter.createMiddleware()(request)

    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      throw createValidationError("Unauthorized")
    }

    let prisma
    try {
      prisma = await getPrismaClient()
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      throw createValidationError("Database connection failed. Please try again later.")
    }

    let formData
    try {
      formData = await request.formData()
    } catch (formError) {
      console.error('Failed to parse form data:', formError)
      throw createValidationError("Invalid form data: Unable to process the uploaded file data.")
    }

    const file = formData.get('file') as File
    const encrypt = formData.get('encrypt') === 'true'
    const encryptionKey = formData.get('encryptionKey') as string
    const type = formData.get('type') as string

    // Validate file upload security
    if (file) {
      await ContentSecurity.validateFileUpload(file, ['image/*', 'video/*', 'audio/*', 'application/*'], 500 * 1024 * 1024) // 500MB limit
    }

    // Sanitize and validate inputs
    const sanitizedType = InputValidator.sanitizeString(type, 100)
    const sanitizedEncryptionKey = encryptionKey ? InputValidator.sanitizeString(encryptionKey, 1000) : ""

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
    const deliveryMode = formData.get('deliveryMode') as string // New parameter for LAN delivery

    console.log('=== UPLOAD REQUEST START ===')
    console.log('File provided:', !!file)
    console.log('File name:', file?.name)
    console.log('File size:', file?.size)
    console.log('Raw recipients from form:', formData.get('recipients'))
    console.log('Parsed recipients:', recipients)
    console.log('Recipients length:', recipients.length)
    console.log('Share mode:', shareMode)
    console.log('Delivery mode:', deliveryMode)
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

    console.log('Starting local file storage...')
    // Generate secure unique filename for local storage
    const uniqueId = crypto.randomUUID()
    const sanitizedFileName = PathSanitizer.sanitizeFilename(finalFileName)
    const secureFileName = PathSanitizer.generateSecureFilename(sanitizedFileName, 'upload')
    const uploadDir = path.resolve(process.cwd(), 'storage', 'uploads')

    // Sanitize upload directory path
    const sanitizedUploadDir = PathSanitizer.sanitizeFilePath(uploadDir, process.cwd())

    // Ensure upload directory exists with proper permissions
    await fs.mkdir(sanitizedUploadDir, { recursive: true, mode: 0o755 })

    // Write file to local storage with security checks
    const filePath = path.join(sanitizedUploadDir, secureFileName)
    const sanitizedFilePath = PathSanitizer.sanitizeFilePath(filePath, sanitizedUploadDir)

    await fs.writeFile(sanitizedFilePath, Buffer.from(fileData))
    console.log('Local file storage successful, path:', sanitizedFilePath)

    // Create local URL for file access
    const localUrl = `/api/files/download/local/${secureFileName}`

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
            url: localUrl,
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

      // Validate and process user shares with transaction guarantee
      if (recipients.length > 0) {
        const userShareResults = await processUserShares(
          prisma,
          newFile.id,
          session.user.id,
          session.user.email,
          recipients,
          permissions,
          expiresAt,
          password,
          maxAccessCount
        )
        shareResults.push(...userShareResults)

        // CRITICAL: Only proceed with delivery tracking if shares were successfully created
        const successfulUserShares = userShareResults.filter(r => r.success && r.deliveryGuaranteed)
        if (successfulUserShares.length > 0) {
          for (const result of successfulUserShares) {
            try {
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
            } catch (deliveryError) {
              console.error(`Failed to track delivery for ${result.email}:`, deliveryError)
              // Don't fail the entire operation for delivery tracking issues
            }
          }
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

      // DELIVERY GUARANTEE: Verify all successful shares are properly saved before proceeding
      const successfulShares = shareResults.filter(r => r.success)
      if (successfulShares.length > 0) {
        // Double-check that all shares exist in database
        const shareIds = successfulShares.map(r => r.share.id).filter(Boolean)
        const verifiedShares = await prisma.fileShare.findMany({
          where: {
            id: { in: shareIds },
            revoked: false
          },
          select: { id: true, sharedWithEmail: true, userId: true }
        })

        if (verifiedShares.length !== successfulShares.length) {
          console.error('CRITICAL: Share verification failed - some shares were not properly saved')
          // This is a serious issue - log it but don't fail the response
          await logAuditEvent({
            userId: session.user.id,
            action: AuditAction.FILE_ACCESS,
            resource: 'file_share',
            resourceId: newFile.id,
            details: {
              issue: 'share_verification_failed',
              expectedShares: successfulShares.length,
              verifiedShares: verifiedShares.length,
              shareIds
            },
            severity: AuditSeverity.HIGH
          })
        } else {
          console.log(`✅ Share verification successful: ${verifiedShares.length} shares confirmed`)
        }
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
          maxAccessCount,
          successfulShares: successfulShares.length,
          failedShares: shareResults.filter(r => !r.success).length
        },
        severity: AuditSeverity.LOW
      })

      // Emit enhanced real-time notifications ONLY for verified successful shares
      const verifiedSuccessfulShares = shareResults.filter(r => r.success && r.deliveryGuaranteed)
      for (const result of verifiedSuccessfulShares) {
        try {
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
            shareType: result.shareType,
            shareId: result.share.id // Include share ID for tracking
          })
          console.log(`📡 Real-time notification sent for share ${result.share.id}`)
        } catch (socketError) {
          console.error(`Failed to emit socket event for share ${result.share.id}:`, socketError)
        }
      }

      console.log('=== ENHANCED SHARING LOGIC END ===')
    }

    // Handle LAN delivery mode - direct file delivery to specific recipients
    if (deliveryMode === 'lan' && recipients.length > 0) {
      console.log('=== LAN DELIVERY MODE START ===')
      console.log('Recipients for LAN delivery:', recipients.length)

      // Get client IP address for tracking
      const clientIP = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      '127.0.0.1'

      // Process LAN deliveries
      const deliveryResults = await processLanDeliveries(
        prisma,
        newFile.id,
        session.user.id,
        session.user.email,
        recipients,
        clientIP
      )

      // Track delivery status for each successful delivery
      const successfulDeliveries = deliveryResults.filter(r => r.success)
      if (successfulDeliveries.length > 0) {
        for (const result of successfulDeliveries) {
          try {
            // Create delivery tracking record
            const deliveryRecord = await prisma.fileDelivery.create({
              data: {
                fileId: newFile.id,
                senderId: session.user.id,
                recipientId: result.recipientUser.id,
                status: 'PENDING',
                senderIp: clientIP,
                recipientIp: null, // Will be updated when recipient downloads
                deliveryAttempts: 0,
                maxDeliveryAttempts: 3,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                createdAt: new Date(),
                updatedAt: new Date()
              }
            })

            console.log(`📦 LAN delivery record created for ${result.email}: ${deliveryRecord.id}`)

            // Emit real-time notification for LAN delivery
            emitSocketEvent('lan-file-delivery', {
              fileId: newFile.id,
              fileName: newFile.name,
              senderEmail: session.user.email,
              senderId: session.user.id,
              receiverEmail: result.email,
              receiverId: result.recipientUser.id,
              deliveryId: deliveryRecord.id,
              status: 'pending',
              deliveredAt: new Date().toISOString(),
              deliveryType: 'lan'
            })

          } catch (deliveryError) {
            console.error(`Failed to create delivery record for ${result.email}:`, deliveryError)
          }
        }
      }

      // Audit logging for LAN delivery
      await logAuditEvent({
        userId: session.user.id,
        action: AuditAction.FILE_SHARE,
        resource: 'file_delivery',
        resourceId: newFile.id,
        details: {
          fileName: newFile.name,
          deliveryMode: 'lan',
          recipientsCount: recipients.length,
          clientIP,
          successfulDeliveries: successfulDeliveries.length,
          failedDeliveries: deliveryResults.filter(r => !r.success).length
        },
        severity: AuditSeverity.LOW
      })

      console.log('=== LAN DELIVERY MODE END ===')
    }

    // DELIVERY GUARANTEE: Final verification before response
    let finalSuccessfulShares = 0
    let finalFailedShares = 0

    if (shareMode === 'share' && shareResults) {
      // Final verification: ensure all claimed successful shares actually exist
      const claimedSuccessfulShares = shareResults.filter(r => r.success)
      if (claimedSuccessfulShares.length > 0) {
        const verifiedShareIds = claimedSuccessfulShares
          .map(r => r.share?.id)
          .filter(Boolean)

        if (verifiedShareIds.length > 0) {
          const verifiedShares = await prisma.fileShare.findMany({
            where: {
              id: { in: verifiedShareIds },
              revoked: false
            },
            select: { id: true }
          })

          finalSuccessfulShares = verifiedShares.length
          finalFailedShares = claimedSuccessfulShares.length - verifiedShares.length

          if (finalFailedShares > 0) {
            console.error(`CRITICAL: ${finalFailedShares} shares failed final verification`)
          }
        }
      }
    }

    // Prepare response with verified sharing results
    let responseMessage = 'File uploaded successfully'
    let responseStatus = true

    if (shareMode === 'share') {
      if (finalSuccessfulShares > 0 && finalFailedShares === 0) {
        responseMessage = `File uploaded and shared successfully with ${finalSuccessfulShares} recipient(s)`
      } else if (finalSuccessfulShares > 0 && finalFailedShares > 0) {
        responseMessage = `File uploaded and shared with ${finalSuccessfulShares} recipient(s), ${finalFailedShares} failed`
      } else if (finalFailedShares > 0) {
        responseMessage = `File uploaded but sharing failed for all recipients`
        responseStatus = false // Consider this a failure if no shares succeeded
      }
    }

    console.log('=== FINAL VERIFICATION ===')
    console.log('File ID:', newFile.id)
    console.log('Share mode:', shareMode)
    console.log('Verified successful shares:', finalSuccessfulShares)
    console.log('Verified failed shares:', finalFailedShares)
    console.log('Response status:', responseStatus)
    console.log('Response message:', responseMessage)
    console.log('=== UPLOAD REQUEST END ===\n')

    // Email notifications disabled for offline LAN deployment
    // In a real offline deployment, you could implement local notifications here
    console.log('Offline mode: Email notifications disabled')

    return NextResponse.json({
      ...newFile,
      localUrl: localUrl,
      success: responseStatus,
      message: responseMessage,
      sharingResults: shareMode === 'share' ? {
        totalRecipients: recipients?.length || 0,
        successfulShares: finalSuccessfulShares,
        failedShares: finalFailedShares,
        results: shareResults
      } : null
    })

  } catch (error) {
    const { error: appError, response } = await handleApiError(error, 'File upload')
    return NextResponse.json(response, { status: appError.statusCode })
  }
}

// Helper function to process user shares with enhanced validation and delivery guarantees
async function processUserShares(
  prisma: any,
  fileId: string,
  creatorId: string,
  creatorEmail: string,
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

      // Enhanced email validation
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
      if (!emailRegex.test(normalizedEmail)) {
        results.push({
          email,
          success: false,
          error: 'Invalid email format',
          shareType: 'USER'
        })
        continue
      }

      // Prevent self-sharing
      if (normalizedEmail === creatorEmail?.toLowerCase()) {
        results.push({
          email,
          success: false,
          error: 'Cannot share file with yourself',
          shareType: 'USER'
        })
        continue
      }

      // Check if user exists with enhanced validation
      const recipientUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true, name: true }
      })

      if (!recipientUser) {
        results.push({
          email,
          success: false,
          error: 'Recipient email not registered in the system. They must create an account first.',
          shareType: 'USER'
        })
        continue
      }

      // Check for existing share to prevent duplicates
      const existingShare = await prisma.fileShare.findFirst({
        where: {
          fileId,
          sharedWithEmail: normalizedEmail,
          revoked: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      })

      if (existingShare) {
        results.push({
          email,
          success: false,
          error: 'File already shared with this recipient',
          shareType: 'USER',
          existingShare: true
        })
        continue
      }

      // Create share record with enhanced data integrity
      const shareData = {
        fileId,
        userId: recipientUser.id,
        sharedWithEmail: normalizedEmail,
        shareType: 'USER' as const,
        status: 'PENDING' as const,
        permissions,
        password,
        expiresAt,
        maxAccessCount,
        createdBy: creatorId
      }

      const share = await prisma.fileShare.create({
        data: shareData,
        include: {
          file: {
            select: {
              id: true,
              name: true,
              size: true,
              type: true
            }
          }
        }
      })

      // Verify share was created successfully
      if (!share || !share.id) {
        throw new Error('Share creation failed - no share ID returned')
      }

      results.push({
        email: normalizedEmail,
        success: true,
        share,
        recipientUser,
        shareType: 'USER',
        deliveryGuaranteed: true
      })

    } catch (error) {
      console.error('Error processing user share for', email, ':', error)

      // Enhanced error categorization
      let errorMessage = 'Unknown error occurred'
      if (error instanceof Error) {
        if (error.message.includes('Unique constraint')) {
          errorMessage = 'File already shared with this recipient'
        } else if (error.message.includes('Foreign key constraint')) {
          errorMessage = 'Invalid recipient or file reference'
        } else {
          errorMessage = error.message
        }
      }

      results.push({
        email,
        success: false,
        error: `Failed to share file: ${errorMessage}`,
        shareType: 'USER'
      })
    }
  }

  return results
}

// Helper function to process LAN deliveries
async function processLanDeliveries(
  prisma: any,
  fileId: string,
  senderId: string,
  senderEmail: string,
  recipients: string[],
  clientIP: string
) {
  const results = []

  for (const email of recipients) {
    try {
      const normalizedEmail = email.trim().toLowerCase()

      // Enhanced email validation
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
      if (!emailRegex.test(normalizedEmail)) {
        results.push({
          email,
          success: false,
          error: 'Invalid email format',
          deliveryType: 'lan'
        })
        continue
      }

      // Prevent self-delivery
      if (normalizedEmail === senderEmail?.toLowerCase()) {
        results.push({
          email,
          success: false,
          error: 'Cannot deliver file to yourself',
          deliveryType: 'lan'
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
          error: 'Recipient email not registered in the system. They must create an account first.',
          deliveryType: 'lan'
        })
        continue
      }

      // Check for existing delivery to prevent duplicates
      const existingDelivery = await prisma.fileDelivery.findFirst({
        where: {
          fileId,
          recipientId: recipientUser.id,
          status: { in: ['PENDING', 'DELIVERED'] },
          expiresAt: { gt: new Date() }
        }
      })

      if (existingDelivery) {
        results.push({
          email,
          success: false,
          error: 'File already delivered to this recipient',
          deliveryType: 'lan',
          existingDelivery: true
        })
        continue
      }

      results.push({
        email: normalizedEmail,
        success: true,
        recipientUser,
        deliveryType: 'lan'
      })

    } catch (error) {
      console.error('Error processing LAN delivery for', email, ':', error)

      let errorMessage = 'Unknown error occurred'
      if (error instanceof Error) {
        errorMessage = error.message
      }

      results.push({
        email,
        success: false,
        error: `Failed to process delivery: ${errorMessage}`,
        deliveryType: 'lan'
      })
    }
  }

  return results
}

// Email notifications disabled for offline LAN deployment
// In a real offline deployment, you could implement local notifications here

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