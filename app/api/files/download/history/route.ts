import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')

    const prisma = await getPrismaClient()

    const history = await prisma.downloadHistory.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        downloadedAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    if (format === 'csv') {
      const csvHeaders = [
        'ID',
        'File ID',
        'File Name',
        'File Size',
        'File Type',
        'Downloaded At',
        'Status',
        'Speed (B/s)',
        'Duration (s)',
        'Error'
      ]

      const csvRows = [
        csvHeaders.join(','),
        ...history.map((row: any) => [
          row.id,
          row.fileId,
          `"${row.fileName.replace(/"/g, '""')}"`,
          row.fileSize,
          `"${row.fileType}"`,
          row.downloadedAt.toISOString(),
          row.status,
          row.speed || '',
          row.duration || '',
          `"${row.error?.replace(/"/g, '""') || ''}"`
        ].join(','))
      ]

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="download-history.csv"'
        }
      })
    }

    return NextResponse.json({
      history,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit
      }
    })

  } catch (error) {
    console.error('GET /api/files/download/history error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fileId, fileName, fileSize, fileType, status, speed, duration, error } = await request.json()

    if (!fileId || !fileName || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    const historyEntry = await prisma.downloadHistory.create({
      data: {
        userId: session.user.id,
        fileId,
        fileName,
        fileSize: parseInt(fileSize),
        fileType,
        status,
        speed: speed ? parseFloat(speed) : null,
        duration: duration ? parseFloat(duration) : null,
        error
      }
    })

    return NextResponse.json({ success: true, historyEntry })

  } catch (error) {
    console.error('POST /api/files/download/history error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()

    // Delete all history for the user
    await prisma.downloadHistory.deleteMany({
      where: {
        userId: session.user.id
      }
    })

    return NextResponse.json({ success: true, message: "Download history cleared" })

  } catch (error) {
    console.error('DELETE /api/files/download/history error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}