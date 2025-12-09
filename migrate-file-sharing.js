const { getPrismaClient } = require('./lib/prisma')

async function migrateFileSharing() {
  const prisma = await getPrismaClient()

  console.log('Starting file sharing migration...')

  try {
    // Migrate existing FileShare permissions
    const shares = await prisma.fileShare.findMany({
      include: { file: true }
    })

    console.log(`Found ${shares.length} existing shares to migrate`)

    for (const share of shares) {
      // Convert old string permissions to new array format
      let permissions = []
      if (share.permissions === 'download') {
        permissions = ['VIEW', 'DOWNLOAD']
      } else {
        permissions = ['VIEW']
      }

      // Set createdBy to file owner if not set
      const createdBy = share.createdBy || share.file.userId

      await prisma.fileShare.update({
        where: { id: share.id },
        data: {
          permissions,
          createdBy,
          shareType: share.userId ? 'USER' : 'PUBLIC'
        }
      })
    }

    console.log('Migration completed successfully')

    // Optional: Create initial version for existing files
    const files = await prisma.file.findMany()
    console.log(`Creating initial versions for ${files.length} files`)

    for (const file of files) {
      const existingVersion = await prisma.fileVersion.findFirst({
        where: { fileId: file.id, versionNumber: 1 }
      })

      if (!existingVersion) {
        await prisma.fileVersion.create({
          data: {
            fileId: file.id,
            versionNumber: 1,
            name: 'Initial version',
            size: file.size,
            url: file.url,
            createdBy: file.userId
          }
        })
      }
    }

    console.log('Initial versions created')

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateFileSharing()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

module.exports = { migrateFileSharing }