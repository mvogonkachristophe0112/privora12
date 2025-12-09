import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getAccessLogs } from "@/lib/access-tracking"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const shareId = searchParams.get('shareId')
    const eventType = searchParams.get('eventType')
    const result = searchParams.get('result')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Validate date formats
    if (startDate && isNaN(Date.parse(startDate))) {
      return NextResponse.json({ error: "Invalid startDate format. Use ISO 8601 format." }, { status: 400 })
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      return NextResponse.json({ error: "Invalid endDate format. Use ISO 8601 format." }, { status: 400 })
    }

    // Validate eventType
    const validEventTypes = ['VIEW', 'DOWNLOAD', 'PREVIEW', 'SHARE_ACCESS', 'BULK_OPERATION', 'ACCESS_DENIED']
    if (eventType && !validEventTypes.includes(eventType)) {
      return NextResponse.json({
        error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}`
      }, { status: 400 })
    }

    // Validate result
    const validResults = ['SUCCESS', 'FAILURE', 'PARTIAL']
    if (result && !validResults.includes(result)) {
      return NextResponse.json({
        error: `Invalid result. Must be one of: ${validResults.join(', ')}`
      }, { status: 400 })
    }

    const options = {
      userId: session.user.id,
      shareId: shareId || undefined,
      eventType: eventType as any,
      result: result as any,
      limit,
      offset,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    }

    const { logs, total } = await getAccessLogs(options)

    // Transform logs for client consumption
    const transformedLogs = logs.map((log: any) => ({
      id: log.id,
      shareId: log.shareId,
      fileId: log.fileId,
      fileName: log.share.file.name,
      senderEmail: log.share.creator.email,
      senderName: log.share.creator.name,
      eventType: log.eventType,
      result: log.result,
      deviceType: log.deviceType,
      browser: log.browser,
      os: log.os,
      duration: log.duration,
      bytesTransferred: log.bytesTransferred,
      errorMessage: log.errorMessage,
      timestamp: log.createdAt.toISOString(),
      ipAddress: log.ipAddress // Anonymized
    }))

    return NextResponse.json({
      logs: transformedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      filters: {
        applied: {
          shareId,
          eventType,
          result,
          startDate,
          endDate
        }
      }
    })

  } catch (error) {
    console.error('GET /api/files/received/access-logs error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}