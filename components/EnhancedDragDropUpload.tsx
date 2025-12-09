"use client"

import React, { useState, useRef, useCallback } from 'react'
import { useResumableUpload } from '@/lib/useResumableUpload'
import { Loading } from './Loading'

interface FileUpload {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused'
  progress: number
  error?: string
  preview?: string
  compressed?: boolean
  originalSize: number
  compressedSize?: number
}

interface EnhancedDragDropUploadProps {
  onFilesUploaded?: (files: FileUpload[]) => void
  maxFiles?: number
  maxFileSize?: number
  acceptedTypes?: string[]
  enableCompression?: boolean
  compressionQuality?: number
  className?: string
}

export default function EnhancedDragDropUpload({
  onFilesUploaded,
  maxFiles = 10,
  maxFileSize = 500 * 1024 * 1024, // 500MB
  acceptedTypes = ['*'],
  enableCompression = true,
  compressionQuality = 0.8,
  className = ""
}: EnhancedDragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const { startUpload, pauseUpload, cancelUpload, getUploadProgress } = useResumableUpload({
    chunkSize: 1024 * 1024, // 1MB chunks
    maxRetries: 3,
    onProgress: (progress) => {
      setUploadedFiles(prev => prev.map(file =>
        file.id === progress.fileId
          ? { ...file, progress: progress.progress, status: progress.status as any }
          : file
      ))
    },
    onComplete: (fileId) => {
      setUploadedFiles(prev => prev.map(file =>
        file.id === fileId
          ? { ...file, status: 'completed', progress: 100 }
          : file
      ))
      onFilesUploaded?.(uploadedFiles.filter(f => f.status === 'completed'))
    },
    onError: (error) => {
      console.error('Upload error:', error)
      // Error handling is done in the progress callback
    }
  })

  // Compress image file
  const compressImage = useCallback(async (file: File, quality: number): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions (max 1920px width/height)
        const maxSize = 1920
        let { width, height } = img

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height

        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            resolve(file)
          }
        }, file.type, quality)
      }

      img.src = URL.createObjectURL(file)
    })
  }, [])

  // Generate file preview
  const generatePreview = useCallback(async (file: File): Promise<string | undefined> => {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })
    }
    return undefined
  }, [])

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)} limit`
    }

    if (acceptedTypes[0] !== '*' && !acceptedTypes.some(type => {
      if (type === '*') return true
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type
    })) {
      return `File type not supported. Accepted: ${acceptedTypes.join(', ')}`
    }

    return null
  }, [maxFileSize, acceptedTypes])

  // Process files
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    if (uploadedFiles.length + fileArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    setIsProcessing(true)

    try {
      const newUploads: FileUpload[] = []

      for (const file of fileArray) {
        const validationError = validateFile(file)
        if (validationError) {
          alert(`${file.name}: ${validationError}`)
          continue
        }

        const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        let processedFile = file
        let compressed = false
        let compressedSize: number | undefined

        // Compress if enabled and file is an image
        if (enableCompression && file.type.startsWith('image/') && file.size > 100 * 1024) { // > 100KB
          try {
            processedFile = await compressImage(file, compressionQuality)
            compressed = true
            compressedSize = processedFile.size
          } catch (error) {
            console.warn('Compression failed:', error)
          }
        }

        const preview = await generatePreview(processedFile)

        const upload: FileUpload = {
          id,
          file: processedFile,
          status: 'pending',
          progress: 0,
          preview,
          compressed,
          originalSize: file.size,
          compressedSize
        }

        newUploads.push(upload)
      }

      setUploadedFiles(prev => [...prev, ...newUploads])

      // Start uploads
      for (const upload of newUploads) {
        try {
          await startUpload(upload.file)
        } catch (error) {
          console.error('Failed to start upload:', error)
          setUploadedFiles(prev => prev.map(f =>
            f.id === upload.id
              ? { ...f, status: 'failed', error: 'Failed to start upload' }
              : f
          ))
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }, [uploadedFiles.length, maxFiles, validateFile, enableCompression, compressionQuality, compressImage, generatePreview, startUpload])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFiles(files)
    }
  }, [processFiles])

  // File input handler
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
  }, [processFiles])

  // Remove file
  const removeFile = useCallback((fileId: string) => {
    cancelUpload(fileId)
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }, [cancelUpload])

  // Pause/Resume upload
  const toggleUpload = useCallback((fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId)
    if (!file) return

    if (file.status === 'uploading') {
      pauseUpload(fileId)
    } else if (file.status === 'paused') {
      // Resume functionality would need the original file
      console.log('Resume not implemented yet')
    }
  }, [uploadedFiles, pauseUpload])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: FileUpload['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'uploading': return 'text-blue-600'
      case 'paused': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: FileUpload['status']) => {
    switch (status) {
      case 'completed': return '✅'
      case 'failed': return '❌'
      case 'uploading': return '⏳'
      case 'paused': return '⏸️'
      default: return '📄'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drag & Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 touch-manipulation ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105"
            : "border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept={acceptedTypes.join(',')}
          multiple
          className="hidden"
          id="enhanced-file-upload"
        />

        <label htmlFor="enhanced-file-upload" className="cursor-pointer block">
          <div className="text-6xl mb-4">📁</div>
          <p className="text-lg mb-2">
            {isDragOver ? "Drop files here!" : "Click to select files or drag and drop"}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Up to {maxFiles} files • Max {formatFileSize(maxFileSize)} each
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Supported: {acceptedTypes.join(', ')}
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                fileInputRef.current?.click()
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors touch-manipulation"
            >
              📁 Browse Files
            </button>

            {typeof navigator !== 'undefined' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.capture = 'environment'
                  input.onchange = (e) => handleFileSelect(e as any)
                  input.click()
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors touch-manipulation"
              >
                📷 Camera
              </button>
            )}
          </div>
        </label>

        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-lg flex items-center justify-center">
            <div className="text-blue-600 text-xl font-semibold">Drop files here</div>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 rounded-lg flex items-center justify-center">
            <Loading text="Processing files..." />
          </div>
        )}
      </div>

      {/* Upload Queue */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Uploads ({uploadedFiles.length})</h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {uploadedFiles.map((upload) => (
              <div key={upload.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  {/* File preview */}
                  {upload.preview ? (
                    <img
                      src={upload.preview}
                      alt={upload.file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xl">
                      📄
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={upload.file.name}>
                      {upload.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{getStatusIcon(upload.status)}</span>
                      <span className={getStatusColor(upload.status)}>
                        {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
                      </span>
                      {upload.compressed && (
                        <span className="text-green-600">📦 Compressed</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Progress */}
                    <div className="text-right text-xs text-gray-500">
                      {upload.progress.toFixed(1)}%
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => removeFile(upload.id)}
                      className="text-red-500 hover:text-red-700 p-1 touch-manipulation"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      upload.status === 'completed' ? 'bg-green-500' :
                      upload.status === 'failed' ? 'bg-red-500' :
                      upload.status === 'uploading' ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}
                    style={{ width: `${upload.progress}%` }}
                  ></div>
                </div>

                {/* File info */}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {upload.compressed
                      ? `${formatFileSize(upload.compressedSize || 0)} (was ${formatFileSize(upload.originalSize)})`
                      : formatFileSize(upload.originalSize)
                    }
                  </span>
                  {upload.error && (
                    <span className="text-red-600">{upload.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}