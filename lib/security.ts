import path from 'path'
import { createValidationError, createAuthorizationError } from './error-handling'

// Path sanitization utilities
export class PathSanitizer {
  private static readonly FORBIDDEN_PATTERNS = [
    /\.\./,  // Directory traversal
    /^\//,   // Absolute paths
    /^[a-zA-Z]:/, // Windows drive letters
    /[<>:|?*]/, // Windows forbidden characters
    /[\x00-\x1f\x7f-\x9f]/, // Control characters
    /\/\.+/, // Hidden files/directories
    /\\\.+/, // Windows hidden files/directories
  ]

  private static readonly MAX_PATH_LENGTH = 260 // Windows MAX_PATH
  private static readonly ALLOWED_EXTENSIONS = [
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.rtf', '.odt', '.ods', '.odp',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg',
    // Videos
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv',
    // Audio
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma',
    // Archives
    '.zip', '.rar', '.7z', '.tar', '.gz',
    // Other common types
    '.json', '.xml', '.csv', '.html', '.css', '.js'
  ]

  /**
   * Sanitizes a file path to prevent directory traversal and other attacks
   */
  static sanitizeFilePath(inputPath: string, baseDir?: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw createValidationError('Invalid file path')
    }

    // Check length
    if (inputPath.length > this.MAX_PATH_LENGTH) {
      throw createValidationError('File path too long')
    }

    // Normalize path separators
    let sanitized = inputPath.replace(/\\/g, '/')

    // Remove leading/trailing whitespace
    sanitized = sanitized.trim()

    // Check for forbidden patterns
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(sanitized)) {
        throw createValidationError('Invalid file path: contains forbidden characters')
      }
    }

    // Resolve against base directory if provided
    if (baseDir) {
      const resolved = path.resolve(baseDir, sanitized)
      const relative = path.relative(baseDir, resolved)

      // Ensure the resolved path is still within the base directory
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw createAuthorizationError('Access denied: path traversal attempt')
      }

      sanitized = relative
    }

    // Final normalization
    sanitized = path.normalize(sanitized)

    // Remove any remaining dangerous patterns
    if (sanitized.includes('..') || sanitized.includes('\0')) {
      throw createValidationError('Invalid file path after normalization')
    }

    return sanitized
  }

  /**
   * Validates file extension against allowed types
   */
  static validateFileExtension(filename: string): boolean {
    if (!filename || typeof filename !== 'string') {
      return false
    }

    const ext = path.extname(filename).toLowerCase()
    return this.ALLOWED_EXTENSIONS.includes(ext)
  }

  /**
   * Sanitizes filename to prevent issues
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw createValidationError('Invalid filename')
    }

    // Remove path components
    const baseName = path.basename(filename)

    // Remove dangerous characters but keep spaces and common punctuation
    const sanitized = baseName.replace(/[<>:"|?*\x00-\x1f\x7f-\x9f]/g, '')

    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized)
      const name = path.basename(sanitized, ext)
      return name.substring(0, 255 - ext.length) + ext
    }

    return sanitized
  }

  /**
   * Generates a secure random filename
   */
  static generateSecureFilename(originalName: string, prefix: string = ''): string {
    const ext = path.extname(originalName)
    const randomId = crypto.randomUUID()
    const timestamp = Date.now()
    const prefixStr = prefix ? `${prefix}-` : ''

    return `${prefixStr}${timestamp}-${randomId}${ext}`
  }
}

// Input validation utilities
export class InputValidator {
  private static readonly MAX_STRING_LENGTH = 10000
  private static readonly MAX_ARRAY_LENGTH = 1000

  /**
   * Validates and sanitizes string input
   */
  static sanitizeString(input: any, maxLength: number = this.MAX_STRING_LENGTH): string {
    if (input === null || input === undefined) {
      return ''
    }

    const str = String(input).trim()

    if (str.length > maxLength) {
      throw createValidationError(`Input exceeds maximum length of ${maxLength} characters`)
    }

    // Remove null bytes and control characters
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  }

  /**
   * Validates email format
   */
  static validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

