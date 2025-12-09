import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '@/lib/auth'
import { getPrismaClient } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    const prisma = await getPrismaClient()
    const normalizedEmail = email.trim().toLowerCase()

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true
      }
    })

    if (user) {
      return NextResponse.json({
        exists: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified !== null
        }
      })
    } else {
      return NextResponse.json({
        exists: false,
        message: 'User not found in system'
      })
    }

  } catch (error) {
    console.error('User validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}