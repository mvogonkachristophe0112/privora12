import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth'
import { getPrismaClient } from '@/lib/prisma'
import nodemailer from 'nodemailer'

interface NotificationPayload {
  deliveryId: string
  shareId: string
  recipientEmail: string
  channel: 'email' | 'push' | 'sms'
  fileName?: string
  senderName?: string
  shareUrl?: string
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const payload: NotificationPayload = await request.json()

    const { deliveryId, shareId, recipientEmail, channel, fileName, senderName, shareUrl } = payload

    // Get share details
    const share = await prisma.fileShare.findUnique({
      where: { id: shareId },
      include: {
        file: true,
        sender: true,
        recipient: true
      }
    })

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    let success = false
    let errorMessage = ''

    switch (channel) {
      case 'email':
        success = await sendEmailNotification({
          deliveryId,
          share,
          recipientEmail,
          fileName: fileName || share.file.name,
          senderName: senderName || share.sender.name || share.sender.email,
          shareUrl: shareUrl || `${process.env.NEXTAUTH_URL}/receive`
        })
        break

      case 'push':
        success = await sendPushNotification({
          deliveryId,
          share,
          recipientEmail,
          fileName: fileName || share.file.name,
          senderName: senderName || share.sender.name || share.sender.email
        })
        break

      case 'sms':
        success = await sendSMSNotification({
          deliveryId,
          share,
          recipientEmail,
          fileName: fileName || share.file.name,
          senderName: senderName || share.sender.name || share.sender.email
        })
        break

      default:
        errorMessage = `Unsupported notification channel: ${channel}`
    }

    // Log notification attempt
    await prisma.notificationLog.create({
      data: {
        deliveryId,
        shareId,
        recipientEmail,
        channel,
        status: success ? 'sent' : 'failed',
        errorMessage: success ? null : errorMessage,
        sentAt: new Date()
      }
    })

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Notification sent via ${channel}`
      })
    } else {
      return NextResponse.json({
        success: false,
        error: errorMessage || `Failed to send ${channel} notification`
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Notification send error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function sendEmailNotification({
  deliveryId,
  share,
  recipientEmail,
  fileName,
  senderName,
  shareUrl
}: {
  deliveryId: string
  share: any
  recipientEmail: string
  fileName: string
  senderName: string
  shareUrl: string
}): Promise<boolean> {
  try {
    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    // Generate secure access link
    const accessToken = generateAccessToken(deliveryId, share.id, recipientEmail)
    const accessUrl = `${shareUrl}?token=${accessToken}&share=${share.id}`

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@yourapp.com',
      to: recipientEmail,
      subject: `📎 ${senderName} shared a file with you: ${fileName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New File Shared</h2>
          <p><strong>${senderName}</strong> has shared a file with you:</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${fileName}</h3>
            <p style="margin: 0; color: #666;">
              Size: ${formatFileSize(share.file.size)}<br>
              Shared: ${share.createdAt.toLocaleDateString()}
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${accessUrl}"
               style="background: #007bff; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              📥 View & Download File
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            This link will expire on ${share.expiresAt?.toLocaleDateString() || 'never'}.
            If you have any issues accessing the file, please contact the sender.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px;">
            This is an automated message from FileShare.
            Delivery ID: ${deliveryId}
          </p>
        </div>
      `,
      text: `
New File Shared

${senderName} has shared a file with you: ${fileName}
Size: ${formatFileSize(share.file.size)}
Shared: ${share.createdAt.toLocaleDateString()}

View & Download: ${accessUrl}

This link will expire on ${share.expiresAt?.toLocaleDateString() || 'never'}.
      `
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Email notification error:', error)
    return false
  }
}

async function sendPushNotification({
  deliveryId,
  share,
  recipientEmail,
  fileName,
  senderName
}: {
  deliveryId: string
  share: any
  recipientEmail: string
  fileName: string
  senderName: string
}): Promise<boolean> {
  try {
    // For now, we'll simulate push notifications
    // In production, integrate with FCM, APNs, or similar service

    console.log(`📱 Push notification sent to ${recipientEmail}:`)
    console.log(`   "${senderName} shared: ${fileName}"`)
    console.log(`   Delivery ID: ${deliveryId}`)

    // TODO: Integrate with actual push notification service
    // Example: Firebase Cloud Messaging, OneSignal, etc.

    return true
  } catch (error) {
    console.error('Push notification error:', error)
    return false
  }
}

async function sendSMSNotification({
  deliveryId,
  share,
  recipientEmail,
  fileName,
  senderName
}: {
  deliveryId: string
  share: any
  recipientEmail: string
  fileName: string
  senderName: string
}): Promise<boolean> {
  try {
    // For now, we'll simulate SMS notifications
    // In production, integrate with Twilio, AWS SNS, or similar service

    console.log(`📱 SMS sent to ${recipientEmail}:`)
    console.log(`   "${senderName} shared file: ${fileName}"`)
    console.log(`   Reply with delivery code: ${deliveryId.slice(-6).toUpperCase()}`)

    // TODO: Integrate with actual SMS service
    // Example: Twilio, AWS SNS, MessageBird, etc.

    return true
  } catch (error) {
    console.error('SMS notification error:', error)
    return false
  }
}

function generateAccessToken(deliveryId: string, shareId: string, recipientEmail: string): string {
  // Create a secure token for file access
  const payload = {
    deliveryId,
    shareId,
    recipientEmail,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  }

  // In production, use proper JWT signing
  const token = Buffer.from(JSON.stringify(payload)).toString('base64')
  return token
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}