import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { decryptFile } from "@/lib/crypto"
import { canPerformAction, recordFileAccess } from "@/lib/permissions"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { logDownloadEvent, DownloadAction } from "@/lib/download-tracking"
import { logAccessEvent, AccessEventType, AccessResult } from "@/lib/access-tracking"

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      return NextResponse.json({ error: "Access denied: DOWNLOAD permission required" }, { status: 403 })
    }

    // Get file details and find the share
    const file = await prisma.file.findUnique({
      where: { id: fileId }
    })

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
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
      return NextResponse.json({ error: "No active share found for this file" }, { status: 403 })
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

    // Return file with appropriate headers
    return new NextResponse(fileData, {
      status: statusCode,
      headers
    })

  } catch (error) {
    console.error('GET /api/files/download/[id] error:', error)

    // Log download failure
    try {
      await logDownloadEvent({
        shareId: share?.id || 'unknown',
        userId: session.user.id,
        fileId,
        action: DownloadAction.FAIL,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
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
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      console.error('Failed to log download failure:', logError)
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}