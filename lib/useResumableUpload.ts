"use client"

import { useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface UploadProgress {
  fileId: string
  fileName: string
  totalSize: number
  uploadedSize: number
  progress: number
  status: 'uploading' | 'paused' | 'completed' | 'failed' | 'resuming'
  chunks: {
    total: number
    uploaded: number[]
    current: number
  }
  error?: string
  startTime: number
  estimatedTimeRemaining?: number
}

interface ResumableUploadOptions {
  chunkSize?: number
  maxRetries?: number
  onProgress?: (progress: UploadProgress) => void
  onComplete?: (fileId: string) => void
  onError?: (error: string) => void
}

export function useResumableUpload(options: ResumableUploadOptions = {}) {
  const { data: session } = useSession()
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map())
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  const {
    chunkSize = 1024 * 1024, // 1MB chunks
    maxRetries = 3,
    onProgress,
    onComplete,
    onError
  } = options

  // Generate unique file ID
  const generateFileId = useCallback(() => {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Check existing upload progress
  const checkUploadProgress = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/upload/chunk?fileId=${fileId}`)
      if (response.ok) {
        const data = await response.json()
        return {
          uploadedChunks: data.uploadedChunks || [],
          totalChunks: data.totalChunks || 0,
          fileName: data.fileName,
          fileSize: data.fileSize
        }
      }
    } catch (error) {
      console.warn('Failed to check upload progress:', error)
    }
    return null
  }, [])

  // Upload a single chunk
  const uploadChunk = useCallback(async (
    fileId: string,
    file: File,
    chunkIndex: number,
    totalChunks: number,
    retryCount = 0
  ): Promise<boolean> => {
    const start = chunkIndex * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)

    const formData = new FormData()
    formData.append('fileId', fileId)
    formData.append('chunkIndex', chunkIndex.toString())
    formData.append('totalChunks', totalChunks.toString())
    formData.append('fileName', file.name)
    formData.append('fileSize', file.size.toString())
    formData.append('chunk', chunk)

    const abortController = abortControllers.current.get(fileId)
    if (abortController?.signal.aborted) {
      return false
    }

    try {
      const response = await fetch('/api/files/upload/chunk', {
        method: 'POST',
        body: formData,
        signal: abortController?.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.complete) {
        // Upload completed
        setUploads(prev => {
          const newUploads = new Map(prev)
          const upload = newUploads.get(fileId)
          if (upload) {
            upload.status = 'completed'
            upload.progress = 100
            upload.uploadedSize = upload.totalSize
            onComplete?.(fileId)
          }
          return newUploads
        })
        return true
      }

      return true
    } catch (error) {
      if (retryCount < maxRetries && !abortController?.signal.aborted) {
        console.warn(`Chunk ${chunkIndex} failed, retrying (${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))) // Exponential backoff
        return uploadChunk(fileId, file, chunkIndex, totalChunks, retryCount + 1)
      }

      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setUploads(prev => {
        const newUploads = new Map(prev)
        const upload = newUploads.get(fileId)
        if (upload) {
          upload.status = 'failed'
          upload.error = errorMessage
          onError?.(errorMessage)
        }
        return newUploads
      })
      return false
    }
  }, [chunkSize, maxRetries, onComplete, onError])

  // Start resumable upload
  const startUpload = useCallback(async (file: File): Promise<string> => {
    if (!session?.user) {
      throw new Error('User not authenticated')
    }

    const fileId = generateFileId()
    const totalChunks = Math.ceil(file.size / chunkSize)

    // Initialize upload progress
    const progress: UploadProgress = {
      fileId,
      fileName: file.name,
      totalSize: file.size,
      uploadedSize: 0,
      progress: 0,
      status: 'uploading',
      chunks: {
        total: totalChunks,
        uploaded: [],
        current: 0
      },
      startTime: Date.now()
    }

    setUploads(prev => new Map(prev.set(fileId, progress)))
    abortControllers.current.set(fileId, new AbortController())

    // Check for existing progress
    const existingProgress = await checkUploadProgress(fileId)
    let startChunk = 0

    if (existingProgress && existingProgress.uploadedChunks.length > 0) {
      progress.status = 'resuming'
      progress.chunks.uploaded = existingProgress.uploadedChunks
      progress.uploadedSize = existingProgress.uploadedChunks.length * chunkSize
      progress.progress = (existingProgress.uploadedChunks.length / totalChunks) * 100
      startChunk = Math.max(...existingProgress.uploadedChunks) + 1
    }

    // Upload chunks sequentially
    for (let i = startChunk; i < totalChunks; i++) {
      progress.chunks.current = i
      progress.status = 'uploading'

      const success = await uploadChunk(fileId, file, i, totalChunks)
      if (!success) break

      // Update progress
      progress.chunks.uploaded.push(i)
      progress.uploadedSize = (i + 1) * chunkSize
      progress.progress = ((i + 1) / totalChunks) * 100

      // Calculate estimated time remaining
      const elapsed = Date.now() - progress.startTime
      const remainingChunks = totalChunks - (i + 1)
      if (remainingChunks > 0 && i > 0) {
        const avgTimePerChunk = elapsed / (i + 1)
        progress.estimatedTimeRemaining = avgTimePerChunk * remainingChunks
      }

      setUploads(prev => {
        const newUploads = new Map(prev)
        newUploads.set(fileId, { ...progress })
        return newUploads
      })

      onProgress?.(progress)
    }

    return fileId
  }, [session, generateFileId, chunkSize, checkUploadProgress, uploadChunk, onProgress])

  // Pause upload
  const pauseUpload = useCallback((fileId: string) => {
    const abortController = abortControllers.current.get(fileId)
    if (abortController) {
      abortController.abort()
    }

    setUploads(prev => {
      const newUploads = new Map(prev)
      const upload = newUploads.get(fileId)
      if (upload && upload.status === 'uploading') {
        upload.status = 'paused'
      }
      return newUploads
    })
  }, [])

  // Resume upload
  const resumeUpload = useCallback(async (fileId: string) => {
    const upload = uploads.get(fileId)
    if (!upload || upload.status !== 'paused') return

    // Create new abort controller
    abortControllers.current.set(fileId, new AbortController())

    // Resume from where we left off
    const file = upload.fileName // We need to store the original file somewhere
    if (!file) {
      console.error('Cannot resume upload: original file not available')
      return
    }

    // This would need the original file object, which we'd need to store
    // For now, this is a placeholder
    console.log('Resume functionality needs original file object')
  }, [uploads])

  // Cancel upload
  const cancelUpload = useCallback((fileId: string) => {
    const abortController = abortControllers.current.get(fileId)
    if (abortController) {
      abortController.abort()
    }

    abortControllers.current.delete(fileId)
    setUploads(prev => {
      const newUploads = new Map(prev)
      newUploads.delete(fileId)
      return newUploads
    })
  }, [])

  // Get upload progress
  const getUploadProgress = useCallback((fileId: string) => {
    return uploads.get(fileId)
  }, [uploads])

  // Get all uploads
  const getAllUploads = useCallback(() => {
    return Array.from(uploads.values())
  }, [uploads])

  return {
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    getUploadProgress,
    getAllUploads,
    uploads
  }
}