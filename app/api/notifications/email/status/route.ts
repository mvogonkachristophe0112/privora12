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
        recipient: session.user.email,
        status: 'SENT',
        // Only get notifications from the last 24 hours
        sentAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        sentAt: 'desc'
      },
      take: 10 // Limit to prevent overwhelming the user
    })

    // Transform for frontend
    const notifications = pendingNotifications.map((log: any) => ({
      id: log.id,
      type: log.type,
      recipientEmail: log.recipient,
      fileData: null, // File data not available in current schema
      sentAt: log.sentAt.toISOString(),
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