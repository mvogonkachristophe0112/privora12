import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { deliveryTracker } from "@/lib/delivery-tracker"
import { emitSocketEvent } from "@/lib/socket"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')
    const timeRange = searchParams.get('timeRange')

    if (shareId) {
      // Get delivery status for a specific share
      const deliveries = deliveryTracker.getShareDeliveries(shareId)

      // Get additional data from database
      const prisma = await getPrismaClient()
      const share = await prisma.fileShare.findUnique({
        where: { id: shareId },
        include: {
          file: {
            select: {
              id: true,
              name: true,
              originalName: true,
              size: true,
              type: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          accessLogs: {
            where: {
              eventType: 'VIEW'
            },
            select: {
              userId: true,
              createdAt: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      })

      if (!share) {
        return NextResponse.json({ error: "Share not found" }, { status: 404 })
      }

      // Verify user has access to this share
      const hasAccess = share.createdBy === session.user.id
      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      return NextResponse.json({
        shareId,
        file: share.file,
        creator: share.creator,
        deliveries: deliveries.map(delivery => ({
          ...delivery,
          sentAt: delivery.sentAt?.toISOString(),
          deliveredAt: delivery.deliveredAt?.toISOString(),
          viewedAt: delivery.viewedAt?.toISOString(),
          downloadedAt: delivery.downloadedAt?.toISOString(),
          failedAt: delivery.failedAt?.toISOString(),
          lastNotificationSent: delivery.lastNotificationSent?.toISOString()
        })),
        accessLogs: share.accessLogs.map((log: any) => ({
          userId: log.userId,
          viewedAt: log.createdAt.toISOString()
        }))
      })
    } else {
      // Get delivery analytics
      let fromDate: Date
      let toDate: Date

      switch (timeRange) {
        case '24h':
          fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
          toDate = new Date()
          break
        case '7d':
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          toDate = new Date()
          break
        case '30d':
          fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          toDate = new Date()
          break
        default:
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          toDate = new Date()
      }

      const analytics = deliveryTracker.getDeliveryAnalytics({ from: fromDate, to: toDate })

      return NextResponse.json({
        analytics: {
          ...analytics,
          averageDeliveryTime: Math.round(analytics.averageDeliveryTime / 1000), // Convert to seconds
          recentFailures: analytics.recentFailures.map(failure => ({
            ...failure,
            sentAt: failure.sentAt?.toISOString(),
            deliveredAt: failure.deliveredAt?.toISOString(),
            viewedAt: failure.viewedAt?.toISOString(),
            downloadedAt: failure.downloadedAt?.toISOString(),
            failedAt: failure.failedAt?.toISOString(),
            lastNotificationSent: failure.lastNotificationSent?.toISOString()
          }))
        },
        timeRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        }
      })
    }

  } catch (error) {
    console.error('GET /api/files/delivery error:', error)
    return NextResponse.json({
      error: "Failed to fetch delivery status",
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

    const body = await request.json()
    const { action, deliveryId, shareId, recipientEmail } = body

    if (!action) {
      return NextResponse.json({
        error: "Invalid request",
        details: "Action is required"
      }, { status: 400 })
    }

    switch (action) {
      case 'mark_delivered':
        if (!deliveryId) {
          return NextResponse.json({
            error: "Invalid request",
            details: "deliveryId is required for mark_delivered action"
          }, { status: 400 })
        }

        deliveryTracker.markAsDelivered(deliveryId)

        // Emit real-time update
        emitSocketEvent('delivery-status-update', {
          deliveryId,
          status: 'delivered',
          timestamp: new Date().toISOString()
        })

        // Audit logging
        await logAuditEvent({
          userId: session.user.id,
          action: AuditAction.FILE_ACCESS,
          resource: 'delivery',
          resourceId: deliveryId,
          details: {
            action: 'mark_delivered',
            deliveryId
          },
          severity: AuditSeverity.LOW
        })

        return NextResponse.json({
          success: true,
          message: "Delivery marked as delivered"
        })

      case 'mark_viewed':
        if (!deliveryId) {
          return NextResponse.json({
            error: "Invalid request",
            details: "deliveryId is required for mark_viewed action"
          }, { status: 400 })
        }

        deliveryTracker.markAsViewed(deliveryId)

        // Emit real-time update
        emitSocketEvent('delivery-status-update', {
          deliveryId,
          status: 'viewed',
          timestamp: new Date().toISOString()
        })

        // Audit logging
        await logAuditEvent({
          userId: session.user.id,
          action: AuditAction.FILE_ACCESS,
          resource: 'delivery',
          resourceId: deliveryId,
          details: {
            action: 'mark_viewed',
            deliveryId
          },
          severity: AuditSeverity.LOW
        })

        return NextResponse.json({
          success: true,
          message: "Delivery marked as viewed"
        })

      case 'mark_downloaded':
        if (!deliveryId) {
          return NextResponse.json({
            error: "Invalid request",
            details: "deliveryId is required for mark_downloaded action"
          }, { status: 400 })
        }

        deliveryTracker.markAsDownloaded(deliveryId)

        // Emit real-time update
        emitSocketEvent('delivery-status-update', {
          deliveryId,
          status: 'downloaded',
          timestamp: new Date().toISOString()
        })

        // Audit logging
        await logAuditEvent({
          userId: session.user.id,
          action: AuditAction.FILE_ACCESS,
          resource: 'delivery',
          resourceId: deliveryId,
          details: {
            action: 'mark_downloaded',
            deliveryId
          },
          severity: AuditSeverity.LOW
        })

        return NextResponse.json({
          success: true,
          message: "Delivery marked as downloaded"
        })

      case 'retry_delivery':
        if (!deliveryId) {
          return NextResponse.json({
            error: "Invalid request",
            details: "deliveryId is required for retry_delivery action"
          }, { status: 400 })
        }

        const retrySuccess = await deliveryTracker.retryDelivery(deliveryId)

        // Emit real-time update
        emitSocketEvent('delivery-status-update', {
          deliveryId,
          status: retrySuccess ? 'sent' : 'failed',
          timestamp: new Date().toISOString(),
          action: 'retry'
        })

        // Audit logging
        await logAuditEvent({
          userId: session.user.id,
          action: AuditAction.FILE_ACCESS,
          resource: 'delivery',
          resourceId: deliveryId,
          details: {
            action: 'retry_delivery',
            success: retrySuccess,
            deliveryId
          },
          severity: AuditSeverity.MEDIUM
        })

        return NextResponse.json({
          success: retrySuccess,
          message: retrySuccess ? "Delivery retry initiated" : "Delivery retry failed"
        })

      case 'track_delivery':
        if (!shareId || !recipientEmail) {
          return NextResponse.json({
            error: "Invalid request",
            details: "shareId and recipientEmail are required for track_delivery action"
          }, { status: 400 })
        }

        // Get user info for recipient
        const prisma = await getPrismaClient()
        const recipientUser = await prisma.user.findUnique({
          where: { email: recipientEmail },
          select: { id: true, name: true, email: true }
        })

        if (!recipientUser) {
          return NextResponse.json({
            error: "Recipient not found",
            details: "The recipient email is not registered in the system"
          }, { status: 404 })
        }

        const newDeliveryId = deliveryTracker.trackDelivery({
          shareId,
          recipientId: recipientUser.id,
          recipientEmail,
          status: 'pending',
          notificationChannels: ['email', 'push'],
          sentAt: new Date(),
          retryCount: 0,
          maxRetries: 3
        })

        // Emit real-time update
        emitSocketEvent('delivery-status-update', {
          deliveryId: newDeliveryId,
          shareId,
          recipientEmail,
          status: 'pending',
          timestamp: new Date().toISOString(),
          action: 'track'
        })

        // Audit logging
        await logAuditEvent({
          userId: session.user.id,
          action: AuditAction.FILE_SHARE,
          resource: 'delivery',
          resourceId: newDeliveryId,
          details: {
            action: 'track_delivery',
            shareId,
            recipientEmail,
            deliveryId: newDeliveryId
          },
          severity: AuditSeverity.LOW
        })

        return NextResponse.json({
          success: true,
          deliveryId: newDeliveryId,
          message: "Delivery tracking initiated"
        })

      default:
        return NextResponse.json({
          error: "Invalid action",
          details: `Unknown action: ${action}`
        }, { status: 400 })
    }

  } catch (error) {
    console.error('POST /api/files/delivery error:', error)
    return NextResponse.json({
      error: "Delivery operation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
