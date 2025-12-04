import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

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

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Get total count for pagination
    const totalCount = await prisma.fileShare.count({
      where: {
        sharedWithEmail: session.user.email,
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    // Get files shared with the current user with pagination
    const receivedFiles = await prisma.fileShare.findMany({
      where: {
        sharedWithEmail: session.user.email,
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
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
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    })

    // Transform the data to match the expected format
    // Note: encryptionKey is not sent to client for security - decryption happens server-side
    const files = receivedFiles.map((share: any) => ({
      id: share.id, // Use share ID as the primary identifier
      fileId: share.file.id, // Keep file ID for download operations
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
      expiresAt: share.expiresAt?.toISOString()
    }))

    return NextResponse.json({
      files,
      total: totalCount,
      page,
      limit,
      hasMore: offset + limit < totalCount
    })
  } catch (error) {
    console.error('GET /api/files/received error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}