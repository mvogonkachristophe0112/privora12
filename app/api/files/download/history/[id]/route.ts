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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const resolvedParams = await params
    const historyId = resolvedParams.id

    // Check if the history item belongs to the user
    const historyItem = await prisma.downloadHistory.findFirst({
      where: {
        id: historyId,
        userId: session.user.id
      }
    })

    if (!historyItem) {
      return NextResponse.json({ error: "History item not found" }, { status: 404 })
    }

    // Delete the history item
    await prisma.downloadHistory.delete({
      where: {
        id: historyId
      }
    })

    return NextResponse.json({ success: true, message: "History item deleted" })

  } catch (error) {
    console.error('DELETE /api/files/download/history/[id] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}