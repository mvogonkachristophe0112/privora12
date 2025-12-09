import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { deliveryTracker } from "@/lib/delivery-tracker"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Get all file shares where the user is the recipient
    const receivedShares = await prisma.fileShare.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { sharedWithEmail: session.user.email },
          {
            group: {
              members: {
                some: {
                  id: session.user.id
                }
              }
            }
          }
        ],
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            originalName: true,
            size: true,
            type: true,
            url: true,
            encrypted: true,
            encryptionKey: true,
            fileType: true,
            createdAt: true,
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        group: {
          select: {
            id: true,
            name: true,
          }
        },
        accessLogs: {
          where: {
            userId: session.user.id,
            eventType: 'VIEW'
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.fileShare.count({
      where: {
        OR: [
          { userId: session.user.id },
          { sharedWithEmail: session.user.email },
          {
            group: {
              members: {
                some: {
                  id: session.user.id
                }
              }
            }
          }
        ],
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    // Transform the data for the frontend
    const files = receivedShares.map(share => {
      const hasViewed = share.accessLogs.length > 0
      const lastViewed = hasViewed ? share.accessLogs[0].createdAt : null

      return {
        id: share.id, // This is the share ID
        fileId: share.file.id, // This is the actual file ID for downloads
        name: share.file.originalName || share.file.name,
        originalName: share.file.originalName || share.file.name,
        size: share.file.size,
        type: share.file.type,
        url: share.file.url,
        encrypted: share.file.encrypted,
        fileType: share.file.fileType,
        senderEmail: share.creator.email,
        senderName: share.creator.name,
        sharedAt: share.createdAt.toISOString(),
        permissions: share.permissions,
        expiresAt: share.expiresAt?.toISOString() || null,
        shareType: share.shareType,
        groupName: share.group?.name || null,
        hasViewed,
        lastViewed: lastViewed?.toISOString() || null,
        accessCount: share.accessCount,
        viewCount: share.viewCount,
        downloadCount: share.downloadCount,
        maxAccessCount: share.maxAccessCount,
        password: share.password,
        revoked: share.revoked
      }
    })

    // Get delivery status for each file
    const filesWithDeliveryStatus = await Promise.all(
      files.map(async (file) => {
        const deliveryStatus = deliveryTracker.getDeliveryStatus(file.id)
        return {
          ...file,
          deliveryStatus: deliveryStatus ? {
            status: deliveryStatus.status,
            deliveredAt: deliveryStatus.deliveredAt?.toISOString(),
            viewedAt: deliveryStatus.viewedAt?.toISOString(),
            downloadedAt: deliveryStatus.downloadedAt?.toISOString(),
            retryCount: deliveryStatus.retryCount,
            failureReason: deliveryStatus.failureReason
          } : null
        }
      })
    )

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.ACCESS_VIEW,
      resource: 'received_files',
      resourceId: null,
      details: {
        page,
        limit,
        totalFiles: files.length,
        action: 'list_received_files'
      },
      severity: AuditSeverity.LOW
    })

    return NextResponse.json({
      files: filesWithDeliveryStatus,
      total: totalCount,
      page,
      limit,
      hasMore: offset + limit < totalCount
    })

  } catch (error) {
    console.error('GET /api/files/received error:', error)
    return NextResponse.json({
      error: "Failed to fetch received files",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
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
    const body = await request.json()
    const { operation, shareIds } = body

    if (!operation || !shareIds || !Array.isArray(shareIds)) {
      return NextResponse.json({
        error: "Invalid request",
        details: "Operation and shareIds array are required"
      }, { status: 400 })
    }

    const results = []

    for (const shareId of shareIds) {
      try {
        const share = await prisma.fileShare.findUnique({
          where: { id: shareId },
          include: {
            file: true,
            creator: true
          }
        })

        if (!share) {
          results.push({
            shareId,
            success: false,
            error: "Share not found"
          })
          continue
        }

        // Verify user has access to this share
        const hasAccess = share.userId === session.user.id ||
                         share.sharedWithEmail === session.user.email ||
                         (share.group && await prisma.group.findFirst({
                           where: {
                             id: share.groupId!,
                             members: {
                               some: { id: session.user.id }
                             }
                           }
                         }))

        if (!hasAccess) {
          results.push({
            shareId,
            success: false,
            error: "Access denied"
          })
          continue
        }

        switch (operation) {
          case 'accept':
            // Update share status to accepted
            await prisma.fileShare.update({
              where: { id: shareId },
              data: { status: 'ACCEPTED' }
            })

            // Mark delivery as delivered
            deliveryTracker.markAsDelivered(shareId)

            results.push({
              shareId,
              success: true,
              operation: 'accept'
            })
            break

          case 'reject':
            // Update share status to rejected
            await prisma.fileShare.update({
              where: { id: shareId },
              data: { status: 'REJECTED' }
            })

            results.push({
              shareId,
              success: true,
              operation: 'reject'
            })
            break

          case 'delete':
            // For delete, we remove the share record (soft delete by marking as revoked)
            await prisma.fileShare.update({
              where: { id: shareId },
              data: { revoked: true }
            })

            results.push({
              shareId,
              success: true,
              operation: 'delete'
            })
            break

          case 'export':
            // Export functionality would be implemented here
            results.push({
              shareId,
              success: true,
              operation: 'export',
              data: {
                fileName: share.file.originalName,
                sender: share.creator.email,
                sharedAt: share.createdAt,
                permissions: share.permissions
              }
            })
            break

          default:
            results.push({
              shareId,
              success: false,
              error: `Unknown operation: ${operation}`
            })
        }

        // Audit logging
        await logAuditEvent({
          userId: session.user.id,
          action: AuditAction.FILE_ACCESS,
          resource: 'file_share',
          resourceId: shareId,
          details: {
            operation,
            fileId: share.file.id,
            fileName: share.file.name
          },
          severity: AuditSeverity.LOW
        })

      } catch (error) {
        console.error(`Error processing ${operation} for share ${shareId}:`, error)
        results.push({
          shareId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    // Calculate summary
    const summary = {
      totalSuccess: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      operation
    }

    return NextResponse.json({
      success: true,
      results,
      summary
    })

  } catch (error) {
    console.error('POST /api/files/received error:', error)
    return NextResponse.json({
      error: "Bulk operation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}