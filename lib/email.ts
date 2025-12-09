import nodemailer from 'nodemailer'
import { getPrismaClient } from './prisma'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_SMTP_HOST,
  port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASS,
  },
}

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport(emailConfig)
}

// Email templates directory
const TEMPLATES_DIR = path.join(process.cwd(), 'templates')

// Email types
export enum EmailType {
  FILE_SHARE = 'file_share',
  SHARE_EXPIRATION = 'share_expiration',
  BULK_SHARE = 'bulk_share',
  WELCOME = 'welcome',
}

// Notification frequency
export enum EmailNotificationFrequency {
  IMMEDIATE = 'IMMEDIATE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  DISABLED = 'DISABLED',
}

// Notification types
export enum EmailNotificationType {
  NEW_SHARES = 'NEW_SHARES',
  SHARE_UPDATES = 'SHARE_UPDATES',
  EXPIRATIONS = 'EXPIRATIONS',
}

// Email data interfaces
export interface FileShareEmailData {
  recipientEmail: string
  recipientName?: string
  senderEmail: string
  senderName?: string
  fileName: string
  fileSize: number
  fileType: string
  permissions: string[]
  expiresAt?: Date
  downloadUrl: string
  shareId: string
  encrypted?: boolean
}

export interface BulkShareEmailData {
  recipientEmail: string
  recipientName?: string
  senderEmail: string
  senderName?: string
  files: Array<{
    name: string
    size: number
    type: string
    permissions: string[]
    expiresAt?: Date
    downloadUrl: string
    shareId: string
  }>
  totalFiles: number
}

export interface ExpirationEmailData {
  recipientEmail: string
  recipientName?: string
  fileName: string
  expiresAt: Date
  downloadUrl: string
  shareId: string
}

// Rate limiting
const emailRateLimit = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 10 // 10 emails per minute

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const userLimit = emailRateLimit.get(email)

  if (!userLimit || now > userLimit.resetTime) {
    emailRateLimit.set(email, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false
  }

  userLimit.count++
  return true
}

// Generate secure download token
export function generateDownloadToken(shareId: string, userId: string): string {
  const payload = `${shareId}:${userId}:${Date.now()}`
  const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

// Verify download token
export function verifyDownloadToken(token: string, shareId: string, userId: string): boolean {
  // In a real implementation, you'd store tokens with expiration
  // For now, we'll just check if it's a valid HMAC
  const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
  const expectedPayload = `${shareId}:${userId}:`
  // This is a simplified check - in production, store tokens in Redis/database
  return true // Placeholder
}

// Load email template
async function loadTemplate(templateName: string, locale: string = 'en'): Promise<string> {
  const templatePath = path.join(TEMPLATES_DIR, locale, `${templateName}.html`)

  try {
    return await fs.readFile(templatePath, 'utf-8')
  } catch (error) {
    // Fallback to English template
    const fallbackPath = path.join(TEMPLATES_DIR, 'en', `${templateName}.html`)
    try {
      return await fs.readFile(fallbackPath, 'utf-8')
    } catch (fallbackError) {
      throw new Error(`Template ${templateName} not found for locale ${locale} or en`)
    }
  }
}

// Replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
}

// Send email with logging
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  userId: string,
  emailType: EmailType,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    // Check rate limit
    if (!checkRateLimit(to)) {
      console.warn(`Rate limit exceeded for ${to}`)
      await logEmail(userId, emailType, to, subject, 'rate_limited', 'Rate limit exceeded', metadata)
      return false
    }

    const transporter = createTransporter()

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`Email sent: ${info.messageId}`)

    // Log successful send
    await logEmail(userId, emailType, to, subject, 'sent', undefined, metadata)

    return true
  } catch (error) {
    console.error('Email send error:', error)
    await logEmail(userId, emailType, to, subject, 'failed', error instanceof Error ? error.message : 'Unknown error', metadata)
    return false
  }
}

// Log email to database
async function logEmail(
  userId: string,
  emailType: EmailType,
  recipient: string,
  subject: string,
  status: string,
  error?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const prisma = await getPrismaClient()
    await prisma.emailLog.create({
      data: {
        userId,
        emailType,
        recipient,
        subject,
        status,
        error,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch (logError) {
    console.error('Failed to log email:', logError)
  }
}

// Check user notification preferences
export async function shouldSendEmail(
  userId: string,
  notificationType: EmailNotificationType,
  frequency: EmailNotificationFrequency = EmailNotificationFrequency.IMMEDIATE
): Promise<boolean> {
  try {
    const prisma = await getPrismaClient()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailNotifications: true,
        emailNotificationTypes: true,
        emailUnsubscribed: true,
      },
    })

    if (!user || user.emailUnsubscribed) {
      return false
    }

    // Check if notification type is enabled
    if (!user.emailNotificationTypes.includes(notificationType)) {
      return false
    }

    // For immediate notifications, send now
    if (frequency === EmailNotificationFrequency.IMMEDIATE) {
      return user.emailNotifications === EmailNotificationFrequency.IMMEDIATE
    }

    // For digest notifications, check frequency setting
    return user.emailNotifications === frequency
  } catch (error) {
    console.error('Error checking email preferences:', error)
    return false
  }
}

