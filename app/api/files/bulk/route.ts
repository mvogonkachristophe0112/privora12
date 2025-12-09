import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { logAuditEvent, AuditAction, AuditSeverity } from "@/lib/audit"
import { emitSocketEvent } from "@/lib/socket"

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { operation, fileIds, recipients, groups, permissions, expiresAt, password, maxAccessCount } = await request.json()

    if (!operation || !['share', 'update_permissions', 'revoke_access'].includes(operation)) {
      return NextResponse.json({ error: "Invalid operation. Must be 'share', 'update_permissions', or 'revoke_access'" }, { status: 400 })
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "fileIds array is required and cannot be empty" }, { status: 400 })
    }

    // Validate that user owns all the files or has appropriate permissions
    const files = await prisma.file.findMany({
      where: {
        id: { in: fileIds },
        OR: [
          { userId: session.user.id },
          {
            shares: {
              some: {
                userId: session.user.id,
                permissions: { has: 'EDIT' }
              }
            }
          }
        ]
      },
      select: { id: true, name: true, userId: true }
    })

    if (files.length !== fileIds.length) {
      return NextResponse.json({
        error: "Access denied to one or more files",
        details: "You must own the files or have EDIT permissions"
      }, { status: 403 })
    }

    const results = []
    let totalSuccess = 0
    let totalFailed = 0

    switch (operation) {
      case 'share':
        const shareResults = await performBulkShare(
          prisma,
          session,
          files,
          recipients,
          groups,
          permissions,
          expiresAt,
          password,
          maxAccessCount
        )
        results.push(...shareResults)
        totalSuccess = shareResults.filter(r => r.success).length
        totalFailed = shareResults.filter(r => !r.success).length
        break

      case 'update_permissions':
        const updateResults = await performBulkPermissionUpdate(
          prisma,
          session,
          files,
          recipients,
          groups,
          permissions
        )
        results.push(...updateResults)
        totalSuccess = updateResults.filter(r => r.success).length
        totalFailed = updateResults.filter(r => !r.success).length
        break

      case 'revoke_access':
        const revokeResults = await performBulkRevokeAccess(
          prisma,
          session,
          files,
          recipients,
          groups
        )
        results.push(...revokeResults)
        totalSuccess = revokeResults.filter(r => r.success).length
        totalFailed = revokeResults.filter(r => !r.success).length
        break
    }

    // Audit logging for bulk operation
    await logAuditEvent({
      userId: session.user.id,
      action: AuditAction.FILE_SHARE, // Using FILE_SHARE as generic action
      resource: 'bulk_operation',
      details: {
        operation,
        fileCount: files.length,
        totalSuccess,
        totalFailed,
        recipients: recipients?.length || 0,
        groups: groups?.length || 0
      },
      severity: AuditSeverity.MEDIUM
    })

    return NextResponse.json({
      success: true,
      operation,
      summary: {
        totalFiles: files.length,
        totalSuccess,
        totalFailed
      },
      results
    })

  } catch (error) {
    console.error('POST /api/files/bulk error:', error)
    return NextResponse.json({
      error: "Bulk operation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Helper functions for bulk operations
async function performBulkShare(
  prisma: any,
  session: any,
  files: any[],
  recipients: string[],
  groups: string[],
  permissions: string[],
  expiresAt: string,
  password: string,
  maxAccessCount: number
) {
  const results = []

  for (const file of files) {
    try {
      const fileResults = []

      // Share with individual users
      if (recipients && recipients.length > 0) {
        for (const email of recipients) {
          const normalizedEmail = email.trim().toLowerCase()
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, email: true }
          })

          if (user) {
            await prisma.fileShare.create({
              data: {
                fileId: file.id,
                userId: user.id,
                sharedWithEmail: normalizedEmail,
                shareType: 'USER',
                permissions: permissions || ['VIEW'],
                password,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                maxAccessCount,
                createdBy: session.user.id
              }
            })

            emitSocketEvent('file-shared', {
              fileId: file.id,
              fileName: file.name,
              receiverEmail: email,
              permissions: permissions || ['VIEW'],
              sharedAt: new Date().toISOString()
            })

            fileResults.push({ email, success: true })
          } else {
            fileResults.push({ email, success: false, error: 'User not found' })
          }
        }
      }

      // Share with groups
      if (groups && groups.length > 0) {
        for (const groupId of groups) {
          const group = await prisma.group.findUnique({
            where: { id: groupId },
            select: { id: true, name: true }
          })

          if (group) {
            await prisma.fileShare.create({
              data: {
                fileId: file.id,
                groupId,
                shareType: 'GROUP',
                permissions: permissions || ['VIEW'],
                password,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                maxAccessCount,
                createdBy: session.user.id
              }
            })

            fileResults.push({ groupId, groupName: group.name, success: true })
          } else {
            fileResults.push({ groupId, success: false, error: 'Group not found' })
          }
        }
      }

      results.push({
        fileId: file.id,
        fileName: file.name,
        success: true,
        shares: fileResults
      })

    } catch (error) {
      results.push({
        fileId: file.id,
        fileName: file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function performBulkPermissionUpdate(
  prisma: any,
  session: any,
  files: any[],
  recipients: string[],
  groups: string[],
  permissions: string[]
) {
  const results = []

  for (const file of files) {
    try {
      let updateCount = 0

      // Update permissions for individual users
      if (recipients && recipients.length > 0) {
        for (const email of recipients) {
          const normalizedEmail = email.trim().toLowerCase()
          const result = await prisma.fileShare.updateMany({
            where: {
              fileId: file.id,
              sharedWithEmail: normalizedEmail,
              createdBy: session.user.id // Only shares created by this user
            },
            data: { permissions }
          })
          updateCount += result.count
        }
      }

      // Update permissions for groups
      if (groups && groups.length > 0) {
        const result = await prisma.fileShare.updateMany({
          where: {
            fileId: file.id,
            groupId: { in: groups },
            createdBy: session.user.id
          },
          data: { permissions }
        })
        updateCount += result.count
      }

      results.push({
        fileId: file.id,
        fileName: file.name,
        success: true,
        updatedShares: updateCount
      })

    } catch (error) {
      results.push({
        fileId: file.id,
        fileName: file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function performBulkRevokeAccess(
  prisma: any,
  session: any,
  files: any[],
  recipients: string[],
  groups: string[]
) {
  const results = []

  for (const file of files) {
    try {
      let revokeCount = 0

      // Revoke access for individual users
      if (recipients && recipients.length > 0) {
        for (const email of recipients) {
          const normalizedEmail = email.trim().toLowerCase()
          const result = await prisma.fileShare.updateMany({
            where: {
              fileId: file.id,
              sharedWithEmail: normalizedEmail,
              createdBy: session.user.id,
              revoked: false
            },
            data: { revoked: true, updatedAt: new Date() }
          })
          revokeCount += result.count
        }
      }

      // Revoke access for groups
      if (groups && groups.length > 0) {
        const result = await prisma.fileShare.updateMany({
          where: {
            fileId: file.id,
            groupId: { in: groups },
            createdBy: session.user.id,
            revoked: false
          },
          data: { revoked: true, updatedAt: new Date() }
        })
        revokeCount += result.count
      }

      results.push({
        fileId: file.id,
        fileName: file.name,
        success: true,
        revokedShares: revokeCount
      })

    } catch (error) {
      results.push({
        fileId: file.id,
        fileName: file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}