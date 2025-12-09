import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { operation, shareIds, format = 'json' } = await request.json()

    if (!operation || !['accept', 'reject', 'delete', 'export'].includes(operation)) {
      return NextResponse.json({
        error: "Invalid operation. Must be 'accept', 'reject', 'delete', or 'export'"
      }, { status: 400 })
    }

    if (!shareIds || !Array.isArray(shareIds) || shareIds.length === 0) {
      return NextResponse.json({ error: "shareIds array is required and cannot be empty" }, { status: 400 })
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
        file: true,
        creator: {
          select: { name: true, email: true }
        }
      }
    })

    if (shares.length !== shareIds.length) {
      return NextResponse.json({
        error: "Access denied to one or more file shares",
        details: "You can only operate on shares that are active and shared with you"
      }, { status: 403 })
    }

    const results = []
    let totalSuccess = 0
    let totalFailed = 0

    switch (operation) {
      case 'accept':
        const acceptResults = await performBulkAccept(prisma, shares)
        results.push(...acceptResults)
        totalSuccess = acceptResults.filter(r => r.success).length
        totalFailed = acceptResults.filter(r => !r.success).length
        break

      case 'reject':
        const rejectResults = await performBulkReject(prisma, shares)
        results.push(...rejectResults)
        totalSuccess = rejectResults.filter(r => r.success).length
        totalFailed = rejectResults.filter(r => !r.success).length
        break

      case 'delete':
        const deleteResults = await performBulkDelete(prisma, shares)
        results.push(...deleteResults)
        totalSuccess = deleteResults.filter(r => r.success).length
        totalFailed = deleteResults.filter(r => !r.success).length
        break

      case 'export':
        const exportData = await performBulkExport(shares, format)
        return new NextResponse(exportData, {
          headers: {
            'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
            'Content-Disposition': `attachment; filename="received-files-export.${format === 'csv' ? 'csv' : 'json'}"`
          }
        })
    }

    return NextResponse.json({
      success: true,
      operation,
      summary: {
        totalShares: shares.length,
        totalSuccess,
        totalFailed
      },
      results
    })

  } catch (error) {
    console.error('POST /api/files/received/bulk error:', error)
    return NextResponse.json({
      error: "Bulk operation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

async function performBulkAccept(prisma: any, shares: any[]) {
  const results = []

  for (const share of shares) {
    try {
      // For accept, we just acknowledge - could add acceptedAt field to schema later
      results.push({
        shareId: share.id,
        fileName: share.file.name,
        success: true,
        action: 'accept'
      })
    } catch (error) {
      results.push({
        shareId: share.id,
        fileName: share.file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'accept'
      })
    }
  }

  return results
}

async function performBulkReject(prisma: any, shares: any[]) {
  const results = []

  for (const share of shares) {
    try {
      await prisma.fileShare.update({
        where: { id: share.id },
        data: { revoked: true }
      })

      results.push({
        shareId: share.id,
        fileName: share.file.name,
        success: true,
        action: 'reject'
      })
    } catch (error) {
      results.push({
        shareId: share.id,
        fileName: share.file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'reject'
      })
    }
  }

  return results
}

async function performBulkDelete(prisma: any, shares: any[]) {
  const results = []

  for (const share of shares) {
    try {
      await prisma.fileShare.update({
        where: { id: share.id },
        data: { revoked: true }
      })

      results.push({
        shareId: share.id,
        fileName: share.file.name,
        success: true,
        action: 'delete'
      })
    } catch (error) {
      results.push({
        shareId: share.id,
        fileName: share.file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'delete'
      })
    }
  }

  return results
}

async function performBulkExport(shares: any[], format: string) {
  const exportData = shares.map(share => ({
    id: share.id,
    fileId: share.file.id,
    fileName: share.file.name,
    originalName: share.file.originalName,
    size: share.file.size,
    type: share.file.type,
    encrypted: share.file.encrypted,
    senderEmail: share.creator.email,
    senderName: share.creator.name,
    permissions: share.permissions,
    sharedAt: share.createdAt.toISOString(),
    expiresAt: share.expiresAt?.toISOString() || null
  }))

  if (format === 'csv') {
    const headers = [
      'ID',
      'File ID',
      'File Name',
      'Original Name',
      'Size (bytes)',
      'Type',
      'Encrypted',
      'Sender Email',
      'Sender Name',
      'Permissions',
      'Shared At',
      'Expires At'
    ]

    const csvRows = [
      headers.join(','),
      ...exportData.map(row => [
        row.id,
        row.fileId,
        `"${row.fileName.replace(/"/g, '""')}"`,
        `"${row.originalName?.replace(/"/g, '""') || ''}"`,
        row.size,
        `"${row.type}"`,
        row.encrypted,
        `"${row.senderEmail}"`,
        `"${row.senderName || ''}"`,
        `"${row.permissions.join(', ')}"`,
        row.sharedAt,
        row.expiresAt || ''
      ].join(','))
    ]

    return csvRows.join('\n')
  }

  return JSON.stringify(exportData, null, 2)
}