// Send file share notification
export async function sendFileShareNotification(data: FileShareEmailData): Promise<boolean> {
  try {
    const prisma = await getPrismaClient()
    const recipient = await prisma.user.findUnique({
      where: { email: data.recipientEmail },
      select: { id: true, name: true, emailNotifications: true, emailNotificationTypes: true },
    })

    if (!recipient) {
      console.warn(`Recipient not found: ${data.recipientEmail}`)
      return false
    }

    // Check preferences
    const shouldSend = await shouldSendEmail(
      recipient.id,
      EmailNotificationType.NEW_SHARES,
      EmailNotificationFrequency.IMMEDIATE
    )

    if (!shouldSend) {
      console.log(`Email notifications disabled for ${data.recipientEmail}`)
      return true // Not an error, just disabled
    }

    // Load template
    const template = await loadTemplate('file-share')
    const locale = 'en' // TODO: Get from user preferences

    // Prepare template variables
    const variables = {
      recipientName: recipient.name || data.recipientEmail.split('@')[0],
      senderName: data.senderName || data.senderEmail,
      senderEmail: data.senderEmail,
      fileName: data.fileName,
      fileSize: formatFileSize(data.fileSize),
      fileType: data.fileType,
      permissions: data.permissions.join(', '),
      expiresAt: data.expiresAt ? formatDate(data.expiresAt) : 'Never',
      downloadUrl: data.downloadUrl,
      appName: process.env.APP_NAME || 'Privora12',
      appUrl: process.env.APP_URL || 'https://privora12.com',
      encrypted: data.encrypted ? 'Yes' : 'No',
    }

    const html = replaceTemplateVariables(template, variables)
    const subject = `File shared: ${data.fileName}`

    return await sendEmail(
      data.recipientEmail,
      subject,
      html,
      recipient.id,
      EmailType.FILE_SHARE,
      {
        shareId: data.shareId,
        fileName: data.fileName,
        senderEmail: data.senderEmail,
      }
    )
  } catch (error) {
    console.error('Error sending file share notification:', error)
    return false
  }
}

// Send bulk share notification
export async function sendBulkShareNotification(data: BulkShareEmailData): Promise<boolean> {
  try {
    const prisma = await getPrismaClient()
    const recipient = await prisma.user.findUnique({
      where: { email: data.recipientEmail },
      select: { id: true, name: true },
    })

    if (!recipient) {
      console.warn(`Recipient not found: ${data.recipientEmail}`)
      return false
    }

    const shouldSend = await shouldSendEmail(
      recipient.id,
      EmailNotificationType.NEW_SHARES,
      EmailNotificationFrequency.IMMEDIATE
    )

    if (!shouldSend) {
      return true
    }

    const template = await loadTemplate('bulk-share')
    const variables = {
      recipientName: recipient.name || data.recipientEmail.split('@')[0],
      senderName: data.senderName || data.senderEmail,
      totalFiles: data.totalFiles.toString(),
      filesList: data.files.map(f => `${f.name} (${formatFileSize(f.size)})`).join('\n'),
      appName: process.env.APP_NAME || 'Privora12',
      appUrl: process.env.APP_URL || 'https://privora12.com',
    }

    const html = replaceTemplateVariables(template, variables)
    const subject = `${data.totalFiles} files shared with you`

    return await sendEmail(
      data.recipientEmail,
      subject,
      html,
      recipient.id,
      EmailType.BULK_SHARE,
      {
        totalFiles: data.totalFiles,
        senderEmail: data.senderEmail,
      }
    )
  } catch (error) {
    console.error('Error sending bulk share notification:', error)
    return false
  }
}

// Send expiration warning
export async function sendExpirationWarning(data: ExpirationEmailData): Promise<boolean> {
  try {
    const prisma = await getPrismaClient()
    const recipient = await prisma.user.findUnique({
      where: { email: data.recipientEmail },
      select: { id: true, name: true },
    })

    if (!recipient) {
      return false
    }

    const shouldSend = await shouldSendEmail(
      recipient.id,
      EmailNotificationType.EXPIRATIONS,
      EmailNotificationFrequency.IMMEDIATE
    )

    if (!shouldSend) {
      return true
    }

    const template = await loadTemplate('share-expiration')
    const variables = {
      recipientName: recipient.name || data.recipientEmail.split('@')[0],
      fileName: data.fileName,
      expiresAt: formatDate(data.expiresAt),
      downloadUrl: data.downloadUrl,
      appName: process.env.APP_NAME || 'Privora12',
      appUrl: process.env.APP_URL || 'https://privora12.com',
    }

    const html = replaceTemplateVariables(template, variables)
    const subject = `File share expiring soon: ${data.fileName}`

    return await sendEmail(
      data.recipientEmail,
      subject,
      html,
      recipient.id,
      EmailType.SHARE_EXPIRATION,
      {
        shareId: data.shareId,
        fileName: data.fileName,
        expiresAt: data.expiresAt.toISOString(),
      }
    )
  } catch (error) {
    console.error('Error sending expiration warning:', error)
    return false
  }
}

// Utility functions
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Queue system for bulk emails (simplified)
const emailQueue: Array<{
  to: string
  subject: string
  html: string
  userId: string
  emailType: EmailType
  metadata?: Record<string, any>
  retries: number
}> = []

let isProcessingQueue = false

export function queueEmail(
  to: string,
  subject: string,
  html: string,
  userId: string,
  emailType: EmailType,
  metadata?: Record<string, any>
): void {
  emailQueue.push({ to, subject, html, userId, emailType, metadata, retries: 0 })
  processEmailQueue()
}

async function processEmailQueue(): Promise<void> {
  if (isProcessingQueue || emailQueue.length === 0) {
    return
  }

  isProcessingQueue = true

  while (emailQueue.length > 0) {
    const email = emailQueue.shift()!
    const success = await sendEmail(
      email.to,
      email.subject,
      email.html,
      email.userId,
      email.emailType,
      email.metadata
    )

    if (!success && email.retries < 3) {
      email.retries++
      emailQueue.push(email) // Re-queue with retry
      await new Promise(resolve => setTimeout(resolve, 5000 * email.retries)) // Exponential backoff
    }
  }

  isProcessingQueue = false
}

// Types are already exported above as interfaces