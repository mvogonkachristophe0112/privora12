import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const connectionId = resolvedParams.id
    const { action } = await request.json() // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // Find the connection
    const connection = await prisma.userConnection.findUnique({
      where: { id: connectionId },
    })

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    // Ensure the user is the target of the connection request
    if (connection.connectedTo !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized to modify this connection" }, { status: 403 })
    }

    if (action === 'accept') {
      // Update the connection status
      await prisma.userConnection.update({
        where: { id: connectionId },
        data: { status: 'accepted' },
      })

      // Create reverse connection
      await prisma.userConnection.upsert({
        where: {
          userId_connectedTo: {
            userId: session.user.email,
            connectedTo: connection.userId,
          },
        },
        update: { status: 'accepted' },
        create: {
          userId: session.user.email,
          connectedTo: connection.userId,
          status: 'accepted',
        },
      })
    } else if (action === 'reject') {
      // Delete the connection request
      await prisma.userConnection.delete({
        where: { id: connectionId },
      })
    }

    return NextResponse.json({
      success: true,
      message: `Connection ${action}ed successfully`
    })
  } catch (error) {
    console.error('PATCH /api/connections/[id] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}