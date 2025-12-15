import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getPrismaClient } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrismaClient()

    if (!prisma) {
      return NextResponse.json({
        error: "Database not available",
        details: "Database connection is not configured"
      }, { status: 503 })
    }

    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: new Date()
      }
    })

    return NextResponse.json({ message: "User created", user: { id: user.id, name: user.name, email: user.email } })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}