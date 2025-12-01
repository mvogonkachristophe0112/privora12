import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitStore.get(userId)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  userLimit.count++
  return true
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [userId, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(userId)
    }
  }
}, 60000) // Clean up every minute

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting for scalability
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const prisma = await getPrismaClient()
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100 messages
    const offset = parseInt(searchParams.get('offset') || '0')

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

    // Optimized query with pagination for scalability
    const messages = await prisma.message.findMany({
      where: { roomId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }, // Get latest first for pagination
      take: limit,
      skip: offset
    })

    // Reverse to show chronological order
    messages.reverse()

    // Get total count for pagination info
    const totalCount = await prisma.message.count({
      where: { roomId }
    })

    return NextResponse.json({
      messages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting for scalability
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json({
        error: "Rate limit exceeded. Please wait before sending more messages.",
        retryAfter: 60
      }, {
        status: 429,
        headers: { 'Retry-After': '60' }
      })
    }

    const prisma = await getPrismaClient()
    const { content, roomId, replyTo } = await request.json()

    if (!content || !roomId) {
      return NextResponse.json({ error: "Content and roomId required" }, { status: 400 })
    }

    // Validate content length for scalability
    if (content.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 })
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

    // Create message with transaction for consistency
    const message = await prisma.$transaction(async (tx: any) => {
      const newMessage = await tx.message.create({
        data: {
          content: content.trim(),
          userId: session.user.id,
          roomId,
          replyTo: replyTo || null
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // Update room's last activity (for scalability features)
      await tx.chatRoom.update({
        where: { id: roomId },
        data: { updatedAt: new Date() }
      })

      return newMessage
    })

    return NextResponse.json({
      ...message,
      status: 'sent',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error creating message:", error)

    // Handle specific database errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: "Duplicate message" }, { status: 409 })
    }

    return NextResponse.json({
      error: "Failed to send message",
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    }, { status: 500 })
  }
}