import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { triggerPusherEvent } from "@/lib/pusher"

// GET - Fetch all online users' presence
export async function GET() {
  try {
    const prisma = await getPrismaClient()
    const presenceData = await prisma.userPresence.findMany({
      where: { isOnline: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    // Transform to email-keyed object for easier lookup
    const presenceMap: Record<string, any> = {}
    presenceData.forEach(p => {
      if (p.user) {
        presenceMap[p.user.email] = {
          isOnline: p.isOnline,
          lastSeen: p.lastSeen,
          deviceType: p.deviceType,
          user: p.user
        }
      }
    })

    return NextResponse.json(presenceMap)
  } catch (error) {
    console.error('GET /api/presence error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Set user online
export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, deviceType, user } = await request.json()
    const prisma = await getPrismaClient()

    const presence = await prisma.userPresence.upsert({
      where: { userId },
      update: {
        isOnline: true,
        lastSeen: new Date(),
        deviceType,
      },
      create: {
        userId,
        isOnline: true,
        lastSeen: new Date(),
        deviceType,
      },
    })

    // Trigger Pusher event for user status change
    await triggerPusherEvent('presence-users', 'user-status-changed', {
      userId,
      isOnline: true,
      lastSeen: new Date(),
      deviceType,
      user,
    })

    return NextResponse.json({ success: true, presence })
  } catch (error) {
    console.error('POST /api/presence error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update user presence (active/away)
export async function PATCH(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { status } = await request.json()
    const prisma = await getPrismaClient()

    const presence = await prisma.userPresence.update({
      where: { userId: session.user.id },
      data: {
        lastSeen: new Date(),
        // Keep isOnline as true for both active and away
      },
    })

    // Trigger Pusher event
    await triggerPusherEvent('presence-users', 'user-status-changed', {
      userId: session.user.id,
      isOnline: true,
      lastSeen: new Date(),
      deviceType: presence.deviceType,
    })

    return NextResponse.json({ success: true, presence })
  } catch (error) {
    console.error('PATCH /api/presence error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Set user offline
export async function DELETE(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, deviceType, lastSeen } = await request.json()
    const prisma = await getPrismaClient()

    const presence = await prisma.userPresence.upsert({
      where: { userId },
      update: {
        isOnline: false,
        lastSeen: new Date(lastSeen),
        deviceType,
      },
      create: {
        userId,
        isOnline: false,
        lastSeen: new Date(lastSeen),
        deviceType,
      },
    })

    // Trigger Pusher event for user going offline
    await triggerPusherEvent('presence-users', 'user-status-changed', {
      userId,
      isOnline: false,
      lastSeen: new Date(lastSeen),
      deviceType,
    })

    return NextResponse.json({ success: true, presence })
  } catch (error) {
    console.error('DELETE /api/presence error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}