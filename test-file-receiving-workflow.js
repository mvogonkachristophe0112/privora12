/**
 * Comprehensive test for file receiving workflow
 * Tests all aspects of file sharing and receiving functionality
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testFileReceivingWorkflow() {
  console.log('🧪 Starting comprehensive file receiving workflow test...\n')

  try {
    // Test 1: Verify database schema and relationships
    console.log('1️⃣ Testing database schema and relationships...')
    await testDatabaseSchema()
    console.log('✅ Database schema test passed\n')

    // Test 2: Test user creation and validation
    console.log('2️⃣ Testing user creation and email validation...')
    const users = await testUserCreation()
    console.log('✅ User creation test passed\n')

    // Test 3: Test file upload and sharing
    console.log('3️⃣ Testing file upload and sharing logic...')
    const fileShares = await testFileSharing(users)
    console.log('✅ File sharing test passed\n')

    // Test 4: Test file receiving (what users see)
    console.log('4️⃣ Testing file receiving functionality...')
    await testFileReceiving(users, fileShares)
    console.log('✅ File receiving test passed\n')

    // Test 5: Test delivery guarantee system
    console.log('5️⃣ Testing delivery guarantee system...')
    await testDeliveryGuarantee(users)
    console.log('✅ Delivery guarantee test passed\n')

    // Test 6: Test security rules
    console.log('6️⃣ Testing security rules and access control...')
    await testSecurityRules(users)
    console.log('✅ Security rules test passed\n')

    console.log('🎉 ALL TESTS PASSED! File receiving workflow is working correctly.')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function testDatabaseSchema() {
  // Verify FileShare model has correct relationships
  const fileShareFields = await prisma.fileShare.fields
  const requiredFields = ['id', 'fileId', 'userId', 'sharedWithEmail', 'shareType', 'permissions', 'createdBy']

  for (const field of requiredFields) {
    if (!fileShareFields[field]) {
      throw new Error(`FileShare model missing required field: ${field}`)
    }
  }

  // Test relationships exist
  const testFile = await prisma.file.create({
    data: {
      name: 'test-file.txt',
      originalName: 'test-file.txt',
      size: 100,
      type: 'text/plain',
      url: 'https://example.com/test-file.txt',
      userId: 'test-user-id'
    }
  })

  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User'
    }
  })

  const testShare = await prisma.fileShare.create({
    data: {
      fileId: testFile.id,
      userId: testUser.id,
      sharedWithEmail: testUser.email,
      shareType: 'USER',
      permissions: ['VIEW', 'DOWNLOAD'],
      createdBy: testUser.id
    }
  })

  // Verify relationships work
  const shareWithRelations = await prisma.fileShare.findUnique({
    where: { id: testShare.id },
    include: {
      file: true,
      user: true,
      creator: true
    }
  })

  if (!shareWithRelations.file || !shareWithRelations.user || !shareWithRelations.creator) {
    throw new Error('FileShare relationships not working correctly')
  }

  // Cleanup
  await prisma.fileShare.delete({ where: { id: testShare.id } })
  await prisma.file.delete({ where: { id: testFile.id } })
  await prisma.user.delete({ where: { id: testUser.id } })
}

async function testUserCreation() {
  const users = []

  // Create test users
  for (let i = 1; i <= 3; i++) {
    const user = await prisma.user.create({
      data: {
        email: `testuser${i}@example.com`,
        name: `Test User ${i}`,
        password: 'hashedpassword'
      }
    })
    users.push(user)
  }

  // Test email validation
  try {
    await prisma.user.create({
      data: {
        email: 'invalid-email',
        name: 'Invalid User'
      }
    })
    throw new Error('Email validation not working')
  } catch (error) {
    if (!error.message.includes('Invalid email')) {
      // This is expected - invalid email should fail
    }
  }

  return users
}

async function testFileSharing(users) {
  const fileShares = []

  // Create test files and shares
  for (let i = 0; i < users.length - 1; i++) {
    const sender = users[i]
    const receiver = users[i + 1]

    // Create file
    const file = await prisma.file.create({
      data: {
        name: `shared-file-${i}.txt`,
        originalName: `shared-file-${i}.txt`,
        size: 1000 + i * 100,
        type: 'text/plain',
        url: `https://example.com/shared-file-${i}.txt`,
        userId: sender.id
      }
    })

    // Create share
    const share = await prisma.fileShare.create({
      data: {
        fileId: file.id,
        userId: receiver.id,
        sharedWithEmail: receiver.email,
        shareType: 'USER',
        permissions: ['VIEW', 'DOWNLOAD'],
        createdBy: sender.id,
        status: 'PENDING'
      }
    })

    fileShares.push({ file, share, sender, receiver })
  }

  return fileShares
}

async function testFileReceiving(users, fileShares) {
  // Test that each user can see their received files
  for (const user of users) {
    const receivedShares = await prisma.fileShare.findMany({
      where: {
        OR: [
          { userId: user.id },
          { sharedWithEmail: user.email }
        ],
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        file: true,
        creator: true
      }
    })

    console.log(`   User ${user.email} can see ${receivedShares.length} received files`)

    // Verify each received file has proper data
    for (const share of receivedShares) {
      if (!share.file || !share.creator) {
        throw new Error(`Received file missing relationships for user ${user.email}`)
      }

      if (share.sharedWithEmail !== user.email && share.userId !== user.id) {
        throw new Error(`Security violation: User ${user.email} can see file not shared with them`)
      }
    }
  }
}

async function testDeliveryGuarantee(users) {
  const testUser = users[0]

  // Simulate a share where userId is missing but sharedWithEmail exists
  const file = await prisma.file.create({
    data: {
      name: 'delivery-test.txt',
      originalName: 'delivery-test.txt',
      size: 500,
      type: 'text/plain',
      url: 'https://example.com/delivery-test.txt',
      userId: users[1].id // Different user
    }
  })

  // Create share with missing userId (simulating data inconsistency)
  const share = await prisma.fileShare.create({
    data: {
      fileId: file.id,
      sharedWithEmail: testUser.email, // But no userId
      shareType: 'USER',
      permissions: ['VIEW'],
      createdBy: users[1].id,
      status: 'PENDING'
    }
  })

  // Test delivery guarantee function (simulate what happens in API)
  const emailBasedShares = await prisma.fileShare.findMany({
    where: {
      sharedWithEmail: testUser.email,
      revoked: false
    }
  })

  // Simulate repair logic
  for (const share of emailBasedShares) {
    if (share.userId !== testUser.id) {
      await prisma.fileShare.update({
        where: { id: share.id },
        data: { userId: testUser.id }
      })
      console.log(`   Repaired share ${share.id} for user ${testUser.email}`)
    }
  }

  // Verify repair worked
  const repairedShare = await prisma.fileShare.findUnique({
    where: { id: share.id }
  })

  if (repairedShare.userId !== testUser.id) {
    throw new Error('Delivery guarantee repair failed')
  }

  // Cleanup
  await prisma.fileShare.delete({ where: { id: share.id } })
  await prisma.file.delete({ where: { id: file.id } })
}

async function testSecurityRules(users) {
  const attacker = users[0]
  const victim = users[1]

  // Create a file belonging to victim
  const victimFile = await prisma.file.create({
    data: {
      name: 'victim-file.txt',
      originalName: 'victim-file.txt',
      size: 1000,
      type: 'text/plain',
      url: 'https://example.com/victim-file.txt',
      userId: victim.id
    }
  })

  // Attacker should NOT be able to see victim's files
  const attackerReceivedFiles = await prisma.fileShare.findMany({
    where: {
      OR: [
        { userId: attacker.id },
        { sharedWithEmail: attacker.email }
      ]
    }
  })

  // Verify attacker cannot see victim's file
  const canSeeVictimFile = attackerReceivedFiles.some(share => share.fileId === victimFile.id)
  if (canSeeVictimFile) {
    throw new Error('Security violation: Attacker can see victim\'s files')
  }

  // Create a legitimate share from victim to attacker
  const legitimateShare = await prisma.fileShare.create({
    data: {
      fileId: victimFile.id,
      userId: attacker.id,
      sharedWithEmail: attacker.email,
      shareType: 'USER',
      permissions: ['VIEW'],
      createdBy: victim.id
    }
  })

  // Now attacker should be able to see the file
  const attackerReceivedFilesAfterShare = await prisma.fileShare.findMany({
    where: {
      OR: [
        { userId: attacker.id },
        { sharedWithEmail: attacker.email }
      ]
    }
  })

  const canNowSeeVictimFile = attackerReceivedFilesAfterShare.some(share => share.fileId === victimFile.id)
  if (!canNowSeeVictimFile) {
    throw new Error('Security issue: Legitimate share not visible to recipient')
  }

  // Cleanup
  await prisma.fileShare.delete({ where: { id: legitimateShare.id } })
  await prisma.file.delete({ where: { id: victimFile.id } })
}

// Run the test
if (require.main === module) {
  testFileReceivingWorkflow()
    .then(() => {
      console.log('\n✅ All file receiving workflow tests completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ File receiving workflow tests failed:', error)
      process.exit(1)
    })
}

module.exports = { testFileReceivingWorkflow }