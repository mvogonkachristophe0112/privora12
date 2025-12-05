# 🔍 DEBUGGING FILE SHARING ISSUES

## Problem Description
Users report: "0 file(s) uploaded and shared successfully! (1 failed)" and received files page shows no files.

## Step-by-Step Debugging Process

### Step 1: Check Server Logs
When you upload a file, check the terminal running `npm run dev` for detailed logs:

```
=== UPLOAD REQUEST START ===
File provided: true/false
File name: [filename]
File size: [size in bytes]
Parsed recipients: ["email1@example.com", "email2@example.com"]
Recipients length: 2
Share mode: share/upload
Encrypt: true/false
Encryption key provided: true/false
```

### Step 2: Analyze Recipient Processing
Look for these logs for each recipient:

```
=== SHARING LOGIC START ===
Share mode is "share" and recipients provided: 2 recipients
--- Processing recipient: email1@example.com ---
Original email: email1@example.com -> Normalized: email1@example.com
Checking if user exists in database...
Database query result: USER FOUND/USER NOT FOUND
```

### Step 3: Check User Validation Results
If user is found:
```
✅ Recipient validation passed for: email1@example.com
```

If user is NOT found:
```
❌ RECIPIENT VALIDATION FAILED: User not found for email: email1@example.com
```

### Step 4: Check FileShare Creation
For successful validations, look for:
```
Successfully created file share: {
  shareId: [uuid],
  fileId: [file-id],
  senderId: [sender-id],
  receiverEmail: email1@example.com,
  receiverUserId: [receiver-user-id]
}
```

### Step 5: Check Socket Notifications
Look for:
```
📡 Emitting "file-shared" event:
  To: [Recipient Name] (email1@example.com)
  File: [filename]
  From: [Sender Name] ([sender-email])
```

### Step 6: Check Final Results
```
=== SHARING RESULTS ===
Total recipients processed: 2
Successful shares: 1
Failed shares: 1
=== UPLOAD RESPONSE ===
File ID: [file-id]
Response message: File uploaded and shared successfully
```

## Common Issues & Solutions

### Issue 1: Recipients Array is Empty
**Symptoms:** `Recipients length: 0`
**Cause:** Recipients not being sent from frontend
**Solution:** Check that recipients are added in the upload form

### Issue 2: Share Mode is Wrong
**Symptoms:** `Share mode: upload` but trying to share
**Cause:** Wrong mode selected in UI
**Solution:** Select "Upload & Share" mode

### Issue 3: Recipient Email Doesn't Exist
**Symptoms:** `❌ RECIPIENT VALIDATION FAILED: User not found`
**Cause:** Email not registered in the system
**Solution:** Ensure recipient has an account

### Issue 4: Database Connection Issues
**Symptoms:** Prisma errors in logs
**Cause:** Database not running or misconfigured
**Solution:** Check DATABASE_URL and run `npx prisma studio`

### Issue 5: Socket Connection Issues
**Symptoms:** No socket event logs
**Cause:** Socket.io not connected
**Solution:** Check NEXT_PUBLIC_SOCKET_URL environment variable

## Testing Commands

### Check Database Users
```bash
npx prisma studio --port 5556
# Look at User table for registered emails
```

### Test API Directly
```bash
# Check received files
curl -X GET http://localhost:3000/api/files/received \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Check File Shares
```bash
# In Prisma Studio, check FileShare table
# Look for records with sharedWithEmail matching your test user
```

## Quick Diagnosis Checklist

- [ ] Server logs show "File provided: true"
- [ ] Recipients array is populated
- [ ] Share mode is "share"
- [ ] Recipient emails exist in User table
- [ ] FileShare records are created
- [ ] Socket events are emitted
- [ ] Response shows "shared successfully"

## Most Likely Causes

1. **Recipient email not registered** - Most common issue
2. **Recipients not sent from frontend** - Check form submission
3. **Database connection issues** - Check Prisma setup
4. **Socket.io configuration** - Check environment variables

## Next Steps

1. Try uploading with a recipient email that definitely exists
2. Check the detailed server logs for the exact failure point
3. Use Prisma Studio to verify database state
4. Test with different recipient emails

## Emergency Fix

If all else fails, temporarily modify the API to skip recipient validation:

```typescript
// In app/api/files/route.ts, temporarily comment out validation:
if (!recipientUser) {
  console.log('⚠️ SKIPPING VALIDATION FOR DEBUGGING')
  // continue // Remove this to skip validation
}
```

This will help isolate if the issue is validation or something else.