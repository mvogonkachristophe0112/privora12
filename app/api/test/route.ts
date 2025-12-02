import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"

export async function GET() {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)

    const prisma = await getPrismaClient()

    // Test database connection
    const userCount = await prisma.user.count()

    return NextResponse.json({
      status: "OK",
      session: session ? { email: session.user.email, id: session.user.id } : null,
      database: "connected",
      userCount
    })
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}