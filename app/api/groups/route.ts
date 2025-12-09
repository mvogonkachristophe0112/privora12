import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { emitSocketEvent } from "@/lib/socket"

export async function GET() {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()

    // Get groups where user is creator or member
    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { creatorId: session.user.id },
          { members: { some: { id: session.user.id } } }
        ]
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        members: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { members: true, fileShares: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('GET /api/groups error:', error)
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
    const { name, description, memberEmails } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 })
    }

    // Validate member emails and get user IDs
    const members = []
    if (memberEmails && Array.isArray(memberEmails)) {
      for (const email of memberEmails) {
        if (typeof email !== 'string') continue

        const normalizedEmail = email.trim().toLowerCase()
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, name: true }
        })

        if (user) {
          members.push(user)
        }
      }
    }

    // Create the group
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        creatorId: session.user.id,
        members: {
          connect: members.map(m => ({ id: m.id }))
        }
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        members: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { members: true, fileShares: true }
        }
      }
    })

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.GROUP_CREATE,
      resource: 'group',
      resourceId: group.id,
      details: {
        groupName: group.name,
        memberCount: members.length,
        memberEmails: members.map(m => m.email)
      },
      severity: AuditSeverity.LOW
    })

    // Emit notification to group members
    for (const member of members) {
      emitSocketEvent('group-created', {
        groupId: group.id,
        groupName: group.name,
        creatorId: session.user.id,
        creatorName: session.user.name,
        memberId: member.id,
        createdAt: group.createdAt.toISOString()
      })
    }

    return NextResponse.json(group)
  } catch (error) {
    console.error('POST /api/groups error:', error)
    return NextResponse.json({
      error: "Failed to create group",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}