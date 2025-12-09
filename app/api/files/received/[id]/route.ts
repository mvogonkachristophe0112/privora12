import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { logShareAcceptance, logShareRejection, logShareRevocation } from "@/lib/audit"
import { logAccessEvent, AccessEventType, AccessResult } from "@/lib/access-tracking"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const resolvedParams = await params
    const shareId = resolvedParams.id
    const { action } = await request.json()

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'accept' or 'reject'" }, { status: 400 })
    }

    // Find the file share and ensure the user has access
    const fileShare = await prisma.fileShare.findFirst({
      where: {
        id: shareId,
        sharedWithEmail: session.user.email,
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        file: true
      }
    })

    if (!fileShare) {
      return NextResponse.json({ error: "File share not found or access denied" }, { status: 404 })
    }

    if (action === 'accept') {
      // For accept, we could add an "accepted" field to the schema, but for now,
      // accepting just means acknowledging receipt - the share remains active
      // We could update a lastAccessed or similar field if it existed

      // Log audit event
      await logShareAcceptance(session.user.id, shareId, fileShare.file.name,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        request.headers.get('user-agent') || undefined)

      // Log access event
      await logAccessEvent({
        shareId,
        userId: session.user.id,
        fileId: fileShare.fileId,
        eventType: AccessEventType.BULK_OPERATION,
        result: AccessResult.SUCCESS,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: { operation: 'accept' }
      })

      return NextResponse.json({
        success: true,
        message: "File share accepted successfully",
        action: 'accept'
      })
    } else if (action === 'reject') {
      // Reject means revoke the share
      await prisma.fileShare.update({
        where: { id: shareId },
        data: { revoked: true }
      })

      // Log audit event
      await logShareRejection(session.user.id, shareId, fileShare.file.name,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        request.headers.get('user-agent') || undefined)

      // Log access event
      await logAccessEvent({
        shareId,
        userId: session.user.id,
        fileId: fileShare.fileId,
        eventType: AccessEventType.BULK_OPERATION,
        result: AccessResult.SUCCESS,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: { operation: 'reject' }
      })

      return NextResponse.json({
        success: true,
        message: "File share rejected successfully",
        action: 'reject'
      })
    }

  } catch (error) {
    console.error('PUT /api/files/received/[id] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const resolvedParams = await params
    const shareId = resolvedParams.id

    // Find the file share and ensure the user has access to delete it
    const fileShare = await prisma.fileShare.findFirst({
      where: {
        id: shareId,
        sharedWithEmail: session.user.email,
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        file: true
      }
    })

    if (!fileShare) {
      return NextResponse.json({ error: "File share not found or access denied" }, { status: 404 })
    }

    // Revoke the file share (soft delete)
    await prisma.fileShare.update({
      where: { id: shareId },
      data: { revoked: true }
    })

    // Log audit event
    await logShareRevocation(session.user.id, shareId, fileShare.file.name)

    // Log access event
    await logAccessEvent({
      shareId,
      userId: session.user.id,
      fileId: fileShare.fileId,
      eventType: AccessEventType.BULK_OPERATION,
      result: AccessResult.SUCCESS,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { operation: 'delete' }
    })

    return NextResponse.json({
      success: true,
      message: "File share revoked successfully"
    })

  } catch (error) {
    console.error('DELETE /api/files/received/[id] error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}