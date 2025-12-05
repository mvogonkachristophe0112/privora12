// Test script to check file sharing functionality
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testFileSharing() {
  try {
    console.log('=== FILE SHARING TEST ===\n')

    // Check users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true
      }
    })
    console.log('Users in database:', users.length)
    users.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`)
    })

    // Check files
    const files = await prisma.file.findMany({
      select: {
        id: true,
        name: true,
        userId: true
      }
    })
    console.log('\nFiles in database:', files.length)

    // Get file owners
    for (const file of files) {
      const owner = await prisma.user.findUnique({
        where: { id: file.userId },
        select: { email: true }
      })
      console.log(`  - ${file.name} (Owner: ${owner?.email})`)
    }

    // Check file shares
    const shares = await prisma.fileShare.findMany({
      include: {
        file: {
          select: { name: true }
        }
      }
    })
    console.log('\nFile shares in database:', shares.length)

    for (const share of shares) {
      // Get sender info
      const sender = await prisma.user.findUnique({
        where: { id: share.userId },
        select: { email: true }
      })

      console.log(`  - File: ${share.file?.name}`)
      console.log(`    Sender: ${sender?.email || 'Unknown'}`)
      console.log(`    Receiver Email: ${share.sharedWithEmail}`)
      console.log(`    Permissions: ${share.permissions}`)
      console.log(`    Created: ${share.createdAt}`)
      console.log('')
    }

    // Test received files query for each user
    console.log('=== TESTING RECEIVED FILES QUERY ===')
    for (const user of users) {
      console.log(`\nTesting for user: ${user.email}`)

      const receivedFiles = await prisma.fileShare.findMany({
        where: {
          sharedWithEmail: user.email.toLowerCase(),
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

      console.log(`  Found ${receivedFiles.length} received files:`)
      for (const share of receivedFiles) {
        const sender = share.userId ? await prisma.user.findUnique({
          where: { id: share.userId },
          select: { email: true }
        }) : null
        console.log(`    - ${share.file?.name} from ${sender?.email || 'Unknown'}`)
      }
    }

  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFileSharing()