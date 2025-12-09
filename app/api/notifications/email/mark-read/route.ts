import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { notificationIds } = await request.json()

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: "Invalid notification IDs" }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // Mark notifications as read (update status to PROCESSED)
    const result = await prisma.emailLog.updateMany({
      where: {
        id: {
          in: notificationIds
        },
        recipientEmail: session.user.email, // Security: only allow marking own notifications
        status: 'SENT' // Only mark sent notifications as processed
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      markedRead: result.count,
      message: `Marked ${result.count} notifications as read`
    })

  } catch (error) {
    console.error('POST /api/notifications/email/mark-read error:', error)
    return NextResponse.json({
      error: "Failed to mark notifications as read",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}