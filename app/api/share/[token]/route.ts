import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    console.log('Accessing share link with token:', token)

    const prisma = await getPrismaClient()

    // Find the file share by token
    const fileShare = await prisma.fileShare.findUnique({
      where: { shareToken: token },
      include: {
        file: true,
        user: true // Sender information
      }
    })

    if (!fileShare) {
      console.log('Share token not found:', token)
      return NextResponse.json({ error: "Share link not found or expired" }, { status: 404 })
    }

    // Check if share has expired
    if (fileShare.expiresAt && new Date() > fileShare.expiresAt) {
      console.log('Share link expired:', token)
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 })
    }

    // Check if share is revoked
    if (fileShare.revoked) {
      console.log('Share link revoked:', token)
      return NextResponse.json({ error: "Share link has been revoked" }, { status: 410 })
    }

    console.log('Share link valid, returning file info:', {
      fileId: fileShare.file.id,
      fileName: fileShare.file.name,
      senderEmail: fileShare.user?.email,
      receiverEmail: fileShare.sharedWithEmail,
      permissions: fileShare.permissions
    })

    return NextResponse.json({
      file: {
        id: fileShare.file.id,
        name: fileShare.file.name,
        originalName: fileShare.file.originalName,
        size: fileShare.file.size,
        type: fileShare.file.type,
        url: fileShare.file.url,
        encrypted: fileShare.file.encrypted,
        fileType: fileShare.file.fileType,
        createdAt: fileShare.file.createdAt
      },
      share: {
        id: fileShare.id,
        permissions: fileShare.permissions,
        sharedAt: fileShare.createdAt,
        expiresAt: fileShare.expiresAt
      },
      sender: {
        email: fileShare.user?.email,
        name: fileShare.user?.name
      },
      receiver: {
        email: fileShare.sharedWithEmail
      }
    })

  } catch (error) {
    console.error('GET /api/share/[token] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Allow downloading via share link (for public access)
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { action } = await request.json()

    if (action !== 'download') {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    console.log('Download request via share link:', token)

    const prisma = await getPrismaClient()

    // Find the file share by token
    const fileShare = await prisma.fileShare.findUnique({
      where: { shareToken: token },
      include: {
        file: true,
        user: true
      }
    })

    if (!fileShare) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 })
    }

    // Check permissions
    if (fileShare.permissions !== 'view' && fileShare.permissions !== 'download') {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check expiration and revocation
    if (fileShare.expiresAt && new Date() > fileShare.expiresAt) {
      return NextResponse.json({ error: "Share link expired" }, { status: 410 })
    }

    if (fileShare.revoked) {
      return NextResponse.json({ error: "Share link revoked" }, { status: 410 })
    }

    console.log('Share link download authorized for file:', fileShare.file.name)

    return NextResponse.json({
      downloadUrl: `/api/files/download/${fileShare.file.id}?shareToken=${token}`,
      fileName: fileShare.file.originalName || fileShare.file.name
    })

  } catch (error) {
    console.error('POST /api/share/[token] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}