import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"

export async function GET() {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifications: true,
        emailNotificationTypes: true,
        emailUnsubscribed: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      emailNotifications: user.emailNotifications,
      emailNotificationTypes: user.emailNotificationTypes,
      emailUnsubscribed: user.emailUnsubscribed,
    })
  } catch (error) {
    console.error('GET /api/notifications/preferences error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      emailNotifications,
      emailNotificationTypes,
      emailUnsubscribed
    } = body

    // Validate input
    const validFrequencies = ['IMMEDIATE', 'DAILY', 'WEEKLY', 'DISABLED']
    const validTypes = ['NEW_SHARES', 'SHARE_UPDATES', 'EXPIRATIONS']

    if (emailNotifications && !validFrequencies.includes(emailNotifications)) {
      return NextResponse.json({
        error: "Invalid email notification frequency",
        validValues: validFrequencies
      }, { status: 400 })
    }

    if (emailNotificationTypes) {
      if (!Array.isArray(emailNotificationTypes)) {
        return NextResponse.json({
          error: "emailNotificationTypes must be an array"
        }, { status: 400 })
      }

      const invalidTypes = emailNotificationTypes.filter(type => !validTypes.includes(type))
      if (invalidTypes.length > 0) {
        return NextResponse.json({
          error: "Invalid email notification types",
          invalidTypes,
          validValues: validTypes
        }, { status: 400 })
      }
    }

    if (typeof emailUnsubscribed !== 'undefined' && typeof emailUnsubscribed !== 'boolean') {
      return NextResponse.json({
        error: "emailUnsubscribed must be a boolean"
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // Get current preferences for audit logging
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifications: true,
        emailNotificationTypes: true,
        emailUnsubscribed: true,
      },
    })

    // Update preferences
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(emailNotificationTypes !== undefined && { emailNotificationTypes }),
        ...(emailUnsubscribed !== undefined && { emailUnsubscribed }),
      },
      select: {
        emailNotifications: true,
        emailNotificationTypes: true,
        emailUnsubscribed: true,
      },
    })

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.SETTINGS_CHANGE,
      resource: 'user',
      resourceId: session.user.id,
      details: {
        field: 'notification_preferences',
        oldValues: currentUser,
        newValues: updatedUser,
      },
      severity: AuditSeverity.LOW
    })

    return NextResponse.json({
      success: true,
      preferences: updatedUser,
      message: "Notification preferences updated successfully"
    })
  } catch (error) {
    console.error('PUT /api/notifications/preferences error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()

    // Get current preferences for audit logging
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifications: true,
        emailNotificationTypes: true,
        emailUnsubscribed: true,
      },
    })

    // Reset to defaults
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        emailNotifications: 'IMMEDIATE',
        emailNotificationTypes: ['NEW_SHARES'],
        emailUnsubscribed: false,
      },
      select: {
        emailNotifications: true,
        emailNotificationTypes: true,
        emailUnsubscribed: true,
      },
    })

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.SETTINGS_CHANGE,
      resource: 'user',
      resourceId: session.user.id,
      details: {
        field: 'notification_preferences_reset',
        oldValues: currentUser,
        newValues: updatedUser,
      },
      severity: AuditSeverity.LOW
    })

    return NextResponse.json({
      success: true,
      preferences: updatedUser,
      message: "Notification preferences reset to defaults"
    })
  } catch (error) {
    console.error('DELETE /api/notifications/preferences error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}