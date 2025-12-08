# File Sharing Troubleshooting Guide

## Overview
This comprehensive guide helps resolve common issues with file sharing and receiving in the Privora12 application. The system supports encrypted file sharing via email with real-time notifications.

## Common Issues and Solutions

### 1. Recipients Not Receiving Files

#### Issue: "User not registered in the system"
**Symptoms:**
- Sharing shows "0 successful shares"
- Console shows "RECIPIENT NOT FOUND" messages
- Files upload successfully but sharing fails

**Causes:**
- Recipient email doesn't match any registered user
- Email case sensitivity issues
- Email normalization problems

**Solutions:**
1. **Verify user registration:**
   ```bash
   # Check Prisma Studio at http://localhost:5556
   # Look in Users table for recipient emails
   ```
2. **Check email normalization:**
   - System converts emails to lowercase and trims whitespace
   - Ensure recipient email matches exactly (case-insensitive)
3. **Register additional users:**
   - Go to `/register` page
   - Create accounts for all intended recipients
   - Use valid email addresses

#### Issue: "Recipients must be a valid JSON array"
**Symptoms:**
- API returns 400 error
- Console shows parsing errors

**Causes:**
- Invalid JSON format in recipient field
- Malformed email array
- Frontend not sending proper data structure

**Solutions:**
1. **Check frontend recipient input:**
   - Ensure emails are in array format: `["user@example.com", "user2@example.com"]`
   - Validate email format before submission
2. **Debug API payload:**
   ```javascript
   console.log('Recipients from form:', formData.get('recipients'))
   ```

### 2. Network and Connectivity Issues

#### Issue: File Upload Fails
**Symptoms:**
- Upload progress stalls
- Network timeout errors
- Vercel Blob storage errors

**Causes:**
- Network connectivity problems
- Firewall blocking requests
- Vercel Blob service issues
- File size exceeding limits (500MB max)

**Solutions:**
1. **Check network connectivity:**
   - Verify internet connection
   - Test other websites load properly
2. **File size validation:**
   ```javascript
   const maxSize = 500 * 1024 * 1024; // 500MB
   if (file.size > maxSize) {
     alert('File exceeds 500MB limit');
   }
   ```
3. **Retry mechanism:**
   - System includes automatic retries for database operations
   - Manual retry for network failures

#### Issue: Real-time Notifications Not Working
**Symptoms:**
- Files shared but no instant notifications
- Recipients don't see files immediately
- Socket connection errors

**Causes:**
- Socket.io server not running
- WebSocket connection blocked
- Client-side JavaScript errors

**Solutions:**
1. **Check Socket.io server:**
   ```bash
   # Verify server is running
   curl http://localhost:3000/api/socket
   ```
2. **Browser developer tools:**
   - Check Network tab for WebSocket connections
   - Look for Socket.io connection errors
3. **Firewall settings:**
   - Ensure WebSocket connections aren't blocked
   - Check for proxy server interference

### 3. Permission and Access Issues

#### Issue: "Unauthorized" Errors
**Symptoms:**
- 401 status codes
- Redirected to login page
- Session expired messages

**Causes:**
- User not logged in
- Session expired
- Invalid authentication tokens

**Solutions:**
1. **Verify authentication:**
   ```javascript
   const session = await getServerSession(authOptions)
   if (!session) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
   }
   ```
2. **Check session validity:**
   - Refresh the page
   - Re-login if session expired
3. **NextAuth configuration:**
   - Verify `.env` has correct auth secrets
   - Check database connection for session storage

#### Issue: Files Not Appearing in "Received Files"
**Symptoms:**
- Sharing successful but files not visible
- Empty received files list
- Database shows FileShare records but UI doesn't update

**Causes:**
- API query issues
- Email normalization mismatch
- Database relationship problems

**Solutions:**
1. **Debug received files API:**
   ```bash
   curl -H "Cookie: session-cookie-here" http://localhost:3000/api/files/received
   ```
2. **Check database relationships:**
   ```sql
   SELECT fs.*, u.email as sender_email
   FROM FileShare fs
   JOIN File f ON fs.fileId = f.id
   LEFT JOIN User u ON f.userId = u.id
   WHERE fs.sharedWithEmail = 'recipient@example.com'
   ```
3. **Email normalization:**
   - Ensure emails are consistently normalized
   - Check for case sensitivity issues

### 4. Software Conflicts and Platform Issues

#### Issue: Browser Compatibility Problems
**Symptoms:**
- Features work in one browser but not another
- JavaScript errors in console
- Drag-and-drop not working

**Causes:**
- Browser doesn't support required features
- JavaScript disabled
- Security settings blocking features

**Solutions:**
1. **Supported browsers:**
   - Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
   - Enable JavaScript and cookies
2. **Feature detection:**
   ```javascript
   // Check for required features
   if (!window.File || !window.FileReader) {
     alert('File API not supported');
   }
   ```
3. **Clear browser cache:**
   - Hard refresh (Ctrl+F5)
   - Clear browser cache and cookies

#### Issue: Mobile Device Issues
**Symptoms:**
- Upload works on desktop but fails on mobile
- Touch interactions not working
- File selection problems

**Causes:**
- Mobile browser limitations
- File size restrictions
- Touch event handling issues

