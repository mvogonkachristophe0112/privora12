import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { logAccessEvent, AccessEventType } from "@/lib/access-tracking"
import { logShareAcceptance, logShareRejection, logShareRevocation, logBulkShareOperation } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.error('No session or email:', { session })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    if (!prisma) {
      console.error('Prisma client not available')
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const normalizedUserEmail = session.user.email.trim().toLowerCase()

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Advanced filtering parameters with validation
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Validate date formats
    if (dateFrom && isNaN(Date.parse(dateFrom))) {
      return NextResponse.json({ error: "Invalid dateFrom format. Use ISO 8601 format." }, { status: 400 })
    }
    if (dateTo && isNaN(Date.parse(dateTo))) {
      return NextResponse.json({ error: "Invalid dateTo format. Use ISO 8601 format." }, { status: 400 })
    }
    const permissions = searchParams.get('permissions')?.split(',').filter(p => p.trim() && ['VIEW', 'DOWNLOAD', 'EDIT'].includes(p.toUpperCase()))
    const minSize = searchParams.get('minSize') ? Math.max(0, parseInt(searchParams.get('minSize')!)) : null
    const maxSize = searchParams.get('maxSize') ? Math.max(0, parseInt(searchParams.get('maxSize')!)) : null
    const sender = searchParams.get('sender')?.trim().substring(0, 100) // Limit length
    const fileType = searchParams.get('fileType')?.trim().substring(0, 100)
    const status = searchParams.get('status')?.toUpperCase()
    if (status && !['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be PENDING, ACCEPTED, REJECTED, or EXPIRED" }, { status: 400 })
    }

    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = (searchParams.get('sortOrder') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    // Statistics parameter
    const includeStats = searchParams.get('includeStats') === 'true'

    // Build where clause
    const where: any = {
      sharedWithEmail: normalizedUserEmail,
      revoked: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }

    // Add filters
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    if (permissions && permissions.length > 0) {
      where.permissions = { hasSome: permissions }
    }

    if (minSize !== null || maxSize !== null) {
      where.file = { size: {} }
      if (minSize !== null) where.file.size.gte = minSize
      if (maxSize !== null) where.file.size.lte = maxSize
    }

    if (sender) {
      where.file = {
        ...where.file,
        user: {
          OR: [
            { email: { contains: sender, mode: 'insensitive' } },
            { name: { contains: sender, mode: 'insensitive' } }
          ]
        }
      }
    }

    if (fileType) {
      where.file = {
        ...where.file,
        OR: [
          { type: { contains: fileType, mode: 'insensitive' } },
          { fileType: { contains: fileType, mode: 'insensitive' } }
        ]
      }
    }

    if (status) {
      where.status = status
    }

    // Build orderBy
    let orderBy: any = { createdAt: sortOrder }
    switch (sortBy) {
      case 'name':
        orderBy = { file: { name: sortOrder } }
        break
      case 'size':
        orderBy = { file: { size: sortOrder } }
        break
      case 'sender':
        orderBy = { file: { user: { email: sortOrder } } }
        break
      case 'date':
      default:
        orderBy = { createdAt: sortOrder }
        break
    }

    // Get total filtered count
    const totalFiltered = await prisma.fileShare.count({ where })

    // Get files with filters and sorting
    const receivedFiles = await prisma.fileShare.findMany({
      where,
      include: {
        file: {
          include: {
            user: {
              select: {
                email: true,
                name: true
              }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limit
    })

    // Transform the data
    const files = receivedFiles.map((share: any) => ({
      id: share.id,
      fileId: share.file.id,
      name: share.file.name,
      originalName: share.file.originalName || share.file.name,
      size: share.file.size,
      type: share.file.type,
      url: share.file.url,
      encrypted: share.file.encrypted,
      fileType: share.file.fileType,
      senderEmail: share.file.user.email,
      senderName: share.file.user.name,
      sharedAt: share.createdAt.toISOString(),
      permissions: share.permissions,
      status: share.status,
      expiresAt: share.expiresAt?.toISOString(),
      accessCount: share.accessCount
    }))

    const response: any = {
      files,
      pagination: {
        total: totalFiltered,
        page,
        limit,
        hasMore: offset + limit < totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit)
      },
      filters: {
        applied: {
          dateFrom,
          dateTo,
          permissions,
          minSize,
          maxSize,
          sender,
          fileType,
          status
        },
        sortBy,
        sortOrder
      }
    }

    // Include statistics if requested
    if (includeStats) {
      const stats = await getReceivedFilesStats(prisma, normalizedUserEmail)
      response.stats = stats
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/files/received error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { operation, shareIds } = await request.json()

    if (!operation || !['accept', 'reject', 'delete'].includes(operation)) {
      return NextResponse.json({
        error: "Invalid operation. Must be 'accept', 'reject', or 'delete'"
      }, { status: 400 })
    }

    if (!shareIds || !Array.isArray(shareIds) || shareIds.length === 0) {
      return NextResponse.json({ error: "shareIds array is required and cannot be empty" }, { status: 400 })
    }

    if (shareIds.length > 50) {
      return NextResponse.json({ error: "Maximum 50 shares can be processed at once" }, { status: 400 })
    }

    // Validate that user has access to all shares
    const shares = await prisma.fileShare.findMany({
      where: {
        id: { in: shareIds },
        sharedWithEmail: session.user.email,
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        file: true
      }
    })

    if (shares.length !== shareIds.length) {
      return NextResponse.json({
        error: "Access denied to one or more file shares",
        details: "You can only operate on active shares that are shared with you"
      }, { status: 403 })
    }

    const results: any[] = []
    let successCount = 0
    let failureCount = 0

    // Process operations in transaction for safety
    await prisma.$transaction(async (tx: any) => {
      for (const share of shares) {
        try {
          switch (operation) {
            case 'accept':
              await tx.fileShare.update({
                where: { id: share.id },
                data: { status: 'ACCEPTED' }
              })
              results.push({
                shareId: share.id,
                fileName: share.file.name,
                success: true,
                action: 'accept'
              })
              successCount++

              // Log audit event
              await logShareAcceptance(session.user.id, share.id, share.file.name,
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                request.headers.get('user-agent') || undefined)

              break

            case 'reject':
              await tx.fileShare.update({
                where: { id: share.id },
                data: { status: 'REJECTED' }
              })
              results.push({
                shareId: share.id,
                fileName: share.file.name,
                success: true,
                action: 'reject'
              })
              successCount++

              // Log audit event
              await logShareRejection(session.user.id, share.id, share.file.name,
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                request.headers.get('user-agent') || undefined)

              break

            case 'delete':
              await tx.fileShare.update({
                where: { id: share.id },
                data: { revoked: true }
              })
              results.push({
                shareId: share.id,
                fileName: share.file.name,
                success: true,
                action: 'delete'
              })
              successCount++

              // Log audit event
              await logShareRevocation(session.user.id, share.id, share.file.name)

              break
          }
        } catch (error) {
          results.push({
            shareId: share.id,
            fileName: share.file.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            action: operation
          })
          failureCount++
        }
      }
    })

    // Log bulk operation summary
    await logBulkShareOperation(session.user.id, operation, shareIds, successCount, failureCount)

    return NextResponse.json({
      success: failureCount === 0,
      operation,
      summary: {
        totalShares: shares.length,
        successCount,
        failureCount
      },
      results
    })

  } catch (error) {
    console.error('POST /api/files/received error:', error)
    return NextResponse.json({
      error: "Bulk operation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

async function getReceivedFilesStats(prisma: any, userEmail: string) {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalReceived,
    acceptedCount,
    rejectedCount,
    expiredCount,
    recentShares,
    senderStats,
    fileTypeStats,
    downloadStats
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
        status: 'EXPIRED',
        revoked: false
      }
    }),

    // Recent shares (last 7 days)
    prisma.fileShare.count({
      where: {
        sharedWithEmail: userEmail,
        createdAt: { gte: sevenDaysAgo },
        revoked: false
      }
    }),

    // Top senders
    prisma.fileShare.groupBy({
      by: ['createdBy'],
      where: { sharedWithEmail: userEmail, revoked: false },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    }),

    // File type distribution
    prisma.fileShare.groupBy({
      by: ['file'],
      where: { sharedWithEmail: userEmail, revoked: false },
      _count: { id: true }
    }),

    // Download stats from DownloadLog
    prisma.downloadLog.aggregate({
      where: {
        share: { sharedWithEmail: userEmail },
        action: 'complete'
      },
      _count: { id: true },
      _sum: { metadata: true } // This might need adjustment based on how we store size
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
  const fileTypeMap: { [key: string]: number } = {}
  for (const stat of fileTypeStats) {
    const file = await prisma.file.findUnique({
      where: { id: stat.file },
      select: { type: true, fileType: true }
    })
    const type = file?.fileType || file?.type || 'unknown'
    fileTypeMap[type] = (fileTypeMap[type] || 0) + stat._count.id
  }

  return {
    totalReceived,
    statusBreakdown: {
      accepted: acceptedCount,
      rejected: rejectedCount,
      expired: expiredCount,
      pending: totalReceived - acceptedCount - rejectedCount - expiredCount
    },
    recentActivity: {
      last7Days: recentShares,
      last30Days: await prisma.fileShare.count({
        where: {
          sharedWithEmail: userEmail,
          createdAt: { gte: thirtyDaysAgo },
          revoked: false
        }
      })
    },
    topSenders: senderStatsWithNames,
    fileTypes: fileTypeMap,
    downloads: {
      totalCompleted: downloadStats._count.id
    }
  }
}