import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()

    // Get pending email notifications for the user
    const pendingNotifications = await prisma.emailLog.findMany({
      where: {
        recipientEmail: session.user.email,
        status: 'SENT',
        // Only get notifications from the last 24 hours
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      include: {
        fileShare: {
          include: {
            file: true,
            creator: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10 // Limit to prevent overwhelming the user
    })

    // Transform for frontend
    const notifications = pendingNotifications.map((log: any) => ({
      id: log.id,
      type: log.type,
      recipientEmail: log.recipientEmail,
      fileData: log.fileShare ? {
        id: log.fileShare.id,
        name: log.fileShare.file.originalName || log.fileShare.file.name,
        size: log.fileShare.file.size,
        senderName: log.fileShare.creator.name,
        senderEmail: log.fileShare.creator.email
      } : null,
      sentAt: log.createdAt.toISOString(),
      status: log.status
    }))

    return NextResponse.json({
      pendingNotifications: notifications,
      totalPending: notifications.length
    })

  } catch (error) {
    console.error('GET /api/notifications/email/status error:', error)
    return NextResponse.json({
      error: "Failed to fetch email notification status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}