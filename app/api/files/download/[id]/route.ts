import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { decryptFile } from "@/lib/crypto"
import { canPerformAction, recordFileAccess } from "@/lib/permissions"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { logDownloadEvent, DownloadAction } from "@/lib/download-tracking"
import { logAccessEvent, AccessEventType, AccessResult } from "@/lib/access-tracking"
import { emitSocketEvent } from "@/lib/socket"
import {
  handleApiError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createValidationError,
  createTimeoutError,
  createStorageError,
  createEncryptionError,
  safeDatabaseOperation,
  safeFileOperation,
  withRetry
} from "@/lib/error-handling"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session: any = null
  let fileId = ''
  let share: any = null

  try {
    const authOptions = await getAuthOptions()
    session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      throw createAuthenticationError()
    }

    const { searchParams } = new URL(request.url)
    const decryptionKey = searchParams.get('key')
    const rangeHeader = request.headers.get('range')

    const prisma = await getPrismaClient()
    const resolvedParams = await params
    fileId = resolvedParams.id

    // Check download permission using the new permission system
    const hasDownloadAccess = await canPerformAction(session.user.id, fileId, 'download')
    if (!hasDownloadAccess) {
      throw createAuthorizationError("DOWNLOAD permission required")
    }

    // Get file details and find the share
    const file = await safeDatabaseOperation(
      () => prisma.file.findUnique({ where: { id: fileId } }),
      'Find file'
    ) as any // Type assertion since we know the structure

    if (!file) {
      throw createNotFoundError('File')
    }

    // Find the active share for this user and file
    share = await prisma.fileShare.findFirst({
      where: {
        fileId,
        sharedWithEmail: session.user.email,
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    if (!share) {
      // Check if this is a LAN delivery instead of a regular share
      const lanDelivery = await prisma.fileDelivery.findFirst({
        where: {
          fileId,
          recipientId: session.user.id,
          status: { in: ['PENDING', 'DELIVERED'] },
          expiresAt: { gt: new Date() }
        },
        include: {
          file: true,
          sender: {
            select: { id: true, name: true, email: true }
          }
        }
      })

      if (!lanDelivery) {
        return NextResponse.json({ error: "No active share or delivery found for this file" }, { status: 403 })
      }

      // Use the LAN delivery instead of share for access control
      share = {
        id: lanDelivery.id,
        fileId: lanDelivery.fileId,
        sharedWithEmail: session.user.email,
        permissions: ['VIEW', 'DOWNLOAD'], // LAN deliveries have full access
        expiresAt: lanDelivery.expiresAt,
        revoked: false,
        lanDelivery: true,
        deliveryRecord: lanDelivery
      }
    }

    // Get client info for logging
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Log download attempt
    await logDownloadEvent({
      shareId: share.id,
      userId: session.user.id,
      fileId,
      action: DownloadAction.ATTEMPT,
      ipAddress,
      userAgent,
      metadata: {
        rangeRequest: !!rangeHeader,
        encrypted: file.encrypted
      }
    })

    // Log access event
    await logAccessEvent({
      shareId: share.id,
      userId: session.user.id,
      fileId,
      eventType: AccessEventType.DOWNLOAD,
      ipAddress,
      userAgent,
      metadata: {
        rangeRequest: !!rangeHeader,
        encrypted: file.encrypted
      }
    })

    // Record the download access (only for initial download, not for range requests)
    if (!rangeHeader) {
      await recordFileAccess(session.user.id, fileId, 'download')

      // Audit logging
      await logAuditEvent({
        userId: session.user.id,
        action: AuditAction.FILE_DOWNLOAD,
        resource: 'file',
        resourceId: fileId,
        details: {
          fileName: file.name,
          fileSize: file.size,
          encrypted: file.encrypted,
          rangeRequest: !!rangeHeader
        },
        severity: AuditSeverity.LOW
      })
    }

    // Parse range header for resume functionality
    let startByte = 0
    let endByte = file.size - 1
    let isRangeRequest = false

    if (rangeHeader) {
      const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (rangeMatch) {
        startByte = parseInt(rangeMatch[1])
        const endRange = rangeMatch[2]
        endByte = endRange ? parseInt(endRange) : file.size - 1
        isRangeRequest = true

        // Validate range
        if (startByte >= file.size || endByte >= file.size || startByte > endByte) {
          return NextResponse.json({ error: "Invalid range" }, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${file.size}`
            }
          })
        }
      }
    }

    // Log download start
    await logDownloadEvent({
      shareId: share.id,
      userId: session.user.id,
      fileId,
      action: DownloadAction.START,
      ipAddress,
      userAgent
    })

    // Fetch file from blob storage with timeout
    console.log('Fetching file from storage:', file.url, rangeHeader ? `Range: ${rangeHeader}` : '')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

    let response: Response
    try {
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Privora12-Download/1.0'
      }

      // Add range header to storage request if it's a range request
      if (isRangeRequest) {
        fetchHeaders['Range'] = `bytes=${startByte}-${endByte}`
      }

      response = await fetch(file.url, {
        signal: controller.signal,
        headers: fetchHeaders
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error('File fetch error:', fetchError)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({ error: "Download request timed out. File may be too large or storage is slow." }, { status: 408 })
      }

      return NextResponse.json({
        error: "Failed to fetch file from storage",
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      }, { status: 500 })
    }

    clearTimeout(timeoutId)

    console.log('Storage response status:', response.status)

    if (!response.ok && response.status !== 206) { // 206 is Partial Content for range requests
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('Storage response error:', response.status, errorText)
      return NextResponse.json({
        error: `Failed to fetch file from storage: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: 502 })
    }

    let fileData: ArrayBuffer
    let contentType = file.type
    let fileName = file.name

    // Handle encrypted vs non-encrypted files differently
    if (file.encrypted) {
      if (!decryptionKey) {
        return NextResponse.json({ error: "Decryption key required for encrypted file" }, { status: 400 })
      }

      // For encrypted files, we cannot do range requests since the file is encrypted as a whole
      if (isRangeRequest) {
        return NextResponse.json({ error: "Range requests not supported for encrypted files" }, { status: 416 })
      }

      try {
        // For encrypted files, get as text first
        const encryptedText = await response.text()
        fileData = decryptFile(encryptedText, decryptionKey)
        contentType = file.type // Restore original content type
        fileName = file.originalName || file.name
      } catch (error) {
        console.error('Decryption error:', error)
        return NextResponse.json({
          error: "Failed to decrypt file. Please check your decryption key.",
          details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
        }, { status: 400 })
      }
    } else {
      // For non-encrypted files, get as array buffer
      try {
        fileData = await response.arrayBuffer()
      } catch (error) {
        console.error('File fetch error:', error)
        return NextResponse.json({ error: "Failed to read file data" }, { status: 500 })
      }
    }

    // Prepare response headers
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    }

    let statusCode = 200

    if (isRangeRequest) {
      const contentLength = fileData.byteLength
      headers['Content-Length'] = contentLength.toString()
      headers['Content-Range'] = `bytes ${startByte}-${startByte + contentLength - 1}/${file.size}`
      statusCode = 206 // Partial Content
    } else {
      headers['Content-Length'] = fileData.byteLength.toString()
    }

    // Log successful completion
    await logDownloadEvent({
      shareId: share.id,
      userId: session.user.id,
      fileId,
      action: DownloadAction.COMPLETE,
      ipAddress,
      userAgent,
      metadata: {
        fileSize: fileData.byteLength,
        rangeRequest: !!rangeHeader
      }
    })

    // Log access event completion
    await logAccessEvent({
      shareId: share.id,
      userId: session.user.id,
      fileId,
      eventType: AccessEventType.DOWNLOAD,
      result: AccessResult.SUCCESS,
      ipAddress,
      userAgent,
      bytesTransferred: fileData.byteLength,
      metadata: {
        rangeRequest: !!rangeHeader,
        encrypted: file.encrypted
      }
    })

    // Update LAN delivery status if this was a LAN delivery
    if (share.lanDelivery && share.deliveryRecord) {
      try {
        const updatedDelivery = await prisma.fileDelivery.update({
          where: { id: share.deliveryRecord.id },
          data: {
            status: 'DELIVERED',
            recipientIp: ipAddress,
            deliveredAt: new Date(),
            deliveryAttempts: { increment: 1 },
            updatedAt: new Date()
          }
        })

        // Emit real-time notification for delivery completion
        emitSocketEvent('lan-delivery-completed', {
          deliveryId: updatedDelivery.id,
          fileId: updatedDelivery.fileId,
          senderId: updatedDelivery.senderId,
          recipientId: updatedDelivery.recipientId,
          status: 'delivered',
          deliveredAt: updatedDelivery.deliveredAt?.toISOString(),
          recipientIp: ipAddress
        })

        console.log(`LAN delivery ${updatedDelivery.id} marked as completed`)
      } catch (deliveryUpdateError) {
        console.error('Failed to update LAN delivery status:', deliveryUpdateError)
        // Don't fail the download for delivery status update issues
      }
    }

    // Return file with appropriate headers
    return new NextResponse(fileData, {
      status: statusCode,
      headers
    })

  } catch (error) {
    // Handle error with comprehensive error handling
    const { error: appError, response } = await handleApiError(
      error,
      'File download',
      true
    )

    // Log download failure if we have session info
    if (session?.user?.id) {
      try {
        await logDownloadEvent({
          shareId: share?.id || 'unknown',
          userId: session.user.id,
          fileId,
          action: DownloadAction.FAIL,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          metadata: {
            error: appError.message,
            errorType: appError.type
          }
        })

        // Log access event failure
        if (share?.id) {
          await logAccessEvent({
            shareId: share.id,
            userId: session.user.id,
            fileId,
            eventType: AccessEventType.DOWNLOAD,
            result: AccessResult.FAILURE,
            ipAddress: request.headers.get('x-forwarded-for') || undefined,
            userAgent: request.headers.get('user-agent') || undefined,
            errorMessage: appError.message
          })
        }
      } catch (logError) {
        console.error('Failed to log download failure:', logError)
      }
    }

    return NextResponse.json(response, { status: appError.statusCode })
  }
}