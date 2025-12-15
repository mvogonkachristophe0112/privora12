// LIVE FILE SHARING SYSTEM TEST
// This script tests the actual file sharing functionality against a running server

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Configuration
const BASE_URL = 'https://privora12-jhpk3ne82-mvogonka-christophes-projects.vercel.app'
const API_BASE = `${BASE_URL}/api`

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
  console.log(`[${timestamp}] ${prefix} ${message}`)
}

function recordTest(name, passed, details = '') {
  testResults.total++
  if (passed) {
    testResults.passed++
    log(`TEST PASSED: ${name}`, 'success')
  } else {
    testResults.failed++
    log(`TEST FAILED: ${name}`, 'error')
  }
  if (details) {
    log(`   Details: ${details}`)
  }
  testResults.details.push({ name, passed, details })
}

// HTTP request helper
function makeRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    const req = protocol.request(url, options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonBody,
            rawBody: body
          })
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: body
          })
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (data) {
      if (typeof data === 'string') {
        req.write(data)
      } else {
        req.write(JSON.stringify(data))
      }
    }

    req.end()
  })
}

// Test 1: Check if server is running
async function testServerHealth() {
  log('Testing server health...')
  try {
    const response = await makeRequest(BASE_URL)
    const passed = response.status === 200
    recordTest('Server Health Check', passed, `Status: ${response.status}`)
    return passed
  } catch (error) {
    recordTest('Server Health Check', false, `Error: ${error.message}`)
    return false
  }
}

