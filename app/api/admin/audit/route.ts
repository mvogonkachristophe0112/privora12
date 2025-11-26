import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth'
import { getPrismaClient } from '@/lib/prisma'
import { logAuditEvent, AuditAction, AuditSeverity } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const prisma = await getPrismaClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const action = searchParams.get('action')
    const severity = searchParams.get('severity')
    const userId = searchParams.get('userId')

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(severity && { severity }),
        ...(userId && { userId })
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Math.min(limit, 100), // Max 100 per request
      skip: offset
    })

    // Parse JSON details
    const logsWithParsedDetails = auditLogs.map((log: any) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : {}
    }))

    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.ADMIN_ACTION,
      resource: 'audit_logs',
      details: { action: 'view_logs', filters: { action, severity, userId } },
      severity: AuditSeverity.LOW
    })

    return NextResponse.json(logsWithParsedDetails)
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { action, userId, resource, resourceId, details, severity } = await request.json()

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    await logAuditEvent({
      userId: userId || session.user.id,
      action,
      resource,
      resourceId,
      details,
      severity: severity || AuditSeverity.LOW
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}