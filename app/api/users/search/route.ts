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
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50) // Max 50 results

    if (!query.trim()) {
      return NextResponse.json({ users: [] })
    }

    const prisma = await getPrismaClient()
    const normalizedQuery = query.trim().toLowerCase()

    // Search users by email or name
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                email: {
                  contains: normalizedQuery,
                  mode: 'insensitive'
                }
              },
              {
                name: {
                  contains: normalizedQuery,
                  mode: 'insensitive'
                }
              }
            ]
          },
          {
            // Exclude current user
            id: {
              not: session.user.id
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true
      },
      orderBy: [
        // Prioritize exact email matches
        {
          email: {
            equals: normalizedQuery,
            sort: 'asc'
          }
        },
        // Then email starts with query
        {
          email: {
            startsWith: normalizedQuery,
            sort: 'asc'
          }
        },
        // Then name matches
        {
          name: {
            startsWith: normalizedQuery,
            sort: 'asc'
          }
        }
      ],
      take: limit
    })

    // Format response
    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      emailVerified: user.emailVerified !== null
    }))

    return NextResponse.json({
      users: formattedUsers,
      total: formattedUsers.length,
      query: normalizedQuery
    })

  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json(
      { error: 'Failed to search users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}