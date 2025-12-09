import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { emitSocketEvent } from "@/lib/socket"
import nodemailer from 'nodemailer'

// Email transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { emails, fileId, groupId, message, permissions } = await request.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "emails array is required" }, { status: 400 })
    }

    if (!fileId && !groupId) {
      return NextResponse.json({ error: "Either fileId or groupId must be provided" }, { status: 400 })
    }

    const results = []
    let successCount = 0
    let failCount = 0

    for (const email of emails) {
      try {
        const normalizedEmail = email.trim().toLowerCase()

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, name: true }
        })

        if (existingUser) {
          // User exists, create share directly
          if (fileId) {
            await prisma.fileShare.create({
              data: {
                fileId,
                userId: existingUser.id,
                sharedWithEmail: normalizedEmail,
                shareType: 'USER',
                permissions: permissions || ['VIEW'],
                createdBy: session.user.id
              }
            })
          } else if (groupId) {
            // Add to group
            await prisma.group.update({
              where: { id: groupId },
              data: {
                members: {
                  connect: { id: existingUser.id }
                }
              }
            })
          }

          results.push({
            email,
            success: true,
            action: 'shared_directly',
            userExists: true
          })
          successCount++

        } else {
          // User doesn't exist, send invitation email
          const invitationToken = generateInvitationToken()

          // Store invitation in database (you might want to create an Invitation model)
          // For now, we'll send the email directly

          const invitationUrl = `${process.env.NEXTAUTH_URL}/register?token=${invitationToken}&email=${encodeURIComponent(normalizedEmail)}`

          let shareContext = ''
          if (fileId) {
            const file = await prisma.file.findUnique({
              where: { id: fileId },
              select: { name: true }
            })
            shareContext = `file "${file?.name}"`
          } else if (groupId) {
            const group = await prisma.group.findUnique({
              where: { id: groupId },
              select: { name: true }
            })
            shareContext = `group "${group?.name}"`
          }

          const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@yourapp.com',
            to: normalizedEmail,
            subject: `You're invited to access ${shareContext}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>You've been invited!</h2>
                <p>Hello,</p>
                <p><strong>${session.user.name || session.user.email}</strong> has invited you to access ${shareContext}.</p>

                ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}

                <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
                  <p><strong>Permissions:</strong> ${permissions?.join(', ') || 'View'}</p>
                </div>

                <p>To accept this invitation, please click the button below to create your account:</p>

                <a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
                  Accept Invitation
                </a>

                <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
                <p style="color: #6c757d; font-size: 12px;">
                  This invitation will expire in 7 days.
                </p>
              </div>
            `
          }

          await transporter.sendMail(mailOptions)

          results.push({
            email,
            success: true,
            action: 'invitation_sent',
            userExists: false
          })
          successCount++
        }

      } catch (error) {
        console.error('Error processing invitation for', email, ':', error)
        results.push({
          email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        failCount++
      }
    }

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.FILE_SHARE,
      resource: fileId ? 'file_invitation' : 'group_invitation',
      resourceId: fileId || groupId,
      details: {
        emailsCount: emails.length,
        successCount,
        failCount,
        permissions,
        hasCustomMessage: !!message
      },
      severity: AuditSeverity.LOW
    })

    // Emit notification
    emitSocketEvent('invitations-sent', {
      senderId: session.user.id,
      senderName: session.user.name,
      emailsCount: emails.length,
      successCount,
      failCount,
      sentAt: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      summary: {
        total: emails.length,
        success: successCount,
        failed: failCount
      },
      results
    })

  } catch (error) {
    console.error('POST /api/invitations error:', error)
    return NextResponse.json({
      error: "Failed to send invitations",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Helper function to generate invitation token
function generateInvitationToken(): string {
  return require('crypto').randomBytes(32).toString('hex')
}