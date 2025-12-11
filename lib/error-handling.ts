export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  QUOTA_EXCEEDED_ERROR = 'QUOTA_EXCEEDED_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface AppError {
  type: ErrorType
  message: string
  details?: any
  statusCode: number
  isOperational: boolean // Distinguishes operational errors from programming errors
  stack?: string
}

export class AppError extends Error implements AppError {
  constructor(
    type: ErrorType,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message)
    this.type = type
    this.message = message
    this.statusCode = statusCode
    this.details = details
    this.isOperational = isOperational
    this.name = 'AppError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

// Error factory functions
export const createValidationError = (message: string, details?: any) =>
  new AppError(ErrorType.VALIDATION_ERROR, message, 400, details)

export const createAuthenticationError = (message: string = 'Authentication required') =>
  new AppError(ErrorType.AUTHENTICATION_ERROR, message, 401)

export const createAuthorizationError = (message: string = 'Access denied') =>
  new AppError(ErrorType.AUTHORIZATION_ERROR, message, 403)

export const createNotFoundError = (resource: string = 'Resource') =>
  new AppError(ErrorType.NOT_FOUND_ERROR, `${resource} not found`, 404)

export const createConflictError = (message: string, details?: any) =>
  new AppError(ErrorType.CONFLICT_ERROR, message, 409, details)

export const createNetworkError = (message: string = 'Network error occurred') =>
  new AppError(ErrorType.NETWORK_ERROR, message, 502)

export const createTimeoutError = (message: string = 'Request timed out') =>
  new AppError(ErrorType.TIMEOUT_ERROR, message, 408)

export const createStorageError = (message: string = 'Storage operation failed') =>
  new AppError(ErrorType.STORAGE_ERROR, message, 502)

export const createEncryptionError = (message: string = 'Encryption/decryption failed') =>
  new AppError(ErrorType.ENCRYPTION_ERROR, message, 500)

export const createDatabaseError = (message: string = 'Database operation failed') =>
  new AppError(ErrorType.DATABASE_ERROR, message, 500, undefined, false)

export const createFileSystemError = (message: string = 'File system operation failed') =>
  new AppError(ErrorType.FILE_SYSTEM_ERROR, message, 500)

export const createRateLimitError = (message: string = 'Rate limit exceeded') =>
  new AppError(ErrorType.RATE_LIMIT_ERROR, message, 429)

export const createQuotaExceededError = (message: string = 'Storage quota exceeded') =>
  new AppError(ErrorType.QUOTA_EXCEEDED_ERROR, message, 413)

export const createInternalError = (message: string = 'Internal server error', details?: any) =>
  new AppError(ErrorType.INTERNAL_ERROR, message, 500, details, false)

// Error response formatter
export function formatErrorResponse(error: AppError | Error): {
  error: string
  type?: ErrorType
  details?: any
  timestamp: string
} {
  const baseResponse = {
    error: error.message,
    timestamp: new Date().toISOString()
  }

  if (error instanceof AppError) {
    return {
      ...baseResponse,
      type: error.type,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined
    }
  }

  return baseResponse
}

// Global error handler for API routes
export async function handleApiError(
  error: any,
  context: string = 'Unknown operation',
  logError: boolean = true
): Promise<{ error: AppError; response: any }> {
  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else if (error?.name === 'ValidationError') {
    appError = createValidationError('Invalid input data', error.details)
  } else if (error?.name === 'UnauthorizedError') {
    appError = createAuthenticationError()
  } else if (error?.code === 'P1001' || error?.code?.startsWith('P')) {
    // Prisma database errors
    appError = createDatabaseError('Database operation failed')
  } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
    appError = createNetworkError('Service unavailable')
  } else if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
    appError = createTimeoutError()
  } else {
    appError = createInternalError('An unexpected error occurred')
  }

  if (logError) {
    console.error(`[${context}] ${appError.type}: ${appError.message}`, {
      details: appError.details,
      stack: appError.stack,
      originalError: error
    })
  }

  return {
    error: appError,
    response: formatErrorResponse(appError)
  }
}

// Retry utility with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: string = 'Operation'
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries) {
        break
      }

      // Don't retry certain types of errors
      if (error instanceof AppError) {
        if (error.type === ErrorType.AUTHENTICATION_ERROR ||
            error.type === ErrorType.AUTHORIZATION_ERROR ||
            error.type === ErrorType.VALIDATION_ERROR ||
            error.type === ErrorType.NOT_FOUND_ERROR) {
          throw error
        }
      }

      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
      console.warn(`[${context}] Attempt ${attempt} failed, retrying in ${delay}ms:`, error instanceof Error ? error.message : String(error))
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Safe async operation wrapper
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string = 'Async operation',
  fallback?: T
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    console.error(`[${context}] Failed:`, error)
    return fallback || null
  }
}

// File operation safety wrapper
export async function safeFileOperation<T>(
  operation: () => Promise<T>,
  filePath: string,
  operationType: string = 'file operation'
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw createNotFoundError(`File not found: ${filePath}`)
    } else if (error?.code === 'EACCES' || error?.code === 'EPERM') {
      throw createAuthorizationError(`Access denied to file: ${filePath}`)
    } else if (error?.code === 'ENOSPC') {
      throw createQuotaExceededError('Insufficient disk space')
    } else if (error?.code === 'EMFILE' || error?.code === 'ENFILE') {
      throw createInternalError('Too many open files')
    } else {
      throw createFileSystemError(`${operationType} failed for ${filePath}: ${error.message}`)
    }
  }
}

// Database operation safety wrapper
export async function safeDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'Database operation'
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    if (error?.code?.startsWith('P')) {
      // Prisma error codes
      if (error.code === 'P1001') {
        throw createDatabaseError('Database server unreachable')
      } else if (error.code === 'P2002') {
        throw createConflictError('Unique constraint violation', error.meta)
      } else if (error.code === 'P2025') {
        throw createNotFoundError('Record not found')
      } else {
        throw createDatabaseError(`${operationName} failed: ${error.message}`)
      }
    } else {
      throw createDatabaseError(`${operationName} failed: ${error.message}`)
    }
  }
}