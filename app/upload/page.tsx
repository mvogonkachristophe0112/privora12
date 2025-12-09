"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSession } from "next-auth/react"
import { encryptFile, generateKey } from "@/lib/crypto"
import EnhancedDragDropUpload from "@/components/EnhancedDragDropUpload"
import { useResumableUpload } from "@/lib/useResumableUpload"
import RecipientSelector from "@/components/RecipientSelector"
import ShareConfirmationDialog from "@/components/ShareConfirmationDialog"
import DeliveryReceipt from "@/components/DeliveryReceipt"
import { deliveryTracker } from "@/lib/delivery-tracker"

interface FilePreview {
  file: File
  preview?: string
  metadata?: {
    dimensions?: { width: number; height: number }
    duration?: number
    pages?: number
    bitrate?: number
  }
}

interface UploadQueueItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number
  error?: string
  preview?: string
}

export default function Upload() {
   const { data: session } = useSession()
   const [files, setFiles] = useState<FilePreview[]>([])
   const [encrypt, setEncrypt] = useState(true)
   const [uploading, setUploading] = useState(false)
   const [uploadProgress, setUploadProgress] = useState(0)
   const [message, setMessage] = useState("")
   const [selectedType, setSelectedType] = useState<string>("")
   const [encryptionKey, setEncryptionKey] = useState("")
   const [customKey, setCustomKey] = useState("")
   const [useCustomKey, setUseCustomKey] = useState(false)
   const [recipients, setRecipients] = useState<string[]>([])
   const [newRecipient, setNewRecipient] = useState("")
   const [shareMode, setShareMode] = useState<"upload" | "share">("upload")


  // New state for enhanced functionality
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [compressionEnabled, setCompressionEnabled] = useState(false)
  const [compressionQuality, setCompressionQuality] = useState(0.8)
  const [isOnline, setIsOnline] = useState(true)
  const [cameraSupported, setCameraSupported] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0)
  const [totalUploadSize, setTotalUploadSize] = useState(0)
  const [uploadedSize, setUploadedSize] = useState(0)
  const [uploadHistory, setUploadHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [resumableUploads, setResumableUploads] = useState<Map<string, any>>(new Map())

  // Enhanced upload features
  const [useEnhancedUpload, setUseEnhancedUpload] = useState(true)

  // Recipient selection and sharing states
  const [recipientDetails, setRecipientDetails] = useState<any[]>([])
  const [showShareConfirmation, setShowShareConfirmation] = useState(false)
  const [showDeliveryReceipt, setShowDeliveryReceipt] = useState(false)
  const [deliveryResults, setDeliveryResults] = useState<any[]>([])
  const [shareUrl, setShareUrl] = useState<string>('')
  const [lastShareResults, setLastShareResults] = useState<any>(null)

  // Resumable upload hook
  const resumableUpload = useResumableUpload({
    onProgress: (progress) => {
      console.log('Upload progress:', progress)
    },
    onComplete: (fileId) => {
      console.log('Upload completed:', fileId)
      setMessage('File uploaded successfully!')
    },
    onError: (error) => {
      console.error('Upload error:', error)
      setMessage(`Upload failed: ${error}`)
    }
  })

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Legacy compatibility - keep file for single file operations
  const file = files.length > 0 ? files[0].file : null

  const fileTypes = [
    {
      id: "all",
      name: "All Files",
      icon: "📁",
      accept: "*",
      color: "blue",
      description: "Any file type - documents, images, videos, archives, and more"
    }
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({ file }))
      setFiles(prev => [...prev, ...newFiles])
      setMessage("")
      // Extract metadata for each file
      newFiles.forEach(filePreview => extractFileMetadata(filePreview.file))
    }
  }

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId)
    setFiles([])
    setMessage("")
    setEncryptionKey("")
    setCustomKey("")
    setUseCustomKey(false)
    setRecipients([])
    setNewRecipient("")
  }

  // Extract file metadata (dimensions, duration, etc.)
  const extractFileMetadata = useCallback(async (file: File) => {
    const metadata: FilePreview['metadata'] = {}

    if (file.type.startsWith('image/')) {
      try {
        const img = new Image()
        const url = URL.createObjectURL(file)
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = url
        })
        metadata.dimensions = { width: img.width, height: img.height }
        URL.revokeObjectURL(url)
      } catch (error) {
        console.warn('Failed to extract image metadata:', error)
      }
    } else if (file.type.startsWith('video/')) {
      try {
        const video = document.createElement('video')
        const url = URL.createObjectURL(file)
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve
          video.onerror = reject
          video.src = url
        })
        metadata.duration = video.duration
        metadata.dimensions = { width: video.videoWidth, height: video.videoHeight }
        URL.revokeObjectURL(url)
      } catch (error) {
        console.warn('Failed to extract video metadata:', error)
      }
    }

    setFiles(prev => prev.map(fp =>
      fp.file === file ? { ...fp, metadata } : fp
    ))
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

  // Check camera support
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(track => track.stop())
        setCameraSupported(true)
      } catch {
        setCameraSupported(false)
      }
    }
    checkCameraSupport()
  }, [])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load upload history and check for pre-selected recipients on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('uploadHistory')
    if (savedHistory) {
      try {
        setUploadHistory(JSON.parse(savedHistory))
      } catch (error) {
        console.warn('Failed to load upload history:', error)
      }
    }

    const savedResumable = localStorage.getItem('resumableUploads')
    if (savedResumable) {
      try {
        const parsed = JSON.parse(savedResumable)
        setResumableUploads(new Map(parsed))
      } catch (error) {
        console.warn('Failed to load resumable uploads:', error)
      }
    }

    // Check for pre-selected recipients from connections page
    const selectedRecipients = sessionStorage.getItem('selectedRecipients')
    if (selectedRecipients) {
      try {
        const recipients = JSON.parse(selectedRecipients)
        setRecipients(recipients)
        setShareMode("share") // Automatically switch to share mode
        sessionStorage.removeItem('selectedRecipients') // Clean up
      } catch (error) {
        console.warn('Failed to parse selected recipients:', error)
      }
    }
  }, [])

  // Save upload history
  const saveUploadHistory = useCallback((upload: any) => {
    const newHistory = [upload, ...uploadHistory.slice(0, 49)] // Keep last 50 uploads
    setUploadHistory(newHistory)
    localStorage.setItem('uploadHistory', JSON.stringify(newHistory))
  }, [uploadHistory])

  // Save resumable upload state
  const saveResumableUpload = useCallback((uploadId: string, state: any) => {
    const newResumable = new Map(resumableUploads)
    newResumable.set(uploadId, { ...state, timestamp: Date.now() })
    setResumableUploads(newResumable)
    localStorage.setItem('resumableUploads', JSON.stringify(Array.from(newResumable.entries())))
  }, [resumableUploads])

  // Resume upload
  const resumeUpload = useCallback(async (uploadId: string) => {
    const resumableState = resumableUploads.get(uploadId)
    if (!resumableState) return

    // Restore upload state
    setFiles(resumableState.files || [])
    setSelectedType(resumableState.selectedType || "")
    setEncrypt(resumableState.encrypt || true)
    setShareMode(resumableState.shareMode || "upload")
    setRecipients(resumableState.recipients || [])
    setCompressionEnabled(resumableState.compressionEnabled || false)
    setCompressionQuality(resumableState.compressionQuality || 0.8)

    // Remove from resumable uploads
    const newResumable = new Map(resumableUploads)
    newResumable.delete(uploadId)
    setResumableUploads(newResumable)
    localStorage.setItem('resumableUploads', JSON.stringify(Array.from(newResumable.entries())))
  }, [resumableUploads])

  // Clear old resumable uploads (older than 24 hours)
  useEffect(() => {
    const cleanupResumable = () => {
      const newResumable = new Map(resumableUploads)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago

      for (const [uploadId, state] of newResumable.entries()) {
        if (state.timestamp < cutoffTime) {
          newResumable.delete(uploadId)
        }
      }

      if (newResumable.size !== resumableUploads.size) {
        setResumableUploads(newResumable)
        localStorage.setItem('resumableUploads', JSON.stringify(Array.from(newResumable.entries())))
      }
    }

    cleanupResumable()
  }, [resumableUploads])

  const generateEncryptionKey = () => {
    const key = generateKey()
    setEncryptionKey(key)
    setCustomKey("")
    setUseCustomKey(false)
  }

  const addRecipient = () => {
    const normalizedEmail = newRecipient.trim().toLowerCase()
    if (normalizedEmail && !recipients.some(r => r.toLowerCase() === normalizedEmail)) {
      setRecipients([...recipients, normalizedEmail])
      setNewRecipient("")
    }
  }

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email))
  }

  const handleUpload = async () => {
    if (!file) return

    // Validation for share mode
    if (shareMode === "share" && recipients.length === 0) {
      setMessage("Please add at least one recipient for sharing")
      return
    }

    // Validation for encryption key
    if (encrypt && !encryptionKey && !customKey) {
      setMessage("Please generate or enter an encryption key")
      return
    }

    setUploading(true)
    setMessage("")
    setUploadProgress(0)

    try {
      let fileData = await file.arrayBuffer()
      let finalEncryptionKey = ""

      // Show encryption progress
      setMessage("Preparing file...")

      if (encrypt) {
        if (useCustomKey && customKey) {
          finalEncryptionKey = customKey
        } else if (encryptionKey) {
          finalEncryptionKey = encryptionKey
        } else {
          finalEncryptionKey = generateKey()
        }

        setMessage("Encrypting file...")
        const encrypted = encryptFile(fileData, finalEncryptionKey)
        fileData = new TextEncoder().encode(encrypted).buffer
      }

      setMessage("Uploading to secure storage...")

      const formData = new FormData()
      formData.append('file', new Blob([fileData]), file.name)
      formData.append('type', selectedType)
      formData.append('encrypt', encrypt.toString())
      formData.append('encryptionKey', finalEncryptionKey)
      formData.append('recipients', JSON.stringify(recipients))
      formData.append('shareMode', shareMode)

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setMessage(data.message || "Upload completed")
        setUploadProgress(100)

        // Show detailed sharing results if available
        if (data.sharingResults) {
          const { totalRecipients, successfulShares, failedShares, results } = data.sharingResults
          console.log('Sharing results:', data.sharingResults)

          if (failedShares > 0) {
            const failedRecipients = results.filter((r: any) => !r.success)
            console.log('Failed recipients:', failedRecipients)

            // Show detailed error message
            setMessage(`${successfulShares} file(s) shared successfully, ${failedShares} failed. Check console for details.`)
          }
        }

        // Reset form
        setFiles([])
        setSelectedType("")
        setEncryptionKey("")
        setCustomKey("")
        setUseCustomKey(false)
        setRecipients([])
        setNewRecipient("")
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Upload failed:', errorData)
        setMessage(errorData.error || "Upload failed")
      }
    } catch (error) {
      console.error('Upload error:', error)
      setMessage("Upload failed. Please try again.")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const getAcceptString = (typeId: string) => {
    const type = fileTypes.find(t => t.id === typeId)
    return type ? type.accept : "*"
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set drag over to false if we're leaving the drop zone entirely
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      const newFiles = droppedFiles.map(file => ({ file }))
      setFiles(prev => [...prev, ...newFiles])
      setMessage("")
      // Extract metadata for each file
      newFiles.forEach(filePreview => extractFileMetadata(filePreview.file))
    }
  }, [extractFileMetadata])

  // Remove file from selection
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Camera capture
  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click()
    }
  }

  // Compress file
  const compressFile = useCallback(async (file: File, quality: number = 0.8): Promise<File> => {
    if (!file.type.startsWith('image/')) return file

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

  // Batch upload with queue management
  const handleBatchUpload = async () => {
    if (files.length === 0) return

    // Validation for share mode
    if (shareMode === "share" && recipients.length === 0) {
      setMessage("Please add at least one recipient for sharing")
      return
    }

    // Validation for encryption key
    if (encrypt && !encryptionKey && !customKey) {
      setMessage("Please generate or enter an encryption key")
      return
    }

    const uploadId = `batch-${Date.now()}`

    // Save resumable state
    saveResumableUpload(uploadId, {
      files,
      selectedType,
      encrypt,
      shareMode,
      recipients,
      compressionEnabled,
      compressionQuality,
      encryptionKey,
      customKey,
      useCustomKey
    })

    setUploading(true)
    setMessage("")
    setUploadProgress(0)
    setCurrentUploadIndex(0)
    setTotalUploadSize(files.reduce((sum, f) => sum + f.file.size, 0))
    setUploadedSize(0)

    // Initialize upload queue
    const queue: UploadQueueItem[] = files.map((fp, index) => ({
      id: `upload-${index}-${Date.now()}`,
      file: fp.file,
      status: 'pending',
      progress: 0
    }))
    setUploadQueue(queue)

    const startTime = Date.now()
    let successfulUploads = 0
    let failedUploads = 0

    try {
      for (let i = 0; i < files.length; i++) {
        setCurrentUploadIndex(i)
        const filePreview = files[i]
        const queueItem = queue[i]

        // Update status to uploading
        setUploadQueue(prev => prev.map(item =>
          item.id === queueItem.id ? { ...item, status: 'uploading' } : item
        ))

        let fileData = await filePreview.file.arrayBuffer()
        let finalEncryptionKey = ""

        // Compress if enabled
        let processedFile = filePreview.file
        if (compressionEnabled && filePreview.file.type.startsWith('image/')) {
          setMessage(`Compressing ${filePreview.file.name}...`)
          processedFile = await compressFile(filePreview.file, compressionQuality)
          fileData = await processedFile.arrayBuffer()
        }

        // Encrypt if enabled
        if (encrypt) {
          if (useCustomKey && customKey) {
            finalEncryptionKey = customKey
          } else if (encryptionKey) {
            finalEncryptionKey = encryptionKey
          } else {
            finalEncryptionKey = generateKey()
          }

          setMessage(`Encrypting ${processedFile.name}...`)
          const encrypted = encryptFile(fileData, finalEncryptionKey)
          fileData = new TextEncoder().encode(encrypted).buffer
        }

        setMessage(`Uploading ${processedFile.name}...`)

        const formData = new FormData()
        formData.append('file', new Blob([fileData]), processedFile.name)
        formData.append('type', selectedType)
        formData.append('encrypt', encrypt.toString())
        formData.append('encryptionKey', finalEncryptionKey)
        formData.append('recipients', JSON.stringify(recipients))
        formData.append('shareMode', shareMode)

        const res = await fetch('/api/files', {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          const data = await res.json()
          setUploadQueue(prev => prev.map(item =>
            item.id === queueItem.id ? { ...item, status: 'completed', progress: 100 } : item
          ))
          setUploadedSize(prev => prev + processedFile.size)
          successfulUploads++
        } else {
          const errorData = await res.json().catch(() => ({}))
          setUploadQueue(prev => prev.map(item =>
            item.id === queueItem.id ? {
              ...item,
              status: 'failed',
              error: errorData.error || "Upload failed"
            } : item
          ))
          failedUploads++
        }

        // Update overall progress
        const progress = ((i + 1) / files.length) * 100
        setUploadProgress(progress)
      }

      const endTime = Date.now()
      const duration = (endTime - startTime) / 1000

      const successMessage = shareMode === "share"
        ? `${successfulUploads} file(s) uploaded and shared successfully!${failedUploads > 0 ? ` (${failedUploads} failed)` : ''}`
        : `${successfulUploads} file(s) uploaded successfully!${failedUploads > 0 ? ` (${failedUploads} failed)` : ''}`

      setMessage(successMessage)

      // Save to upload history
      const historyEntry = {
        id: uploadId,
        timestamp: new Date().toISOString(),
        files: files.map(f => ({
          name: f.file.name,
          size: f.file.size,
          type: f.file.type
        })),
        successfulUploads,
        failedUploads,
        totalSize: totalUploadSize,
        duration,
        shareMode,
        encrypted: encrypt,
        compressed: compressionEnabled
      }
      saveUploadHistory(historyEntry)

      // Reset form
      setFiles([])
      setSelectedType("")
      setEncryptionKey("")
      setCustomKey("")
      setUseCustomKey(false)
      setRecipients([])
      setNewRecipient("")
      setUploadQueue([])

      // Remove from resumable uploads
      const newResumable = new Map(resumableUploads)
      newResumable.delete(uploadId)
      setResumableUploads(newResumable)
      localStorage.setItem('resumableUploads', JSON.stringify(Array.from(newResumable.entries())))

    } catch (error) {
      console.error('Batch upload error:', error)
      setMessage("Upload failed. Your progress has been saved and can be resumed later.")
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setCurrentUploadIndex(0)
    }
  }

  // Handle share confirmation with delivery tracking
  const handleShareConfirm = async (shareOptions: any) => {
    if (files.length === 0 || recipients.length === 0) return

    setUploading(true)
    setMessage("")

    try {
      // Prepare files for upload
      const uploadPromises = files.map(async (filePreview) => {
        let fileData = await filePreview.file.arrayBuffer()
        let finalEncryptionKey = ""

        // Compress if enabled
        let processedFile = filePreview.file
        if (compressionEnabled && filePreview.file.type.startsWith('image/')) {
          processedFile = await compressFile(filePreview.file, compressionQuality)
          fileData = await processedFile.arrayBuffer()
        }

        // Encrypt if enabled
        if (encrypt) {
          if (useCustomKey && customKey) {
            finalEncryptionKey = customKey
          } else if (encryptionKey) {
            finalEncryptionKey = encryptionKey
          } else {
            finalEncryptionKey = generateKey()
          }
          const encrypted = encryptFile(fileData, finalEncryptionKey)
          fileData = new TextEncoder().encode(encrypted).buffer
        }

        return { processedFile, fileData, finalEncryptionKey }
      })

      const processedFiles = await Promise.all(uploadPromises)

      // Upload files and share
      const uploadResults = []
      for (const { processedFile, fileData, finalEncryptionKey } of processedFiles) {
        const formData = new FormData()
        formData.append('file', new Blob([fileData]), processedFile.name)
        formData.append('type', selectedType)
        formData.append('encrypt', encrypt.toString())
        formData.append('encryptionKey', finalEncryptionKey)
        formData.append('recipients', JSON.stringify(recipients))
        formData.append('shareMode', 'share')

        // Add share options
        if (shareOptions.expirationHours) {
          formData.append('expirationHours', shareOptions.expirationHours.toString())
        }
        if (shareOptions.maxDownloads) {
          formData.append('maxDownloads', shareOptions.maxDownloads.toString())
        }
        if (shareOptions.password) {
          formData.append('password', shareOptions.password)
        }
        if (shareOptions.requireConfirmation) {
          formData.append('requireConfirmation', 'true')
        }
        formData.append('notificationChannels', JSON.stringify(shareOptions.notificationChannels))

        const response = await fetch('/api/files', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        const result = await response.json()
        uploadResults.push(result)
      }

      // Process delivery results
      const deliveryResults = []
      let successfulDeliveries = 0
      let failedDeliveries = 0

      for (const result of uploadResults) {
        if (result.sharingResults) {
          const { results } = result.sharingResults
          for (const shareResult of results) {
            const deliveryResult = {
              shareId: shareResult.shareId,
              recipientEmail: shareResult.email,
              recipientName: shareResult.recipientName,
              status: shareResult.success ? 'success' : 'failed',
              deliveryId: shareResult.deliveryId,
              errorMessage: shareResult.error,
              notificationChannels: shareOptions.notificationChannels
            }
            deliveryResults.push(deliveryResult)

            if (shareResult.success) {
              successfulDeliveries++
            } else {
              failedDeliveries++
            }
          }
        }
      }

      // Show delivery receipt
      setDeliveryResults(deliveryResults)
      setLastShareResults({
        totalRecipients: recipients.length,
        successfulDeliveries,
        failedDeliveries
      })

      if (uploadResults[0]?.shareUrl) {
        setShareUrl(uploadResults[0].shareUrl)
      }

      setShowDeliveryReceipt(true)
      setMessage(`${successfulDeliveries} file(s) shared successfully!`)

      // Reset form
      setFiles([])
      setRecipients([])
      setRecipientDetails([])

    } catch (error) {
      console.error('Share error:', error)
      setMessage(`Share failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">Please login to upload files</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Upload Files</h1>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            {/* File Type Selection */}
            <div className="mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="text-center">
                  <div className="text-5xl mb-4">📁</div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                    Upload Any File Type
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Share documents, images, videos, archives, and any other file type securely
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 text-sm">
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
                      📄 Documents
                    </span>
                    <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 px-3 py-1 rounded-full">
                      🖼️ Images
                    </span>
                    <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full">
                      🎥 Videos
                    </span>
                    <span className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 px-3 py-1 rounded-full">
                      🎵 Audio
                    </span>
                    <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full">
                      📦 Archives
                    </span>
                    <span className="bg-gray-100 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full">
                      ✨ And More
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Mode Toggle */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-800 dark:text-white">Upload Mode</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {useEnhancedUpload
                      ? "Enhanced upload with resumable transfers, compression, and progress tracking"
                      : "Legacy upload system"
                    }
                  </p>
                </div>
                <button
                  onClick={() => setUseEnhancedUpload(!useEnhancedUpload)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useEnhancedUpload ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useEnhancedUpload ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* File Selection */}
            <div className="mb-8">
              <label className="block text-lg font-semibold mb-4">
                Choose Your Files
              </label>

                {useEnhancedUpload ? (
                  // Enhanced upload with resumable transfers
                  <EnhancedDragDropUpload
                    maxFiles={10}
                    maxFileSize={500 * 1024 * 1024} // 500MB
                    acceptedTypes={[getAcceptString(selectedType)]}
                    enableCompression={compressionEnabled}
                    compressionQuality={compressionQuality}
                    onFilesUploaded={(uploadedFiles) => {
                      console.log('Files uploaded:', uploadedFiles)
                      setMessage(`${uploadedFiles.length} file(s) uploaded successfully!`)
                    }}
                  />
                ) : (
                  // Legacy drag & drop zone
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
                      onChange={handleFileChange}
                      accept={getAcceptString(selectedType)}
                      multiple
                      className="hidden"
                      id="file-upload"
                    />

                    {/* Camera input for mobile */}
                    {cameraSupported && selectedType === 'photos' && (
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                        id="camera-upload"
                      />
                    )}

                    <label htmlFor="file-upload" className="cursor-pointer block">
                      <div className="text-6xl mb-4">📁</div>
                      <p className="text-lg mb-2">
                        {isDragOver ? "Drop files here!" : "Click to select files or drag and drop"}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        All file types supported - documents, images, videos, archives, and more
                      </p>
                      <p className="text-sm text-gray-500 mb-4">Maximum file size: 500MB per file</p>

                      {/* Action buttons */}
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

                        {cameraSupported && selectedType === 'photos' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              handleCameraCapture()
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors touch-manipulation"
                          >
                            📷 Take Photo
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
                  </div>
                )}

                {/* Selected Files Preview */}
                {files.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Selected Files ({files.length})</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {files.map((filePreview, index) => (
                        <div key={index} className="relative bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          {/* File preview */}
                          {filePreview.preview && (
                            <div className="mb-3">
                              <img
                                src={filePreview.preview}
                                alt={filePreview.file.name}
                                className="w-full h-32 object-cover rounded"
                              />
                            </div>
                          )}

                          {/* File icon if no preview */}
                          {!filePreview.preview && (
                            <div className="text-center mb-3">
                              <span className="text-4xl">
                                {fileTypes.find(t => t.id === selectedType)?.icon}
                              </span>
                            </div>
                          )}

                          {/* File info */}
                          <div className="space-y-1">
                            <p className="font-medium text-sm truncate" title={filePreview.file.name}>
                              {filePreview.file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(filePreview.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>

                            {/* Metadata */}
                            {filePreview.metadata && (
                              <div className="text-xs text-gray-400">
                                {filePreview.metadata.dimensions && (
                                  <span>{filePreview.metadata.dimensions.width}×{filePreview.metadata.dimensions.height}</span>
                                )}
                                {filePreview.metadata.duration && (
                                  <span>{Math.round(filePreview.metadata.duration)}s</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs touch-manipulation"
                            aria-label={`Remove ${filePreview.file.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* File summary */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="flex justify-between items-center text-sm">
                        <span>Total files: {files.length}</span>
                        <span>Total size: {(files.reduce((sum, f) => sum + f.file.size, 0) / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upload Options */}
            {file && (
              <div className="mb-8 space-y-6">
                {/* Mode Selection */}
                <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <button
                    onClick={() => setShareMode("upload")}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      shareMode === "upload"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500"
                    }`}
                  >
                    📤 Just Upload
                  </button>
                  <button
                    onClick={() => setShareMode("share")}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      shareMode === "share"
                        ? "bg-green-500 text-white shadow-md"
                        : "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500"
                    }`}
                  >
                    🔗 Upload & Share
                  </button>
                </div>

                {/* Encryption Settings */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={encrypt}
                        onChange={(e) => setEncrypt(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div>
                        <span className="font-medium text-blue-800 dark:text-blue-200">Encrypt on Upload</span>
                        <p className="text-sm text-blue-600 dark:text-blue-300">Secure your file with AES-256 encryption</p>
                      </div>
                    </div>
                    <span className="text-green-600 font-medium">🔒 Recommended</span>
                  </div>

                  {encrypt && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                      <h4 className="font-medium mb-3 text-gray-800 dark:text-white">Encryption Key</h4>

                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <button
                            onClick={generateEncryptionKey}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                          >
                            🔑 Generate Secure Key
                          </button>
                          <button
                            onClick={() => setUseCustomKey(!useCustomKey)}
                            className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                              useCustomKey
                                ? "bg-blue-500 text-white"
                                : "bg-gray-500 hover:bg-gray-600 text-white"
                            }`}
                          >
                            ✏️ Custom Key
                          </button>
                        </div>

                        {encryptionKey && !useCustomKey && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Generated Key:</p>
                            <p className="text-xs font-mono bg-white dark:bg-gray-700 p-2 rounded border text-green-700 dark:text-green-300 break-all">
                              {encryptionKey}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              ⚠️ Save this key! You'll need it to decrypt the file later.
                            </p>
                          </div>
                        )}

                        {useCustomKey && (
                          <div>
                            <input
                              type="password"
                              value={customKey}
                              onChange={(e) => setCustomKey(e.target.value)}
                              placeholder="Enter your custom encryption key"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Minimum 8 characters recommended for security
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recipient Selection - Only show in share mode */}
                {shareMode === "share" && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium mb-4 text-green-800 dark:text-green-200">Select Recipients</h4>

                    <RecipientSelector
                      recipients={recipients}
                      onRecipientsChange={setRecipients}
                      maxRecipients={50}
                      placeholder="Add recipient emails..."
                      className="mb-4"
                      showValidation={true}
                      allowBulkImport={true}
                    />

                    {recipients.length > 0 && (
                      <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-700 dark:text-green-300 font-medium">
                            ✅ Ready to share with {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Recipients will receive secure download links via email
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Compression Settings */}
                {useEnhancedUpload && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={compressionEnabled}
                          onChange={(e) => setCompressionEnabled(e.target.checked)}
                          className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div>
                          <span className="font-medium text-green-800 dark:text-green-200">Auto-Compress Images</span>
                          <p className="text-sm text-green-600 dark:text-green-300">Reduce file size while maintaining quality</p>
                        </div>
                      </div>
                      <span className="text-green-600 font-medium">📦 Smart</span>
                    </div>

                    {compressionEnabled && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium mb-2 text-green-800 dark:text-green-200">
                          Compression Quality: {Math.round(compressionQuality * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.1"
                          value={compressionQuality}
                          onChange={(e) => setCompressionQuality(parseFloat(e.target.value))}
                          className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer dark:bg-green-700"
                        />
                        <div className="flex justify-between text-xs text-green-600 dark:text-green-400 mt-1">
                          <span>Better Compression</span>
                          <span>Higher Quality</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Advanced Settings
                  </button>
                  <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Bulk Upload
                  </button>
                  <button className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    Share Settings
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div className={`mb-6 p-4 rounded-lg ${
                message.includes("successfully")
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}>
                <div className="flex items-center gap-2">
                  {message.includes("successfully") ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className={`font-medium ${
                    message.includes("successfully") ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
                  }`}>
                    {message}
                  </span>
                </div>
              </div>
            )}

            {/* Upload Queue Progress */}
            {uploading && uploadQueue.length > 0 && (
              <div className="mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">Upload Progress</h3>

                  {/* Overall progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Overall Progress</span>
                      <span className="text-sm text-gray-600">{uploadProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{uploadedSize} / {totalUploadSize} bytes</span>
                      <span>{currentUploadIndex + 1} / {files.length} files</span>
                    </div>
                  </div>

                  {/* Individual file progress */}
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {uploadQueue.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className={`w-3 h-3 rounded-full ${
                          item.status === 'completed' ? 'bg-green-500' :
                          item.status === 'failed' ? 'bg-red-500' :
                          item.status === 'uploading' ? 'bg-blue-500 animate-pulse' :
                          'bg-gray-400'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.file.name}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              {(item.file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                            {item.status === 'uploading' && (
                              <span className="text-xs text-blue-600">{item.progress}%</span>
                            )}
                            {item.status === 'failed' && item.error && (
                              <span className="text-xs text-red-600">{item.error}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Resumable Uploads */}
            {resumableUploads.size > 0 && (
              <div className="mb-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h3 className="text-lg font-semibold mb-3 text-yellow-800 dark:text-yellow-200">
                    📁 Resumable Uploads ({resumableUploads.size})
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                    You have unfinished uploads that can be resumed:
                  </p>
                  <div className="space-y-2">
                    {Array.from(resumableUploads.entries()).map(([uploadId, state]) => (
                      <div key={uploadId} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border">
                        <div>
                          <p className="font-medium text-sm">
                            {state.files?.length || 0} files • {state.selectedType || 'Unknown type'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Started {new Date(state.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => resumeUpload(uploadId)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm transition-colors touch-manipulation"
                        >
                          Resume
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Upload History */}
            {uploadHistory.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors touch-manipulation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {showHistory ? 'Hide' : 'Show'} Upload History ({uploadHistory.length})
                </button>

                {showHistory && (
                  <div className="mt-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-3">Recent Uploads</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {uploadHistory.map((upload, index) => (
                        <div key={upload.id || index} className="bg-white dark:bg-gray-700 p-3 rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">
                                {upload.files?.length || 0} files uploaded
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(upload.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="flex gap-1 text-xs">
                                {upload.encrypted && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">🔒 Encrypted</span>}
                                {upload.compressed && <span className="bg-green-100 text-green-800 px-2 py-1 rounded">📦 Compressed</span>}
                                {upload.shareMode === 'share' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">🔗 Shared</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                            <span>{upload.successfulUploads} successful, {upload.failedUploads} failed</span>
                            <span>{upload.duration?.toFixed(1)}s • {(upload.totalSize / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={shareMode === "share" ? () => setShowShareConfirmation(true) : handleBatchUpload}
              disabled={files.length === 0 || uploading || (shareMode === "share" && recipients.length === 0) || (encrypt && !encryptionKey && !customKey)}
              className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-xl font-semibold transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none shadow-lg hover:shadow-xl disabled:shadow-none text-lg touch-manipulation"
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Uploading {currentUploadIndex + 1} of {files.length}...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>
                    {shareMode === "share" ? "Review & Share" : "Upload"} {files.length > 1 ? `${files.length} Files` : "File"} Securely
                  </span>
                  {files.length > 0 && (
                    <span className="text-sm opacity-90">
                      ({(files.reduce((sum, f) => sum + f.file.size, 0) / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Share Confirmation Dialog */}
      <ShareConfirmationDialog
        isOpen={showShareConfirmation}
        onClose={() => setShowShareConfirmation(false)}
        onConfirm={handleShareConfirm}
        files={files.map(f => ({
          name: f.file.name,
          size: f.file.size,
          type: f.file.type,
          encrypted: encrypt
        }))}
        recipients={recipients}
        recipientDetails={recipientDetails}
        isLoading={uploading}
      />

      {/* Delivery Receipt */}
      <DeliveryReceipt
        isOpen={showDeliveryReceipt}
        onClose={() => {
          setShowDeliveryReceipt(false)
          setDeliveryResults([])
          setShareUrl('')
          setLastShareResults(null)
        }}
        fileName={files.length > 0 ? files[0].file.name : ''}
        fileSize={files.length > 0 ? files[0].file.size : 0}
        totalRecipients={lastShareResults?.totalRecipients || 0}
        successfulDeliveries={lastShareResults?.successfulDeliveries || 0}
        failedDeliveries={lastShareResults?.failedDeliveries || 0}
        deliveryResults={deliveryResults}
        shareUrl={shareUrl}
        onViewStatus={() => window.open('/delivery-status', '_blank')}
      />
    </div>
  )
}