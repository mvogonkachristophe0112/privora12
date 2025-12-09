import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    if (!prisma) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days
    const days = Math.min(365, Math.max(1, parseInt(period)))

    const userEmail = session.user.email.trim().toLowerCase()
    const stats = await getReceivedFilesStats(prisma, userEmail, days)

    return NextResponse.json(stats)

  } catch (error) {
    console.error('GET /api/files/received/stats error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function getReceivedFilesStats(prisma: any, userEmail: string, days: number = 30) {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const [
    totalReceived,
    acceptedCount,
    rejectedCount,
    expiredCount,
    pendingCount,
    recentShares,
    senderStats,
    fileTypeStats,
    downloadStats,
    totalFileSize,
    averageFileSize
  ] = await Promise.all([
    // Total received files
    prisma.fileShare.count({
      where: { sharedWithEmail: userEmail, revoked: false }
    }),

    // Status counts
    prisma.fileShare.count({
      where: { sharedWithEmail: userEmail, status: 'ACCEPTED', revoked: false }
    }),
    prisma.fileShare.count({
      where: { sharedWithEmail: userEmail, status: 'REJECTED', revoked: false }
    }),
    prisma.fileShare.count({
      where: {
        sharedWithEmail: userEmail,
        OR: [
          { status: 'EXPIRED' },
          {
            expiresAt: { lte: new Date() },
            status: { not: 'EXPIRED' }
          }
        ],
        revoked: false
      }
    }),
    prisma.fileShare.count({
      where: { sharedWithEmail: userEmail, status: 'PENDING', revoked: false }
    }),

    // Recent shares
    prisma.fileShare.count({
      where: {
        sharedWithEmail: userEmail,
        createdAt: { gte: startDate },
        revoked: false
      }
    }),

    // Top senders
    prisma.fileShare.groupBy({
      by: ['createdBy'],
      where: { sharedWithEmail: userEmail, revoked: false },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    }),

    // File type distribution
    prisma.file.groupBy({
      by: ['type'],
      where: {
        shares: {
          some: {
            sharedWithEmail: userEmail,
            revoked: false
          }
        }
      },
      _count: { id: true },
      _sum: { size: true }
    }),

    // Download stats from DownloadLog
    prisma.downloadLog.aggregate({
      where: {
        share: { sharedWithEmail: userEmail },
        action: 'complete',
        timestamp: { gte: startDate }
      },
      _count: { id: true }
    }),

    // Total file size received
    prisma.file.aggregate({
      where: {
        shares: {
          some: {
            sharedWithEmail: userEmail,
            revoked: false
          }
        }
      },
      _sum: { size: true }
    }),

    // Average file size
    prisma.file.aggregate({
      where: {
        shares: {
          some: {
            sharedWithEmail: userEmail,
            revoked: false
          }
        }
      },
      _avg: { size: true }
    })
  ])

  // Process sender stats with user info
  const senderStatsWithNames = await Promise.all(
    senderStats.map(async (stat: any) => {
      const user = await prisma.user.findUnique({
        where: { id: stat.createdBy },
        select: { email: true, name: true }
      })
      return {
        email: user?.email || 'Unknown',
        name: user?.name || 'Unknown',
        count: stat._count.id
      }
    })
  )

  // Process file type stats
  const fileTypeBreakdown = fileTypeStats.map((stat: any) => ({
    type: stat.type || 'unknown',
    count: stat._count.id,
    totalSize: stat._sum.size || 0
  }))

  // Calculate acceptance rate
  const totalProcessed = acceptedCount + rejectedCount
  const acceptanceRate = totalProcessed > 0 ? (acceptedCount / totalProcessed) * 100 : 0

  return {
    overview: {
      totalReceived,
      totalProcessed,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      totalDownloads: downloadStats._count.id,
      totalFileSize: totalFileSize._sum.size || 0,
      averageFileSize: Math.round(averageFileSize._avg.size || 0)
    },
    statusBreakdown: {
      pending: pendingCount,
      accepted: acceptedCount,
      rejected: rejectedCount,
      expired: expiredCount
    },
    activity: {
      periodDays: days,
      recentShares,
      recentDownloads: downloadStats._count.id
    },
    topSenders: senderStatsWithNames,
    fileTypes: fileTypeBreakdown,
    generatedAt: new Date().toISOString()
  }
}