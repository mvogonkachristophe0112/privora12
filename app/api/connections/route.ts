import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET() {
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

    // Get user's connections (both initiated and received)
    const [initiatedConnections, receivedConnections] = await Promise.all([
      prisma.userConnection.findMany({
        where: { userId: session.user.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      prisma.userConnection.findMany({
        where: { connectedTo: session.user.email },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
    ])

    // Combine and deduplicate connections
    const allConnections = [...initiatedConnections, ...receivedConnections]
    const uniqueConnections = allConnections.reduce((acc: any[], conn) => {
      const existing = acc.find(c => c.connectedTo === conn.connectedTo && c.userId === conn.userId)
      if (!existing) {
        acc.push(conn)
      }
      return acc
    }, [])

    return NextResponse.json(uniqueConnections)
  } catch (error) {
    console.error('GET /api/connections error:', error)
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

    const { targetEmail } = await request.json()

    if (!targetEmail || targetEmail === session.user.email) {
      return NextResponse.json({ error: "Invalid target email" }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if connection already exists
    const existingConnection = await prisma.userConnection.findFirst({
      where: {
        OR: [
          { userId: session.user.id, connectedTo: targetEmail },
          { userId: targetEmail, connectedTo: session.user.email },
        ],
      },
    })

    if (existingConnection) {
      return NextResponse.json({ error: "Connection already exists" }, { status: 400 })
    }

    // Create connection request
    const connection = await prisma.userConnection.create({
      data: {
        userId: session.user.id,
        connectedTo: targetEmail,
        status: 'pending',
      },
    })

    return NextResponse.json({
      success: true,
      connection,
      message: "Connection request sent"
    })
  } catch (error) {
    console.error('POST /api/connections error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}