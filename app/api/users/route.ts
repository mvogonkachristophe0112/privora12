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
    const users = await prisma.user.findMany({
      where: {
        emailVerified: { not: null }, // Only show verified users
        email: { not: session.user.email } // Exclude current user
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        _count: {
          select: {
            files: true,
            sharedFiles: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('GET /api/users error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}