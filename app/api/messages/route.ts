import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Ensure the chat room exists for GET requests too
    let room = await prisma.chatRoom.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          id: roomId,
          name: roomId.charAt(0).toUpperCase() + roomId.slice(1),
          type: "group",
          creatorId: session.user.id
        }
      })
    }

    const messages = await prisma.message.findMany({
      where: { roomId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { content, roomId } = await request.json()

    if (!content || !roomId) {
      return NextResponse.json({ error: "Content and roomId required" }, { status: 400 })
    }

    // Ensure the chat room exists, create it if it doesn't
    let room = await prisma.chatRoom.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          id: roomId,
          name: roomId.charAt(0).toUpperCase() + roomId.slice(1),
          type: "group",
          creatorId: session.user.id
        }
      })
    }

    const message = await prisma.message.create({
      data: {
        content,
        userId: session.user.id,
        roomId
      },
      include: { user: { select: { name: true } } }
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}