**Solutions:**
1. **Mobile optimization:**
   - Use responsive design
   - Test on actual devices
   - Consider mobile-specific UI patterns
2. **File size considerations:**
   - Mobile networks may have smaller limits
   - Consider compression for mobile uploads

### 5. Database and Backend Issues

#### Issue: Database Connection Failures
**Symptoms:**
- 503 Service Unavailable
- Database timeout errors
- Prisma connection errors

**Causes:**
- Database server down
- Connection pool exhausted
- Network issues to database

**Solutions:**
1. **Check database status:**
   ```bash
   npx prisma studio --port 5556
   ```
2. **Connection configuration:**
   ```javascript
   const prisma = await getPrismaClient()
   ```
3. **Retry logic:**
   - System includes automatic retries
   - Exponential backoff for failed operations

#### Issue: File Storage Problems
**Symptoms:**
- Files upload but can't be downloaded
- Blob storage errors
- Corrupted file data

**Causes:**
- Vercel Blob configuration issues
- Storage quota exceeded
- Network issues during upload

**Solutions:**
1. **Check Vercel Blob configuration:**
   - Verify environment variables
   - Check storage quota
2. **Upload validation:**
   ```javascript
   const blob = await put(fileName, fileData, {
     access: 'public',
     contentType: file.type
   })
   ```
3. **Download testing:**
   - Test blob URLs directly
   - Verify CORS settings

### 6. Encryption and Security Issues

#### Issue: Decryption Failures
**Symptoms:**
- Encrypted files can't be opened
- Wrong password errors
- Corrupted decrypted data

**Causes:**
- Incorrect encryption key
- Key not stored properly
- Decryption algorithm mismatch

**Solutions:**
1. **Key management:**
   ```javascript
   // Ensure encryption key is properly handled
   const encrypted = encryptFile(fileData, encryptionKey)
   ```
2. **Password validation:**
   - Verify password matches original
   - Check for typos and case sensitivity
3. **Algorithm consistency:**
   - Ensure same encryption/decryption methods

### 7. Performance Issues

#### Issue: Slow Uploads/Downloads
**Symptoms:**
- Large files take too long
- Progress indicators not updating
- Timeout errors

**Causes:**
- Network bandwidth limitations
- Large file sizes
- Server processing delays

**Solutions:**
1. **File size optimization:**
   - Compress files before upload
   - Split large files if possible
2. **Progress tracking:**
   ```javascript
   // Implement upload progress
   xhr.upload.onprogress = (event) => {
     const percent = (event.loaded / event.total) * 100
     updateProgress(percent)
   }
   ```
3. **Chunked uploads:**
   - Break large files into smaller chunks
   - Resume interrupted uploads

## Preventive Measures

### 1. Regular Maintenance
- **Monitor system health:**
  ```bash
  # Check application logs
  npm run dev 2>&1 | tee app.log
  ```
- **Database cleanup:**
  - Remove expired shares regularly
  - Archive old files
- **Update dependencies:**
  ```bash
  npm audit
  npm update
  ```

### 2. User Education
- **Clear instructions:**
  - Provide user guides for file sharing
  - Explain email registration requirements
- **Best practices:**
  - Recommend file compression
  - Suggest appropriate file sizes

### 3. Monitoring and Alerts
- **Error tracking:**
  - Implement error logging
  - Set up alerts for critical failures
- **Performance monitoring:**
  - Track upload/download times
  - Monitor database query performance

### 4. Backup and Recovery
- **Regular backups:**
  - Database backups
  - File storage backups
- **Disaster recovery:**
  - Test backup restoration
  - Document recovery procedures

## Diagnostic Tools

### Browser Developer Tools
```javascript
// Console debugging
console.log('=== UPLOAD REQUEST START ===')
console.log('File:', file)
console.log('Recipients:', recipients)
```

### Database Queries
```sql
-- Check user registrations
SELECT email, name, createdAt FROM User ORDER BY createdAt DESC;

-- Check file shares
SELECT fs.*, f.name, u.email as sender
FROM FileShare fs
JOIN File f ON fs.fileId = f.id
LEFT JOIN User u ON f.userId = u.id;

-- Check received files for user
SELECT f.*, fs.sharedAt, u.email as sender
FROM File f
JOIN FileShare fs ON f.id = fs.fileId
LEFT JOIN User u ON f.userId = u.id
WHERE fs.sharedWithEmail = 'user@example.com';
```

### API Testing
```bash
# Test file upload
curl -X POST http://localhost:3000/api/files \
  -F "file=@test.pdf" \
  -F "recipients=[\"user@example.com\"]" \
  -H "Cookie: session=your-session-cookie"

# Test received files
curl http://localhost:3000/api/files/received \
  -H "Cookie: session=your-session-cookie"
```

## Emergency Procedures

### System Down
1. Check server status
2. Restart application
3. Verify database connectivity
4. Check error logs

### Data Loss
1. Restore from backup
2. Verify file integrity
3. Notify affected users
4. Implement preventive measures

### Security Breach
1. Isolate affected systems
2. Change all credentials
3. Audit access logs
4. Notify authorities if necessary

## Support Resources

- **Documentation:** Check project README and inline code comments
- **Logs:** Review application and database logs
- **Community:** Check for similar issues in project issues
- **Professional Help:** Contact development team for complex issues

---

*This guide is regularly updated as new issues are discovered and resolved.*