    return emailRegex.test(email) && email.length <= 254
  }

  /**
   * Validates array input
   */
  static validateArray(input: any, maxLength: number = this.MAX_ARRAY_LENGTH): string[] {
    if (!Array.isArray(input)) {
      throw createValidationError('Input must be an array')
    }

    if (input.length > maxLength) {
      throw createValidationError(`Array exceeds maximum length of ${maxLength} items`)
    }

    return input.map(item => this.sanitizeString(item, 1000))
  }

  /**
   * Validates UUID format
   */
  static validateUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  /**
   * Validates file size
   */
  static validateFileSize(size: number, maxSize: number = 500 * 1024 * 1024): void {
    if (typeof size !== 'number' || size < 0) {
      throw createValidationError('Invalid file size')
    }

    if (size > maxSize) {
      throw createValidationError(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`)
    }
  }
}

// Rate limiting utilities
export class RateLimiter {
  private static limits = new Map<string, { count: number; resetTime: number }>()

  /**
   * Checks if request is within rate limits
   */
  static checkLimit(
    identifier: string,
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000 // 15 minutes
  ): boolean {
    const now = Date.now()
    const key = `${identifier}:${Math.floor(now / windowMs)}`

    const current = this.limits.get(key) || { count: 0, resetTime: now + windowMs }

    if (now > current.resetTime) {
      current.count = 0
      current.resetTime = now + windowMs
    }

    if (current.count >= maxRequests) {
      return false
    }

    current.count++
    this.limits.set(key, current)
    return true
  }

  /**
   * Middleware function for API routes
   */
  static createMiddleware(
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000,
    identifierFn?: (request: Request) => string
  ) {
    return (request: Request) => {
      const identifier = identifierFn
        ? identifierFn(request)
        : request.headers.get('x-forwarded-for') || 'anonymous'

      if (!this.checkLimit(identifier, maxRequests, windowMs)) {
        throw createValidationError('Rate limit exceeded. Please try again later.')
      }
    }
  }
}

// Content Security Policy utilities
export class ContentSecurity {
  /**
   * Validates content type against allowed types
   */
  static validateContentType(contentType: string, allowedTypes: string[]): boolean {
    if (!contentType || !allowedTypes.length) {
      return false
    }

    const normalizedType = contentType.toLowerCase().split(';')[0].trim()

    return allowedTypes.some(allowed => {
      if (allowed.includes('*')) {
        const [mainType] = allowed.split('/')
        return normalizedType.startsWith(mainType)
      }
      return normalizedType === allowed
    })
  }

  /**
   * Sanitizes HTML content (basic XSS prevention)
   */
  static sanitizeHtml(input: string): string {
    if (!input) return ''

    return input
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * Validates file upload content
   */
  static async validateFileUpload(
    file: File,
    allowedTypes: string[] = ['image/*', 'video/*', 'audio/*', 'application/pdf'],
    maxSize: number = 100 * 1024 * 1024 // 100MB
  ): Promise<void> {
    // Check file size
    InputValidator.validateFileSize(file.size, maxSize)

    // Check content type
    if (!this.validateContentType(file.type, allowedTypes)) {
      throw createValidationError(`File type ${file.type} is not allowed`)
    }

    // Additional security checks can be added here
    // e.g., virus scanning, content analysis, etc.
  }
}

// SQL injection prevention (additional layer)
export class SQLSanitizer {
  /**
   * Basic SQL injection pattern detection
   */
  static detectSQLInjection(input: string): boolean {
    if (!input) return false

    const dangerousPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
      /(-{2}|\/\*|\*\/)/, // Comments
      /('|(\\x27)|(\\x2D))/, // Quotes and dashes
      /(;|(\\x3B))/, // Semicolons
      /(\\x00)/, // Null bytes
    ]

    return dangerousPatterns.some(pattern => pattern.test(input))
  }

  /**
   * Sanitizes input for database queries (additional layer)
   */
  static sanitizeForDatabase(input: string): string {
    if (!input) return ''

    // This is an additional layer - Prisma already handles SQL injection
    // But we can add custom validation here
    if (this.detectSQLInjection(input)) {
      throw createValidationError('Input contains potentially dangerous SQL patterns')
    }

    return input
  }
}

// Session security utilities
export class SessionSecurity {
  /**
   * Validates session freshness
   */
  static validateSessionAge(session: any, maxAge: number = 24 * 60 * 60 * 1000): boolean {
    if (!session?.iat) return false

    const sessionAge = Date.now() - (session.iat * 1000)
    return sessionAge <= maxAge
  }

  /**
   * Checks for suspicious session activity
   */
  static detectSuspiciousActivity(session: any, request: Request): boolean {
    // Implement suspicious activity detection logic
    // e.g., check IP changes, unusual login times, etc.
    return false // Placeholder
  }
}