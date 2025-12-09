import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { emitSocketEvent } from "@/lib/socket"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const resolvedParams = await params
    const fileId = resolvedParams.id
    const versionId = resolvedParams.versionId

    // Check if user owns the file or has EDIT permission
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        shares: {
          where: {
            userId: session.user.id,
            permissions: { has: 'EDIT' }
          }
        }
      }
    })

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    if (file.userId !== session.user.id && file.shares.length === 0) {
      return NextResponse.json({ error: "Access denied: EDIT permission required" }, { status: 403 })
    }

    // Get the target version
    const targetVersion = await prisma.fileVersion.findUnique({
      where: { id: versionId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!targetVersion || targetVersion.fileId !== fileId) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    // Create a new version record for the rollback (backup current state)
    const latestVersion = await prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' }
    })

    const rollbackVersionNumber = (latestVersion?.versionNumber || 0) + 1

    // Create rollback version record
    const rollbackVersion = await prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber: rollbackVersionNumber,
        name: `Rollback to Version ${targetVersion.versionNumber}`,
        size: file.size,
        url: file.url,
        changes: {
          type: 'rollback',
          fromVersion: latestVersion?.versionNumber || 0,
          toVersion: targetVersion.versionNumber,
          reason: 'Manual rollback'
        },
        createdBy: session.user.id
      }
    })

    // Update the main file to point to the target version
    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        url: targetVersion.url,
        size: targetVersion.size,
        updatedAt: new Date()
      }
    })

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.FILE_EDIT,
      resource: 'file',
      resourceId: fileId,
      details: {
        action: 'rollback',
        fromVersion: latestVersion?.versionNumber || 0,
        toVersion: targetVersion.versionNumber,
        rollbackVersionId: rollbackVersion.id
      },
      severity: AuditSeverity.MEDIUM
    })

    // Emit notification
    emitSocketEvent('file-rolled-back', {
      fileId,
      fileName: file.name,
      fromVersion: latestVersion?.versionNumber || 0,
      toVersion: targetVersion.versionNumber,
      rolledBackBy: session.user.id,
      rolledBackByName: session.user.name,
      rolledBackAt: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      file: updatedFile,
      rollbackVersion,
      targetVersion
    })
  } catch (error) {
    console.error('POST /api/files/[id]/versions/[versionId]/rollback error:', error)
    return NextResponse.json({
      error: "Failed to rollback version",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}