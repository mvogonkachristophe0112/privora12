import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { PathSanitizer } from "@/lib/security"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // Require authentication for file downloads
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { filename } = await params

    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // Find file by URL to ensure user has access
    const file = await prisma.file.findFirst({
      where: {
        url: `/api/files/download/local/${filename}`,
        userId: session.user.id
      }
    })

    if (!file) {
      // Check if user has access through shares
      const share = await prisma.fileShare.findFirst({
        where: {
          file: {
            url: `/api/files/download/local/${filename}`
          },
          OR: [
            { userId: session.user.id },
            { sharedWithEmail: session.user.email }
          ],
          revoked: false,
          AND: [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          ]
        },
        include: { file: true }
      })

      if (!share) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    const uploadDir = path.resolve(process.cwd(), 'storage', 'uploads')
    const filePath = path.join(uploadDir, filename)

    // Sanitize file path for security
    const sanitizedFilePath = PathSanitizer.sanitizeFilePath(filePath, uploadDir)

    // Check if file exists
    try {
      await fs.access(sanitizedFilePath)
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Get file stats
    const stats = await fs.stat(sanitizedFilePath)

    // Use original filename from database or extract from secure filename
    const fileRecord = file || (await prisma.file.findFirst({
      where: { url: `/api/files/download/local/${filename}` }
    }))

    const originalFilename = fileRecord?.originalName || filename

    // Create response with file
    const fileBuffer = await fs.readFile(sanitizedFilePath)

    // Audit logging
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.FILE_DOWNLOAD,
      resource: 'file',
      resourceId: file?.id || 'unknown',
      details: {
        fileName: originalFilename,
        fileSize: stats.size,
        localDownload: true
      },
      severity: AuditSeverity.LOW
    })

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileRecord?.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${originalFilename}"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'private, no-cache',
      },
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: "Download failed" }, { status: 500 })
  }
}