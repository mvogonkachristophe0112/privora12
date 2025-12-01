import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET() {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()

    // Get presence for all users
    const presences = await prisma.userPresence.findMany({
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
    })

    // Transform to a more usable format
    const presenceMap = presences.reduce((acc: Record<string, any>, presence: any) => {
      acc[presence.user.email] = {
        isOnline: presence.isOnline,
        lastSeen: presence.lastSeen,
        user: presence.user,
      }
      return acc
    }, {})

    return NextResponse.json(presenceMap)
  } catch (error) {
    console.error('GET /api/presence error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}