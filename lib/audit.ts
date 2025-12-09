import { getPrismaClient } from './prisma'

export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_DOWNLOAD = 'FILE_DOWNLOAD',
  FILE_DELETE = 'FILE_DELETE',
  FILE_SHARE = 'FILE_SHARE',
  FILE_ACCESS = 'FILE_ACCESS',
  FILE_VIEW = 'FILE_VIEW',
  FILE_EDIT = 'FILE_EDIT',
  FILE_VERSION_CREATE = 'FILE_VERSION_CREATE',
  GROUP_CREATE = 'GROUP_CREATE',
  GROUP_JOIN = 'GROUP_JOIN',
  SHARE_ACCESS = 'SHARE_ACCESS',
  SHARE_EXPIRE = 'SHARE_EXPIRE',
  SHARE_ACCEPT = 'SHARE_ACCEPT',
  SHARE_REJECT = 'SHARE_REJECT',
  SHARE_REVOKE = 'SHARE_REVOKE',
  BULK_SHARE_OPERATION = 'BULK_SHARE_OPERATION',
  MESSAGE_SEND = 'MESSAGE_SEND',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
  ADMIN_ACTION = 'ADMIN_ACTION',
  SECURITY_EVENT = 'SECURITY_EVENT'
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export type AuditDetails = string | { type?: string; [key: string]: any };

export interface AuditLogData {
  userId?: string
  action: AuditAction
  resource?: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  severity?: AuditSeverity
}

export async function logAuditEvent(data: AuditLogData) {
  try {
    const prisma = await getPrismaClient()
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: JSON.stringify(data.details || {}),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        severity: data.severity || AuditSeverity.LOW,
      }
    })
  } catch (error) {
    console.error('Failed to log audit event:', error)
    // Don't throw - audit logging shouldn't break the main flow
  }
}

export async function getAuditLogs(options: {
  userId?: string
  action?: AuditAction
  resource?: string
  severity?: AuditSeverity
  limit?: number
  offset?: number
  startDate?: Date
  endDate?: Date
}) {
  const {
    userId,
    action,
    resource,
    severity,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = options

  const prisma = await getPrismaClient()
  return await prisma.auditLog.findMany({
    where: {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(resource && { resource }),
      ...(severity && { severity }),
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate })
        }
      } : {})
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit,
    skip: offset
  })
}

export async function getAuditStats(options: {
  startDate?: Date
  endDate?: Date
}) {
  const { startDate, endDate } = options

  const baseWhere = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate })
    }
  } : {}

  const prisma = await getPrismaClient()
  const [totalEvents, eventsByAction, eventsBySeverity, recentEvents] = await Promise.all([
    prisma.auditLog.count({ where: baseWhere }),

    prisma.auditLog.groupBy({
      by: ['action'],
      where: baseWhere,
      _count: true,
      orderBy: { _count: { action: 'desc' } }
    }),

    prisma.auditLog.groupBy({
      by: ['severity'],
      where: baseWhere,
      _count: true
    }),

    prisma.auditLog.findMany({
      where: baseWhere,
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ])

  return {
    totalEvents,
    eventsByAction,
    eventsBySeverity,
    recentEvents
  }
}

// Security monitoring functions
function parseDetails(details: unknown): any | undefined {
  if (!details) return undefined;
  if (typeof details === 'string') {
    try {
      return JSON.parse(details);
    } catch {
      // Not JSON; nothing to read
      return undefined;
    }
  }
  return details;
}

export async function detectSuspiciousActivity(userId: string) {
  const prisma = await getPrismaClient()
  const recentLogs = await prisma.auditLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const failedLogins = recentLogs.filter((log: any) => {
    if (log.action !== AuditAction.SECURITY_EVENT) return false;
    if (typeof log.details !== 'object' || log.details === null) return false;
    const details = log.details as Record<string, unknown>;
    return details.type === 'failed_login';
  }).length

  const unusualDownloads = recentLogs.filter((log: any) =>
    log.action === AuditAction.FILE_DOWNLOAD
  ).length

  // Flag suspicious activity
  if (failedLogins > 5) {
    await logAuditEvent({
      userId,
      action: AuditAction.SECURITY_EVENT,
      severity: AuditSeverity.HIGH,
      details: {
        type: 'multiple_failed_logins',
        count: failedLogins
      }
    })
  }

  if (unusualDownloads > 100) {
    await logAuditEvent({
      userId,
      action: AuditAction.SECURITY_EVENT,
      severity: AuditSeverity.MEDIUM,
      details: {
        type: 'unusual_download_activity',
        count: unusualDownloads
      }
    })
  }
}

// Helper functions for received file operations
export async function logShareAcceptance(userId: string, shareId: string, fileName: string, ipAddress?: string, userAgent?: string) {
  await logAuditEvent({
    userId,
    action: AuditAction.SHARE_ACCEPT,
    resource: 'file_share',
    resourceId: shareId,
    details: {
      fileName,
      operation: 'accept'
    },
    ipAddress,
    userAgent,
    severity: AuditSeverity.LOW
  })
}

export async function logShareRejection(userId: string, shareId: string, fileName: string, ipAddress?: string, userAgent?: string) {
  await logAuditEvent({
    userId,
    action: AuditAction.SHARE_REJECT,
    resource: 'file_share',
    resourceId: shareId,
    details: {
      fileName,
      operation: 'reject'
    },
    ipAddress,
    userAgent,
    severity: AuditSeverity.LOW
  })
}

export async function logShareRevocation(userId: string, shareId: string, fileName: string, reason?: string) {
  await logAuditEvent({
    userId,
    action: AuditAction.SHARE_REVOKE,
    resource: 'file_share',
    resourceId: shareId,
    details: {
      fileName,
      operation: 'revoke',
      reason: reason || 'user_action'
    },
    severity: AuditSeverity.MEDIUM
  })
}

export async function logBulkShareOperation(userId: string, operation: string, shareIds: string[], successCount: number, failureCount: number) {
  await logAuditEvent({
    userId,
    action: AuditAction.BULK_SHARE_OPERATION,
    resource: 'file_share',
    details: {
      operation,
      totalShares: shareIds.length,
      successCount,
      failureCount,
      shareIds: shareIds.slice(0, 10) // Log first 10 for reference
    },
    severity: failureCount > 0 ? AuditSeverity.MEDIUM : AuditSeverity.LOW
  })
}