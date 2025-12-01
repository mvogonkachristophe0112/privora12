import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const resolvedParams = await params
    const shareId = resolvedParams.id

    // Find the file share and ensure the user has access to delete it
    const fileShare = await prisma.fileShare.findFirst({
      where: {
        id: shareId,
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

    if (!fileShare) {
      return NextResponse.json({ error: "File share not found or access denied" }, { status: 404 })
    }

    // Revoke the file share (soft delete)
    await prisma.fileShare.update({
      where: { id: shareId },
      data: { revoked: true }
    })

    return NextResponse.json({
      success: true,
      message: "File share revoked successfully"
    })

  } catch (error) {
    console.error('DELETE /api/files/received/[id] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}