import { getPrismaClient } from './prisma'
import { logAuditEvent, AuditAction, AuditSeverity } from './audit'

export enum AccessEventType {
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  PREVIEW = 'PREVIEW',
  SHARE_ACCESS = 'SHARE_ACCESS',
  BULK_OPERATION = 'BULK_OPERATION',
  ACCESS_DENIED = 'ACCESS_DENIED'
}

export enum AccessResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PARTIAL = 'PARTIAL'
}

export interface AccessEventData {
  shareId: string
  userId: string
  fileId: string
  eventType: AccessEventType
  result?: AccessResult
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  duration?: number
  bytesTransferred?: number
  errorMessage?: string
  metadata?: Record<string, any>
}

/**
 * Anonymize IP address for privacy compliance
 */
export function anonymizeIpAddress(ip: string): string {
  if (!ip) return ip

  // IPv4: keep first 3 octets, mask last octet
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`
    }
  }

  // IPv6: keep first 4 segments, mask the rest
  if (ip.includes(':')) {
    const parts = ip.split(':')
    if (parts.length >= 4) {
      return `${parts.slice(0, 4).join(':')}:0000:0000:0000:0000`
    }
  }

  return ip
}

/**
 * Extract device and browser info from user agent
 */
export function parseUserAgent(userAgent: string): {
  deviceType: string
  browser: string
  os: string
} {
  if (!userAgent) {
    return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' }
  }

  const ua = userAgent.toLowerCase()

  // Device type detection
  let deviceType = 'desktop'
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile'
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet'
  }

  // Browser detection
  let browser = 'unknown'
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'chrome'
  } else if (ua.includes('firefox')) {
    browser = 'firefox'
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'safari'
  } else if (ua.includes('edg')) {
    browser = 'edge'
  } else if (ua.includes('opera')) {
    browser = 'opera'
  }

  // OS detection
  let os = 'unknown'
  if (ua.includes('windows')) {
    os = 'windows'
  } else if (ua.includes('mac os') || ua.includes('macos')) {
    os = 'macos'
  } else if (ua.includes('linux')) {
    os = 'linux'
  } else if (ua.includes('android')) {
    os = 'android'
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'ios'
  }

  return { deviceType, browser, os }
}

/**
 * Log a file access event
 */
export async function logAccessEvent(data: AccessEventData): Promise<void> {
  try {
    const prisma = await getPrismaClient()
    if (!prisma) return

    const { deviceType, browser, os } = parseUserAgent(data.userAgent || '')
    const anonymizedIp = data.ipAddress ? anonymizeIpAddress(data.ipAddress) : undefined

    // Create access log entry
    await prisma.fileAccessLog.create({
      data: {
        shareId: data.shareId,
        userId: data.userId,
        fileId: data.fileId,
        eventType: data.eventType,
        result: data.result || AccessResult.SUCCESS,
        ipAddress: anonymizedIp,
        userAgent: data.userAgent,
        deviceType,
        browser,
        os,
        sessionId: data.sessionId,
        duration: data.duration,
        bytesTransferred: data.bytesTransferred,
        errorMessage: data.errorMessage,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      }
    })

    // Update share counters
    const updateData: any = {
      lastAccessedAt: new Date()
    }

    switch (data.eventType) {
      case AccessEventType.VIEW:
      case AccessEventType.PREVIEW:
        updateData.viewCount = { increment: 1 }
        break
      case AccessEventType.DOWNLOAD:
        updateData.downloadCount = { increment: 1 }
        break
    }

    updateData.accessCount = { increment: 1 }

    await prisma.fileShare.update({
      where: { id: data.shareId },
      data: updateData
    })

    // Log to audit system for significant events
    if (data.eventType === AccessEventType.ACCESS_DENIED ||
        data.result === AccessResult.FAILURE) {
      await logAuditEvent({
        userId: data.userId,
        action: AuditAction.SECURITY_EVENT,
        resource: 'file_share',
        resourceId: data.shareId,
        severity: data.eventType === AccessEventType.ACCESS_DENIED ?
          AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        details: {
          type: 'file_access_event',
          eventType: data.eventType,
          result: data.result,
          errorMessage: data.errorMessage
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      })
    }

  } catch (error) {
    console.error('Failed to log access event:', error)
    // Don't throw - access logging shouldn't break the main flow
  }
}

/**
 * Get access statistics for a user
 */
export async function getAccessStats(userId: string, options: {
  startDate?: Date
  endDate?: Date
  shareId?: string
} = {}) {
  const prisma = await getPrismaClient()
  if (!prisma) return null

  const { startDate, endDate, shareId } = options
  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate })
    }
  } : {}

  const shareFilter = shareId ? { shareId } : {}

  const [
    totalAccesses,
    accessesByType,
    accessesByResult,
    accessesByDevice,
    recentAccesses,
    topFiles
  ] = await Promise.all([
    // Total accesses
    prisma.fileAccessLog.count({
      where: { userId, ...dateFilter, ...shareFilter }
    }),

    // Accesses by type
    prisma.fileAccessLog.groupBy({
      by: ['eventType'],
      where: { userId, ...dateFilter, ...shareFilter },
      _count: true
    }),

    // Accesses by result
    prisma.fileAccessLog.groupBy({
      by: ['result'],
      where: { userId, ...dateFilter, ...shareFilter },
      _count: true
    }),

    // Accesses by device type
    prisma.fileAccessLog.groupBy({
      by: ['deviceType'],
      where: { userId, ...dateFilter, ...shareFilter },
      _count: true
    }),

    // Recent accesses
    prisma.fileAccessLog.findMany({
      where: { userId, ...dateFilter, ...shareFilter },
      include: {
        share: {
          include: {
            file: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),

    // Top accessed files
    prisma.fileAccessLog.groupBy({
      by: ['fileId'],
      where: { userId, ...dateFilter, ...shareFilter },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 5
    })
  ])

  return {
    totalAccesses,
    accessesByType: accessesByType.reduce((acc: Record<string, number>, item: any) => {
      acc[item.eventType] = item._count
      return acc
    }, {}),
    accessesByResult: accessesByResult.reduce((acc: Record<string, number>, item: any) => {
      acc[item.result] = item._count
      return acc
    }, {}),
    accessesByDevice: accessesByDevice.reduce((acc: Record<string, number>, item: any) => {
      acc[item.deviceType || 'unknown'] = item._count
      return acc
    }, {}),
    recentAccesses,
    topFiles: await Promise.all(
      topFiles.map(async (item: any) => {
        const file = await prisma.file.findUnique({
          where: { id: item.fileId },
          select: { name: true, size: true, type: true }
        })
        return {
          fileId: item.fileId,
          name: file?.name || 'Unknown',
          size: file?.size || 0,
          type: file?.type || 'unknown',
          accessCount: item._count
        }
      })
    )
  }
}

/**
 * Get access logs with filtering and pagination
 */
export async function getAccessLogs(options: {
  userId?: string
  shareId?: string
  eventType?: AccessEventType
  result?: AccessResult
  limit?: number
  offset?: number
  startDate?: Date
  endDate?: Date
}) {
  const {
    userId,
    shareId,
    eventType,
    result,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = options

  const prisma = await getPrismaClient()
  if (!prisma) return { logs: [], total: 0 }

  const where: any = {
    ...(userId && { userId }),
    ...(shareId && { shareId }),
    ...(eventType && { eventType }),
    ...(result && { result }),
    ...(startDate || endDate ? {
      createdAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate })
      }
    } : {})
  }

  const [logs, total] = await Promise.all([
    prisma.fileAccessLog.findMany({
      where,
      include: {
        share: {
          include: {
            file: true,
            creator: {
              select: { email: true, name: true }
            }
          }
        },
        user: {
          select: { email: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.fileAccessLog.count({ where })
  ])

  return { logs, total }
}

/**
 * Clean up old access logs based on retention policy
 */
export async function cleanupOldAccessLogs(retentionDays: number = 90): Promise<number> {
  const prisma = await getPrismaClient()
  if (!prisma) return 0

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const result = await prisma.fileAccessLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  })

  return result.count
}

/**
 * Get analytics data for admin dashboard
 */
export async function getAccessAnalytics(options: {
  startDate?: Date
  endDate?: Date
  groupBy?: 'day' | 'week' | 'month'
} = {}) {
  const prisma = await getPrismaClient()
  if (!prisma) return null

  const { startDate, endDate, groupBy = 'day' } = options

  // Build date filter
  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate })
    }
  } : {}

  const [
    totalEvents,
    eventsByType,
    eventsByResult,
    topUsers,
    topFiles,
    geographicData,
    timeSeriesData
  ] = await Promise.all([
    // Total events
    prisma.fileAccessLog.count({ where: dateFilter }),

    // Events by type
    prisma.fileAccessLog.groupBy({
      by: ['eventType'],
      where: dateFilter,
      _count: true
    }),

    // Events by result
    prisma.fileAccessLog.groupBy({
      by: ['result'],
      where: dateFilter,
      _count: true
    }),

    // Top users by access count
    prisma.fileAccessLog.groupBy({
      by: ['userId'],
      where: dateFilter,
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 10
    }),

    // Top files by access count
    prisma.fileAccessLog.groupBy({
      by: ['fileId'],
      where: dateFilter,
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 10
    }),

    // Geographic distribution (by anonymized IP)
    prisma.fileAccessLog.groupBy({
      by: ['ipAddress'],
      where: { ...dateFilter, ipAddress: { not: null } },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 20
    }),

    // Time series data
    getTimeSeriesData(prisma, dateFilter, groupBy)
  ])

  return {
    totalEvents,
    eventsByType: eventsByType.reduce((acc: Record<string, number>, item: any) => {
      acc[item.eventType] = item._count
      return acc
    }, {}),
    eventsByResult: eventsByResult.reduce((acc: Record<string, number>, item: any) => {
      acc[item.result] = item._count
      return acc
    }, {}),
    topUsers: await Promise.all(
      topUsers.map(async (item: any) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { email: true, name: true }
        })
        return {
          userId: item.userId,
          email: user?.email || 'Unknown',
          name: user?.name || 'Unknown',
          accessCount: item._count
        }
      })
    ),
    topFiles: await Promise.all(
      topFiles.map(async (item: any) => {
        const file = await prisma.file.findUnique({
          where: { id: item.fileId },
          select: { name: true, size: true, type: true }
        })
        return {
          fileId: item.fileId,
          name: file?.name || 'Unknown',
          size: file?.size || 0,
          type: file?.type || 'unknown',
          accessCount: item._count
        }
      })
    ),
    geographicData: geographicData.map((item: any) => ({
      location: item.ipAddress,
      count: item._count
    })),
    timeSeriesData
  }
}

/**
 * Helper function to get time series data
 */
async function getTimeSeriesData(prisma: any, dateFilter: any, groupBy: string) {
  const groupByClause = groupBy === 'month'
    ? 'DATE_TRUNC(\'month\', "createdAt")'
    : groupBy === 'week'
    ? 'DATE_TRUNC(\'week\', "createdAt")'
    : 'DATE_TRUNC(\'day\', "createdAt")'

  const result = await prisma.$queryRaw`
    SELECT
      ${groupByClause} as period,
      COUNT(*) as count
    FROM "FileAccessLog"
    WHERE ${dateFilter.createdAt ? `"createdAt" >= ${dateFilter.createdAt.gte} AND "createdAt" <= ${dateFilter.createdAt.lte}` : 'TRUE'}
    GROUP BY period
    ORDER BY period ASC
  `

  return result
}