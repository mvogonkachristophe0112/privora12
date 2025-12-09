import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { put } from '@vercel/blob'
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { emitSocketEvent } from "@/lib/socket"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if user has access to the file
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        shares: {
          where: {
            OR: [
              { userId: session.user.id },
              { group: { members: { some: { id: session.user.id } } } }
            ]
          }
        }
      }
    })

    if (!file || (file.userId !== session.user.id && file.shares.length === 0)) {
      return NextResponse.json({ error: "File not found or access denied" }, { status: 404 })
    }

    // Get all versions for this file
    const versions = await prisma.fileVersion.findMany({
      where: { fileId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { versionNumber: 'desc' }
    })

    return NextResponse.json(versions)
  } catch (error) {
    console.error('GET /api/files/[id]/versions error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const formData = await request.formData()
    const updatedFile = formData.get('file') as File
    const changes = formData.get('changes') as string

    if (!updatedFile) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Get the latest version number
    const latestVersion = await prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' }
    })

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1

    // Upload the new version to storage
    const blob = await put(`${file.name}_v${newVersionNumber}`, updatedFile, {
      access: 'public',
      contentType: updatedFile.type || 'application/octet-stream'
    })

    // Create version record
    const version = await prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber: newVersionNumber,
        name: `Version ${newVersionNumber}`,
        size: updatedFile.size,
        url: blob.url,
        changes: changes ? JSON.parse(changes) : null,
        createdBy: session.user.id
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Update the main file record to point to the latest version
    await prisma.file.update({
      where: { id: fileId },
      data: {
        url: blob.url,
        size: updatedFile.size,
        updatedAt: new Date()
      }
    })

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.FILE_VERSION_CREATE,
      resource: 'file_version',
      resourceId: version.id,
      details: {
        fileId,
        fileName: file.name,
        versionNumber: newVersionNumber,
        changes: changes ? JSON.parse(changes) : null
      },
      severity: AuditSeverity.LOW
    })

    // Emit notification
    emitSocketEvent('file-version-created', {
      fileId,
      fileName: file.name,
      versionId: version.id,
      versionNumber: newVersionNumber,
      createdBy: session.user.id,
      createdByName: session.user.name,
      createdAt: version.createdAt.toISOString()
    })

    return NextResponse.json(version)
  } catch (error) {
    console.error('POST /api/files/[id]/versions error:', error)
    return NextResponse.json({
      error: "Failed to create version",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}