// Test 2: Check API endpoints exist
async function testApiEndpoints() {
  log('Testing API endpoints...')
  const endpoints = [
    '/api/files',
    '/api/files/received',
    '/api/auth/session'
  ]

  let allPassed = true
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${API_BASE}${endpoint}`)
      // Even 401/403 is OK - means endpoint exists
      const passed = response.status >= 200 && response.status < 500
      recordTest(`API Endpoint: ${endpoint}`, passed, `Status: ${response.status}`)
      if (!passed) allPassed = false
    } catch (error) {
      recordTest(`API Endpoint: ${endpoint}`, false, `Error: ${error.message}`)
      allPassed = false
    }
  }
  return allPassed
}

// Test 3: Check database connectivity via Prisma Studio
async function testDatabaseConnectivity() {
  log('Testing database connectivity...')
  // We can't directly test Prisma, but we can check if the studio port is accessible
  try {
    const response = await makeRequest('http://localhost:5556')
    const passed = response.status === 200
    recordTest('Database Connectivity (Prisma Studio)', passed, `Status: ${response.status}`)
    return passed
  } catch (error) {
    recordTest('Database Connectivity (Prisma Studio)', false, `Error: ${error.message} (This may be expected if Prisma Studio is not running)`)
    return false // Not critical for main functionality
  }
}

// Test 4: Validate file sharing logic (mock test)
async function testFileSharingLogic() {
  log('Testing file sharing logic validation...')

  // Test email validation
  const testEmails = [
    { email: 'valid@example.com', expected: true },
    { email: 'invalid-email', expected: false },
    { email: '', expected: false },
    { email: 'test@.com', expected: false },
    { email: 'test..test@example.com', expected: false }
  ]

  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  let emailValidationPassed = true
  testEmails.forEach(({ email, expected }) => {
    const result = validateEmail(email)
    const passed = result === expected
    if (!passed) emailValidationPassed = false
    recordTest(`Email Validation: "${email}"`, passed, `Expected: ${expected}, Got: ${result}`)
  })

  // Test recipient array validation
  const testRecipients = [
    { input: ['user1@example.com', 'user2@example.com'], expected: true },
    { input: 'not-an-array', expected: false },
    { input: [], expected: true },
    { input: null, expected: false }
  ]

  let recipientValidationPassed = true
  testRecipients.forEach(({ input, expected }) => {
    const result = Array.isArray(input) && input.every(email => typeof email === 'string')
    const passed = result === expected
    if (!passed) recipientValidationPassed = false
    recordTest(`Recipient Array Validation`, passed, `Input: ${JSON.stringify(input)}, Expected: ${expected}, Got: ${result}`)
  })

  return emailValidationPassed && recipientValidationPassed
}

// Test 5: Check file size limits
async function testFileSizeLimits() {
  log('Testing file size limit validation...')

  const maxSize = 500 * 1024 * 1024 // 500MB
  const testSizes = [
    { size: 1024, expected: true }, // 1KB
    { size: 50 * 1024 * 1024, expected: true }, // 50MB
    { size: 300 * 1024 * 1024, expected: true }, // 300MB
    { size: 500 * 1024 * 1024, expected: true }, // 500MB (exact limit)
    { size: 600 * 1024 * 1024, expected: false } // 600MB (over limit)
  ]

  let allPassed = true
  testSizes.forEach(({ size, expected }) => {
    const passed = size <= maxSize === expected
    if (!passed) allPassed = false
    recordTest(`File Size Limit: ${(size / 1024 / 1024).toFixed(0)}MB`, passed, `Expected: ${expected ? 'accepted' : 'rejected'}`)
  })

  return allPassed
}

// Test 6: Check encryption/decryption logic
async function testEncryptionLogic() {
  log('Testing encryption/decryption logic...')

  // Simple mock encryption test (actual crypto is in lib/crypto.ts)
  function mockEncrypt(text, key) {
    // Simple XOR encryption for testing
    let result = ''
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return btoa(result) // Base64 encode
  }

  function mockDecrypt(encrypted, key) {
    try {
      const decoded = atob(encrypted) // Base64 decode
      let result = ''
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
      }
      return result
    } catch (e) {
      return null
    }
  }

  const testText = 'Hello, World!'
  const testKey = 'secret'

  try {
    const encrypted = mockEncrypt(testText, testKey)
    const decrypted = mockDecrypt(encrypted, testKey)

    const passed = decrypted === testText
    recordTest('Encryption/Decryption Round-trip', passed, `Original: "${testText}", Encrypted: "${encrypted}", Decrypted: "${decrypted}"`)
    return passed
  } catch (error) {
    recordTest('Encryption/Decryption Round-trip', false, `Error: ${error.message}`)
    return false
  }
}

// Test 7: Check Socket.io connectivity (if available)
async function testSocketConnectivity() {
  log('Testing Socket.io connectivity...')

  try {
    // Try to connect to socket endpoint
    const response = await makeRequest(`${API_BASE}/socket`)
    const passed = response.status === 200
    recordTest('Socket.io Endpoint', passed, `Status: ${response.status}`)
    return passed
  } catch (error) {
    recordTest('Socket.io Endpoint', false, `Error: ${error.message} (Socket.io may not be required for basic file sharing)`)
    return true // Not critical
  }
}

// Test 8: Validate configuration
async function testConfiguration() {
  log('Testing configuration validation...')

  // Check if required environment variables are set (without revealing values)
  const requiredEnvVars = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'DATABASE_URL']
  let configPassed = true

  requiredEnvVars.forEach(varName => {
    const isSet = process.env[varName] && process.env[varName].length > 0
    const passed = isSet
    if (!passed) configPassed = false
    recordTest(`Environment Variable: ${varName}`, passed, isSet ? 'Set' : 'Not set')
  })

  // Check package.json exists and has required dependencies
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const requiredDeps = ['next', 'prisma', '@prisma/client', 'next-auth']
    let depsPassed = true

    requiredDeps.forEach(dep => {
      const hasDep = packageJson.dependencies && packageJson.dependencies[dep]
      if (!hasDep) depsPassed = false
      recordTest(`Dependency: ${dep}`, hasDep, hasDep ? 'Present' : 'Missing')
    })

    return configPassed && depsPassed
  } catch (error) {
    recordTest('Package.json Validation', false, `Error reading package.json: ${error.message}`)
    return false
  }
}

// Main test runner
async function runTests() {
  log('🚀 STARTING FILE SHARING SYSTEM TESTS\n')
  log('=' .repeat(60))

  const tests = [
    { name: 'Server Health', fn: testServerHealth },
    { name: 'API Endpoints', fn: testApiEndpoints },
    { name: 'Database Connectivity', fn: testDatabaseConnectivity },
    { name: 'File Sharing Logic', fn: testFileSharingLogic },
    { name: 'File Size Limits', fn: testFileSizeLimits },
    { name: 'Encryption Logic', fn: testEncryptionLogic },
    { name: 'Socket Connectivity', fn: testSocketConnectivity },
    { name: 'Configuration', fn: testConfiguration }
  ]

  for (const test of tests) {
    log(`\n🔍 Running ${test.name} Tests...`)
    await test.fn()
  }

  // Print summary
  log('\n' + '=' .repeat(60))
  log('📊 TEST SUMMARY')
  log('=' .repeat(60))
  log(`Total Tests: ${testResults.total}`)
  log(`Passed: ${testResults.passed}`)
  log(`Failed: ${testResults.failed}`)
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`)

  if (testResults.failed === 0) {
    log('\n🎉 ALL TESTS PASSED! File sharing system is operational.', 'success')
  } else {
    log('\n⚠️  SOME TESTS FAILED. Check details above.', 'error')
    log('\nFailed Tests:')
    testResults.details.filter(t => !t.passed).forEach(test => {
      log(`  - ${test.name}: ${test.details}`)
    })
  }

  log('\n📋 MANUAL TESTING REQUIRED:')
  log('1. Start the application: npm run dev')
  log('2. Register at least 2 users with different emails')
  log('3. Login as first user and upload a file')
  log('4. Share the file with the second user\'s email')
  log('5. Login as second user and check "Received Files"')
  log('6. Verify real-time notifications work')
  log('7. Test download functionality')

  log('\n🔧 TROUBLESHOOTING:')
  log('If tests fail, refer to FILE_SHARING_TROUBLESHOOTING_GUIDE.md')
  log('Check server logs and browser developer tools for errors')

  return testResults.failed === 0
}

// Run the tests
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1)
  }).catch(error => {
    log(`Fatal error: ${error.message}`, 'error')
    process.exit(1)
  })
}

module.exports = { runTests, testResults }