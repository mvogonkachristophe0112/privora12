# Receive Files Implementation Plan

## Overview
Implement comprehensive file receiving functionality with decryption capabilities, building on existing upload and sharing features.

## Current State Analysis
- Upload page has advanced features: encryption, sharing, batch uploads, compression
- Receive page uses mock data, no real API integration
- Database schema supports file sharing via FileShare model
- Crypto library has encrypt/decrypt functions
- API currently only returns user's own files

## Implementation Steps

### Phase 1: API Development
1. **Create `/api/files/received` endpoint**
   - Fetch files shared with current user via FileShare table
   - Include sender information (email from User table)
   - Return file metadata, timestamps, encryption status
   - Handle expired shares and revoked permissions

2. **Update existing `/api/files` endpoint**
   - Add query parameter to distinguish owned vs received files
   - Ensure proper authorization checks

### Phase 2: Frontend Data Fetching
3. **Update receive page (`app/receive/page.tsx`)**
   - Replace mock data with real API calls
   - Add loading states and error handling
   - Implement data refresh functionality

4. **Enhance file display**
   - Show sender email prominently
   - Format timestamps properly (relative time, locale-aware)
   - Display file type with appropriate icons
   - Add file size formatting

### Phase 3: Decryption UI
5. **Create decryption modal/component**
   - Modal overlay for encrypted files
   - Password input field with validation
   - Progress indicator during decryption
   - Error display for failed decryption attempts

6. **Implement decryption logic**
   - Fetch encrypted file data from blob storage
   - Apply decryption using provided password
   - Handle decryption errors gracefully
   - Provide download of decrypted file

### Phase 4: Download & Security
7. **Secure download functionality**
   - Implement secure blob download
   - Handle both encrypted and non-encrypted files
   - Add download progress tracking
   - Prevent unauthorized access

8. **Error handling**
   - Network errors during file fetch
   - Invalid decryption keys
   - Corrupted file data
   - Expired share links

### Phase 5: UI/UX Enhancements
9. **Mobile responsiveness**
   - Responsive grid layout for file list
   - Touch-friendly buttons and interactions
   - Optimized modal for mobile screens

10. **State management**
    - React hooks for decryption state
    - Loading states for all async operations
    - Error state management
    - Progress tracking for downloads/decryption

### Phase 6: Integration & Testing
11. **Integration testing**
    - Test with existing upload/sharing flow
    - Verify encryption/decryption round-trip
    - Test various file types and sizes

12. **User feedback**
    - Success/error notifications
    - Loading indicators
    - Progress bars for long operations

## Technical Considerations
- **Step-by-step implementation** to avoid API crashes
- **Proper error boundaries** for decryption failures
- **Memory management** for large file downloads
- **Security** - never store decryption keys in client state
- **Performance** - lazy load file previews, pagination for large lists

## Database Queries Needed
```sql
-- Get received files for user
SELECT f.*, fs.createdAt as sharedAt, u.email as senderEmail
FROM File f
JOIN FileShare fs ON f.id = fs.fileId
LEFT JOIN User u ON f.userId = u.id
WHERE fs.sharedWithEmail = ? AND fs.revoked = false
AND (fs.expiresAt IS NULL OR fs.expiresAt > NOW())
ORDER BY fs.createdAt DESC
```

## API Response Format
```typescript
interface ReceivedFile {
  id: string
  name: string
  originalName: string
  size: number
  type: string
  url: string
  encrypted: boolean
  fileType: string
  senderEmail: string
  sharedAt: string
  permissions: string
  expiresAt?: string
}
```

## Component Architecture
- `ReceivePage` - Main container
- `FileList` - Grid/list of received files
- `FileCard` - Individual file display
- `DecryptionModal` - Password input and decryption
- `DownloadProgress` - Progress tracking component