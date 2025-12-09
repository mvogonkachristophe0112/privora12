import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { sendFileShareNotification } from "@/lib/email"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const shareId = resolvedParams.id
    const prisma = await getPrismaClient()

    // Find the share and verify ownership
    const share = await prisma.fileShare.findUnique({
      where: { id: shareId },
      include: {
        file: {
          select: {
            id: true,
            name: true,
            originalName: true,
            size: true,
            type: true,
            encrypted: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 })
    }

    // Check if user is the creator of the share
    if (share.createdBy !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if share has an email recipient
    if (!share.sharedWithEmail) {
      return NextResponse.json({
        error: "This share does not have an email recipient"
      }, { status: 400 })
    }

    // Generate download URL with token
    const downloadToken = `share_${shareId}_${Date.now()}`
    const downloadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/receive?token=${downloadToken}&share=${shareId}`

    // Send notification email
    const emailResult = await sendFileShareNotification({
      recipientEmail: share.sharedWithEmail,
      recipientName: share.user?.name || undefined,
      senderEmail: share.creator.email,
      senderName: share.creator.name || undefined,
      fileName: share.file.originalName || share.file.name,
      fileSize: share.file.size,
      fileType: share.file.type,
      permissions: share.permissions,
      expiresAt: share.expiresAt || undefined,
      downloadUrl,
      shareId: share.id,
      encrypted: share.file.encrypted,
    })

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.FILE_SHARE,
      resource: 'file_share',
      resourceId: share.id,
      details: {
        action: 'manual_notification',
        recipientEmail: share.sharedWithEmail,
        emailSent: emailResult,
        fileId: share.file.id,
        fileName: share.file.name,
      },
      severity: AuditSeverity.LOW
    })

    if (emailResult) {
      return NextResponse.json({
        success: true,
        message: "Notification email sent successfully",
        recipient: share.sharedWithEmail
      })
    } else {
      return NextResponse.json({
        error: "Failed to send notification email"
      }, { status: 500 })
    }

  } catch (error) {
    console.error('POST /api/files/share/[id]/notify error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}