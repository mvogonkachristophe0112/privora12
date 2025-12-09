import { getPrismaClient } from './prisma'

export enum Permission {
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  EDIT = 'EDIT'
}

export interface AccessCheckResult {
  hasAccess: boolean
  permissions: Permission[]
  reason?: string
}

/**
 * Check if a user has access to a file with specific permissions
 */
export async function checkFileAccess(
  userId: string,
  fileId: string,
  requiredPermissions: Permission[] = [Permission.VIEW]
): Promise<AccessCheckResult> {
  const prisma = await getPrismaClient()

  // First check if user owns the file
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { userId: true }
  })

  if (!file) {
    return { hasAccess: false, permissions: [], reason: 'File not found' }
  }

  if (file.userId === userId) {
    // Owner has all permissions
    return { hasAccess: true, permissions: [Permission.VIEW, Permission.DOWNLOAD, Permission.EDIT] }
  }

  // Check shares for this user
  const userShares = await prisma.fileShare.findMany({
    where: {
      fileId,
      revoked: false,
      OR: [
        { userId }, // Direct shares
        {
          group: {
            members: { some: { id: userId } }
          }
        } // Group shares
      ],
      AND: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    },
    select: {
      permissions: true,
      maxAccessCount: true,
      accessCount: true,
      group: {
        select: { id: true, name: true }
      }
    }
  })

  if (userShares.length === 0) {
    return { hasAccess: false, permissions: [], reason: 'No access granted' }
  }

  // Aggregate permissions from all shares
  const allPermissions = new Set<Permission>()
  let hasAccessLimit = false

  for (const share of userShares) {
    // Check access count limit
    if (share.maxAccessCount && share.accessCount >= share.maxAccessCount) {
      continue // This share has exceeded access limit
    }

    // Add permissions from this share
    share.permissions.forEach((perm: string) => allPermissions.add(perm as Permission))
  }

  const permissions = Array.from(allPermissions)

  // Check if user has all required permissions
  const hasRequiredPermissions = requiredPermissions.every(perm => permissions.includes(perm))

  if (!hasRequiredPermissions) {
    return {
      hasAccess: false,
      permissions,
      reason: `Missing required permissions: ${requiredPermissions.filter(p => !permissions.includes(p)).join(', ')}`
    }
  }

  return { hasAccess: true, permissions }
}

/**
 * Check if a user can perform an action on a file
 */
export async function canPerformAction(
  userId: string,
  fileId: string,
  action: 'view' | 'download' | 'edit'
): Promise<boolean> {
  const permissionMap = {
    view: [Permission.VIEW],
    download: [Permission.DOWNLOAD],
    edit: [Permission.EDIT]
  }

  const result = await checkFileAccess(userId, fileId, permissionMap[action])
  return result.hasAccess
}

/**
 * Record file access for audit and access count tracking
 */
export async function recordFileAccess(
  userId: string,
  fileId: string,
  action: 'view' | 'download' | 'edit'
): Promise<void> {
  const prisma = await getPrismaClient()

  // Find relevant shares and increment access count
  const shares = await prisma.fileShare.findMany({
    where: {
      fileId,
      revoked: false,
      OR: [
        { userId },
        {
          group: {
            members: { some: { id: userId } }
          }
        }
      ]
    }
  })

  // Increment access count for each relevant share
  for (const share of shares) {
    if (!share.maxAccessCount || share.accessCount < share.maxAccessCount) {
      await prisma.fileShare.update({
        where: { id: share.id },
        data: { accessCount: { increment: 1 } }
      })
    }
  }
}

/**
 * Validate permissions array
 */
export function validatePermissions(permissions: string[]): Permission[] {
  const validPermissions = Object.values(Permission)
  return permissions.filter(perm => validPermissions.includes(perm as Permission)) as Permission[]
}

/**
 * Check if user has permission to manage a group
 */
export async function canManageGroup(userId: string, groupId: string): Promise<boolean> {
  const prisma = await getPrismaClient()

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true }
  })

  return group?.creatorId === userId
}

/**
 * Check if user is member of a group
 */
export async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
  const prisma = await getPrismaClient()

  const membership = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { creatorId: userId },
        { members: { some: { id: userId } } }
      ]
    }
  })

  return !!membership
}