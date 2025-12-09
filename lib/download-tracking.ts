import { getPrismaClient } from './prisma'

export enum DownloadAction {
  ATTEMPT = 'attempt',
  START = 'start',
  COMPLETE = 'complete',
  FAIL = 'fail'
}

export interface DownloadEventData {
  shareId: string
  userId: string
  fileId: string
  action: DownloadAction
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
}

/**
 * Log a download event
 */
export async function logDownloadEvent(data: DownloadEventData): Promise<void> {
  try {
    const prisma = await getPrismaClient()
    if (!prisma) return

    await prisma.downloadLog.create({
      data: {
        shareId: data.shareId,
        userId: data.userId,
        fileId: data.fileId,
        action: data.action,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      }
    })
  } catch (error) {
    console.error('Failed to log download event:', error)
    // Don't throw - logging failures shouldn't break the download
  }
}

/**
 * Get download statistics for a user
 */
export async function getDownloadStats(userId: string, days: number = 30) {
  const prisma = await getPrismaClient()
  if (!prisma) return null

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const stats = await prisma.downloadLog.groupBy({
    by: ['action'],
    where: {
      userId,
      timestamp: { gte: startDate }
    },
    _count: { id: true }
  })

  return stats.reduce((acc: Record<string, number>, stat: any) => {
    acc[stat.action] = stat._count.id
    return acc
  }, {} as Record<string, number>)
}

/**
 * Get download history for a specific file share
 */
export async function getDownloadHistory(shareId: string, limit: number = 50) {
  const prisma = await getPrismaClient()
  if (!prisma) return []

  return await prisma.downloadLog.findMany({
    where: { shareId },
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: {
      user: {
        select: { email: true, name: true }
      }
    }
  })
}