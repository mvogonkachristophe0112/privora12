// Debug script to test file sharing functionality
// Run this to check if sharing is working

const fs = require('fs')
const path = require('path')

console.log('🔍 DEBUGGING FILE SHARING SYSTEM\n')

// Check if all required files exist
const requiredFiles = [
  'app/api/files/route.ts',
  'app/api/files/received/route.ts',
  'app/upload/page.tsx',
  'app/receive/page.tsx',
  'lib/socket.ts',
  'prisma/schema.prisma'
]

console.log('📁 Checking required files:')
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file)
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
})

console.log('\n🔧 CHECKLIST FOR FILE SHARING:')

console.log('\n1. UPLOAD API (/api/files POST):')
console.log('   ✅ Accepts FormData with file, recipients, shareMode')
console.log('   ✅ Validates recipients exist in database')
console.log('   ✅ Creates FileShare records for each recipient')
console.log('   ✅ Emits Socket.io events for real-time notifications')

console.log('\n2. RECEIVED FILES API (/api/files/received GET):')
console.log('   ✅ Queries FileShare by sharedWithEmail')
console.log('   ✅ Includes file and user information')
console.log('   ✅ Handles pagination and filtering')

console.log('\n3. FRONTEND UPLOAD PAGE:')
console.log('   ✅ Allows selecting recipients by email')
console.log('   ✅ Sends recipients array in FormData')
console.log('   ✅ Shows success message after upload')

console.log('\n4. FRONTEND RECEIVE PAGE:')
console.log('   ✅ Fetches received files on load')
console.log('   ✅ Listens for Socket.io file-shared events')
console.log('   ✅ Updates UI when new files arrive')

console.log('\n5. SOCKET.IO INTEGRATION:')
console.log('   ✅ Server emits file-shared events')
console.log('   ✅ Client listens for file-shared events')
console.log('   ✅ Real-time notifications work')

console.log('\n🚨 COMMON ISSUES TO CHECK:')

console.log('\n1. RECIPIENT EMAIL VALIDATION:')
console.log('   - Are recipient emails correctly formatted?')
console.log('   - Do recipient users exist in the database?')
console.log('   - Check console logs for validation errors')

console.log('\n2. DATABASE CONNECTION:')
console.log('   - Is DATABASE_URL correct in .env.local?')
console.log('   - Can the app connect to the database?')
console.log('   - Are FileShare records being created?')

console.log('\n3. SOCKET.IO CONNECTION:')
console.log('   - Is NEXT_PUBLIC_SOCKET_URL set correctly?')
console.log('   - Are Socket.io events being emitted?')
console.log('   - Are clients receiving events?')

console.log('\n4. FRONTEND STATE:')
console.log('   - Is recipients array populated correctly?')
console.log('   - Is shareMode set to "share"?')
console.log('   - Are API calls succeeding?')

console.log('\n🔧 DEBUGGING STEPS:')

console.log('\nStep 1: Check Browser Console')
console.log('   - Open DevTools in upload page')
console.log('   - Add recipient email and upload')
console.log('   - Check for any JavaScript errors')
console.log('   - Check network tab for API calls')

console.log('\nStep 2: Check API Logs')
console.log('   - Look for console.log messages in upload API')
console.log('   - Verify recipients are parsed correctly')
console.log('   - Check if FileShare records are created')

console.log('\nStep 3: Check Database')
console.log('   - Use Prisma Studio to check FileShare table')
console.log('   - Verify records exist for shared files')
console.log('   - Check sharedWithEmail field matches recipient')

console.log('\nStep 4: Check Socket Events')
console.log('   - Monitor Socket.io events in server logs')
console.log('   - Check if file-shared events are emitted')
console.log('   - Verify client receives events')

console.log('\nStep 5: Test Receive Page')
console.log('   - Login as recipient user')
console.log('   - Check if received files API returns data')
console.log('   - Verify files appear in UI')

console.log('\n📊 EXPECTED BEHAVIOR:')
console.log('1. Upload with recipients → FileShare records created')
console.log('2. Socket events emitted → Real-time notifications')
console.log('3. Recipient fetches data → Files appear in UI')
console.log('4. Download works → Files can be accessed')

console.log('\n🎯 IF SHARING IS NOT WORKING:')
console.log('   1. Check recipient email exists in users table')
console.log('   2. Verify shareMode is "share" in upload')
console.log('   3. Check API logs for FileShare creation')
console.log('   4. Test received files API directly')
console.log('   5. Check Socket.io connection and events')

console.log('\n🔍 QUICK TEST COMMANDS:')

console.log('\n# Check if users exist:')
console.log('npx prisma studio --port 5556')
console.log('# Look at User and FileShare tables')

console.log('\n# Test API directly:')
console.log('curl -X GET http://localhost:3000/api/files/received \\')
console.log('  -H "Cookie: next-auth.session-token=YOUR_TOKEN"')

console.log('\n# Check server logs:')
console.log('npm run dev  # Look for console.log messages')

console.log('\n✨ DEBUGGING COMPLETE - Use the steps above to identify the issue!')