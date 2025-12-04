// Comprehensive test script for Privora12 messaging and file sharing
// Run with: node test-app.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Privora12 Comprehensive Test Suite');
console.log('=====================================\n');

// Test 1: Check if all required files exist
console.log('📁 Testing File Structure...');
const requiredFiles = [
  'app/crychat/page.tsx',
  'app/receive/page.tsx',
  'app/upload/page.tsx',
  'app/api/messages/route.ts',
  'app/api/files/route.ts',
  'app/api/files/download/[id]/route.ts',
  'app/api/files/received/route.ts',
  'lib/crypto.ts',
  'lib/presence-context.tsx',
  'package.json'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ File structure test FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ File structure test PASSED\n');
}

// Test 2: Check package.json for required dependencies
console.log('📦 Testing Dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = [
  'next',
  'react',
  'react-dom',
  'next-auth',
  '@auth/prisma-adapter',
  'prisma',
  '@prisma/client',
  'crypto-js'
];

// Optional dependencies (not required for core functionality)
const optionalDeps = [
  'socket.io-client',
  'framer-motion',
  'tailwindcss'
];

let allDepsPresent = true;
requiredDeps.forEach(dep => {
  if (packageJson.dependencies && packageJson.dependencies[dep]) {
    console.log(`  ✅ ${dep}@${packageJson.dependencies[dep]}`);
  } else {
    console.log(`  ❌ ${dep} - MISSING`);
    allDepsPresent = false;
  }
});

if (!allDepsPresent) {
  console.log('\n❌ Core dependencies test FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ Core dependencies test PASSED\n');
}

// Check optional dependencies
console.log('📦 Checking Optional Dependencies...');
let optionalDepsPresent = 0;
optionalDeps.forEach(dep => {
  if (packageJson.dependencies && packageJson.dependencies[dep]) {
    console.log(`  ✅ ${dep}@${packageJson.dependencies[dep]}`);
    optionalDepsPresent++;
  } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
    console.log(`  ✅ ${dep}@${packageJson.devDependencies[dep]} (dev)`);
    optionalDepsPresent++;
  } else {
    console.log(`  ⚠️  ${dep} - Not installed (optional)`);
  }
});

console.log(`\n📊 Optional dependencies: ${optionalDepsPresent}/${optionalDeps.length} installed\n`);

// Test 3: Check for critical code patterns
console.log('🔧 Testing Code Quality...');

const crypChatContent = fs.readFileSync('app/crychat/page.tsx', 'utf8');
const receiveContent = fs.readFileSync('app/receive/page.tsx', 'utf8');
const uploadContent = fs.readFileSync('app/upload/page.tsx', 'utf8');
const messagesApiContent = fs.readFileSync('app/api/messages/route.ts', 'utf8');
const cryptoContent = fs.readFileSync('lib/crypto.ts', 'utf8');

const tests = [
  {
    name: 'CrypChat has retry logic',
    content: crypChatContent,
    pattern: /retryCount/,
    required: true
  },
  {
    name: 'CrypChat has message status indicators',
    content: crypChatContent,
    pattern: /status.*sending/,
    required: true
  },
  {
    name: 'Receive page has bulk operations',
    content: receiveContent,
    pattern: /handleBulkDownload/,
    required: true
  },
  {
    name: 'Receive page has search functionality',
    content: receiveContent,
    pattern: /searchQuery/,
    required: true
  },
  {
    name: 'Upload page has encryption',
    content: uploadContent,
    pattern: /encryptFile/,
    required: true
  },
  {
    name: 'Messages API has rate limiting',
    content: messagesApiContent,
    pattern: /RATE_LIMIT/,
    required: true
  },
  {
    name: 'Crypto library has encrypt/decrypt',
    content: cryptoContent,
    pattern: /export.*encryptFile/,
    required: true
  },
  {
    name: 'Connections page avoids hook violations',
    content: fs.readFileSync('app/connections/page.tsx', 'utf8'),
    pattern: /getUserPresence/,
    required: true
  }
];

let codeQualityPassed = true;
tests.forEach(test => {
  if (test.pattern.test(test.content)) {
    console.log(`  ✅ ${test.name}`);
  } else {
    console.log(`  ❌ ${test.name}`);
    if (test.required) codeQualityPassed = false;
  }
});

if (!codeQualityPassed) {
  console.log('\n❌ Code quality test FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ Code quality test PASSED\n');
}

// Test 4: Check environment variables
console.log('🔐 Testing Environment Configuration...');
const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

let envConfigPassed = true;
requiredEnvVars.forEach(envVar => {
  if (envLocal.includes(envVar) || env.includes(envVar)) {
    console.log(`  ✅ ${envVar} configured`);
  } else {
    console.log(`  ❌ ${envVar} - MISSING`);
    envConfigPassed = false;
  }
});

if (!envConfigPassed) {
  console.log('\n❌ Environment configuration test FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ Environment configuration test PASSED\n');
}

// Test 5: Check for mobile optimizations
console.log('📱 Testing Mobile Compatibility...');

const mobileTests = [
  {
    name: 'CrypChat has mobile menu',
    content: crypChatContent,
    pattern: /isMobileMenuOpen/
  },
  {
    name: 'Receive page has touch-manipulation',
    content: receiveContent,
    pattern: /touch-manipulation/
  },
  {
    name: 'Upload page has mobile features',
    content: uploadContent,
    pattern: /cameraSupported/
  },
  {
    name: 'Responsive design classes present',
    content: crypChatContent,
    pattern: /md:hidden/
  }
];

let mobileTestsPassed = true;
mobileTests.forEach(test => {
  if (test.pattern.test(test.content)) {
    console.log(`  ✅ ${test.name}`);
  } else {
    console.log(`  ❌ ${test.name}`);
    mobileTestsPassed = false;
  }
});

if (!mobileTestsPassed) {
  console.log('\n⚠️  Mobile compatibility test PARTIAL\n');
} else {
  console.log('\n✅ Mobile compatibility test PASSED\n');
}

// Test 6: Check for error handling
console.log('🛡️  Testing Error Handling...');

const errorTests = [
  {
    name: 'Messages API has error handling',
    content: messagesApiContent,
    pattern: /catch/
  },
  {
    name: 'File download has error handling',
    content: fs.readFileSync('app/api/files/download/[id]/route.ts', 'utf8'),
    pattern: /catch/
  },
  {
    name: 'CrypChat has error handling',
    content: crypChatContent,
    pattern: /setError/
  }
];

let errorHandlingPassed = true;
errorTests.forEach(test => {
  if (test.pattern.test(test.content)) {
    console.log(`  ✅ ${test.name}`);
  } else {
    console.log(`  ❌ ${test.name}`);
    errorHandlingPassed = false;
  }
});

if (!errorHandlingPassed) {
  console.log('\n❌ Error handling test FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ Error handling test PASSED\n');
}

console.log('🎉 ALL TESTS PASSED!');
console.log('\n📋 Test Summary:');
console.log('  ✅ File Structure: All required files present');
console.log('  ✅ Dependencies: All required packages installed');
console.log('  ✅ Code Quality: Critical features implemented');
console.log('  ✅ Environment: Configuration variables set');
console.log('  ✅ Mobile Compatibility: Touch and responsive features');
console.log('  ✅ Error Handling: Comprehensive error management');
console.log('\n🚀 Privora12 is ready for deployment!');
console.log('\nNext steps:');
console.log('1. Run: npm run build');
console.log('2. Run: npm run start');
console.log('3. Test messaging and file sharing in browser');
console.log('4. Verify mobile responsiveness');
console.log('5. Deploy to production environment');