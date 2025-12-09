import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getAccessStats, getAccessAnalytics } from "@/lib/access-tracking"

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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'day'
    const includeAdminStats = searchParams.get('includeAdminStats') === 'true'

    // Validate date formats
    if (startDate && isNaN(Date.parse(startDate))) {
      return NextResponse.json({ error: "Invalid startDate format. Use ISO 8601 format." }, { status: 400 })
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      return NextResponse.json({ error: "Invalid endDate format. Use ISO 8601 format." }, { status: 400 })
    }

    // Validate groupBy
    const validGroupBy = ['day', 'week', 'month']
    if (!validGroupBy.includes(groupBy)) {
      return NextResponse.json({
        error: `Invalid groupBy. Must be one of: ${validGroupBy.join(', ')}`
      }, { status: 400 })
    }

    const dateFilter = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    }

    // Get user-specific access statistics
    const userStats = await getAccessStats(session.user.id, {
      shareId: shareId || undefined,
      ...dateFilter
    })

    const response: any = {
      userStats,
      dateRange: {
        startDate: dateFilter.startDate?.toISOString(),
        endDate: dateFilter.endDate?.toISOString()
      }
    }

    // Include admin-level analytics if requested and user is admin
    if (includeAdminStats && session.user.role === 'admin') {
      const adminAnalytics = await getAccessAnalytics({
        ...dateFilter,
        groupBy: groupBy as 'day' | 'week' | 'month'
      })
      response.adminAnalytics = adminAnalytics
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('GET /api/files/received/analytics error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Export functionality for CSV/JSON
export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { exportType, filters } = await request.json()

    if (!['csv', 'json'].includes(exportType)) {
      return NextResponse.json({ error: "Invalid export type. Must be 'csv' or 'json'" }, { status: 400 })
    }

    // Get access logs with filters
    const { getAccessLogs } = await import('@/lib/access-tracking')
    const { logs } = await getAccessLogs({
      userId: session.user.id,
      ...filters
    })

    if (exportType === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Timestamp',
        'File Name',
        'Sender',
        'Event Type',
        'Result',
        'Device Type',
        'Browser',
        'OS',
        'Duration (seconds)',
        'Bytes Transferred',
        'IP Address'
      ]

      const csvRows = logs.map((log: any) => [
        log.createdAt.toISOString(),
        log.share.file.name,
        log.share.creator.email,
        log.eventType,
        log.result,
        log.deviceType,
        log.browser,
        log.os,
        log.duration || '',
        log.bytesTransferred || '',
        log.ipAddress || ''
      ])

      const csvContent = [csvHeaders, ...csvRows]
        .map((row: any) => row.map((field: any) => `"${field}"`).join(','))
        .join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="access-logs.csv"'
        }
      })
    } else {
      // Return JSON
      const jsonData = logs.map((log: any) => ({
        timestamp: log.createdAt.toISOString(),
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
        ipAddress: log.ipAddress,
        errorMessage: log.errorMessage
      }))

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="access-logs.json"'
        }
      })
    }

  } catch (error) {
    console.error('POST /api/files/received/analytics error:', error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}