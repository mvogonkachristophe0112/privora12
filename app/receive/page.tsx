"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { usePresence } from "@/lib/presence-context"
import { useNotifications } from "@/lib/notification-context"
import { useDownloadManager } from "@/components/DownloadManager"
import DownloadQueue from "@/components/DownloadQueue"
import SwipeableFileCard from "@/components/SwipeableFileCard"
import { ToastProvider, useToast } from "@/components/Toast"
import ConnectionStatus from "@/components/ConnectionStatus"
import { Loading } from "@/components/Loading"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import LazyImage from "@/components/LazyImage"

interface ReceivedFile {
  id: string // This is the share ID
  fileId: string // This is the actual file ID for downloads
  name: string
  originalName: string
  size: number
  type: string
  url: string
  encrypted: boolean
  fileType: string
  senderEmail: string
  senderName?: string
  sharedAt: string
  permissions: string
  expiresAt?: string
}

function ReceiveContent() {
    const { data: session } = useSession()
    const { isConnected, userPresence, socket } = usePresence()
    const { incrementNewFiles, clearNewFiles } = useNotifications()
    const { addToQueue } = useDownloadManager()
    const { addToast } = useToast()
   const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([])
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)
   const [decryptingFile, setDecryptingFile] = useState<ReceivedFile | null>(null)
   const [decryptionKey, setDecryptionKey] = useState("")
   const [decryptionError, setDecryptionError] = useState<string | null>(null)
   const [downloading, setDownloading] = useState(false)
   const [deletingFile, setDeletingFile] = useState<ReceivedFile | null>(null)
   const [viewingFile, setViewingFile] = useState<ReceivedFile | null>(null)
   const [actionLoading, setActionLoading] = useState<string | null>(null) // Track which file is being acted upon
   const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
   const [searchQuery, setSearchQuery] = useState("")
   const [filterType, setFilterType] = useState<string>("all")
   const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date")
   const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

   // Enhanced filtering states
   const [dateFrom, setDateFrom] = useState("")
   const [dateTo, setDateTo] = useState("")
   const [filterPermissions, setFilterPermissions] = useState<string[]>([])
   const [senderFilter, setSenderFilter] = useState("")
   const [sizeMin, setSizeMin] = useState("")
   const [sizeMax, setSizeMax] = useState("")
   const [availableSenders, setAvailableSenders] = useState<string[]>([])
   const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
   const [previewFile, setPreviewFile] = useState<ReceivedFile | null>(null)
   const [previewUrl, setPreviewUrl] = useState<string | null>(null)
   const [previewLoading, setPreviewLoading] = useState(false)

   // Accept/Reject states
   const [acceptRejectFile, setAcceptRejectFile] = useState<ReceivedFile | null>(null)
   const [acceptRejectAction, setAcceptRejectAction] = useState<'accept' | 'reject' | null>(null)
   const [showAcceptRejectConfirm, setShowAcceptRejectConfirm] = useState(false)

   // Bulk operations states
   const [bulkOperation, setBulkOperation] = useState<'accept' | 'reject' | 'delete' | 'export' | null>(null)
   const [showBulkConfirm, setShowBulkConfirm] = useState(false)
   const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number; currentFile?: string } | null>(null)
   const [bulkResults, setBulkResults] = useState<any[] | null>(null)
 
   // Performance optimizations
   const [currentPage, setCurrentPage] = useState(1)
   const [filesPerPage] = useState(20) // Load 20 files at a time
   const [totalFiles, setTotalFiles] = useState(0)
   const [cachedFiles, setCachedFiles] = useState<Map<number, ReceivedFile[]>>(new Map())
   const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fetchReceivedFiles = useCallback(async (showNotifications = false, page = 1, append = false) => {
    if (!session) return

    // Check cache first
    if (cachedFiles.has(page) && !showNotifications) {
      const cached = cachedFiles.get(page)!
      if (append) {
        setReceivedFiles(prev => [...prev, ...cached])
      } else {
        setReceivedFiles(cached)
        setTotalFiles(cached.length)
      }
      setLoading(false) // Clear loading state when using cache
      return
    }

    try {
      setIsLoadingMore(append)
      const response = await fetch(`/api/files/received?page=${page}&limit=${filesPerPage}`)
      if (!response.ok) {
        throw new Error('Failed to fetch received files')
      }
      const data = await response.json()
      const files = data.files || data
      const total = data.total || files.length

      // Cache the results
      setCachedFiles(prev => new Map(prev.set(page, files)))

      if (showNotifications && receivedFiles.length > 0) {
        // Check for new files since last update
         const previousFileIds = new Set(receivedFiles.map(f => f.id))
         const newFiles: ReceivedFile[] = files.filter((file: ReceivedFile) => !previousFileIds.has(file.id))

        if (newFiles.length > 0) {
           incrementNewFiles(newFiles.length)

           // Show toast notification for new files
           addToast({
             type: 'info',
             title: `${newFiles.length} new file${newFiles.length > 1 ? 's' : ''} received!`,
             message: `From ${newFiles.map(f => f.senderName || f.senderEmail.split('@')[0]).join(', ')}`,
             duration: 5000,
             action: {
               label: 'View Files',
               onClick: () => {
                 // Scroll to top to show new files
                 window.scrollTo({ top: 0, behavior: 'smooth' })
               }
             }
           })

           // Optional: Play notification sound
           if (typeof window !== 'undefined' && 'Audio' in window) {
             try {
               const audio = new Audio('/notification.mp3')
               audio.volume = 0.3
               audio.play().catch(() => {
                 // Silently fail if audio can't play
               })
             } catch {
               // Silently fail if audio not supported
             }
           }
         }
      }

      if (append) {
        setReceivedFiles(prev => [...prev, ...files])
      } else {
        setReceivedFiles(files)
        setTotalFiles(total)
        setCurrentPage(page)

        // Collect unique senders for autocomplete
        const senders = [...new Set(files.map((f: ReceivedFile) => f.senderEmail).filter(Boolean))]
        setAvailableSenders(senders as string[])
      }

      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Error fetching received files:', err)
      setError(`Failed to fetch received files: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoadingMore(false)
      setLoading(false) // Clear initial loading state
    }
  }, [session, receivedFiles, cachedFiles, filesPerPage, incrementNewFiles])

  useEffect(() => {
    fetchReceivedFiles()
  }, [fetchReceivedFiles])

  // Clear notifications when user visits the page
  useEffect(() => {
    clearNewFiles()
  }, [clearNewFiles])

  // Real-time updates via socket
  useEffect(() => {
    if (!socket || !session) return

    const handleFileShared = (data: any) => {
       console.log('Real-time file shared notification:', data)
       // Check if this file is shared with the current user
       if (data.receiverEmail?.toLowerCase() === session.user.email?.toLowerCase()) {
         console.log('File shared with current user, refreshing...')

         // Show toast notification
         addToast({
           type: 'success',
           title: 'New file received!',
           message: `${data.fileName} from ${data.senderName || data.senderEmail.split('@')[0]}`,
           duration: 4000,
           action: {
             label: 'View',
             onClick: () => {
               // Scroll to top to show new files
               window.scrollTo({ top: 0, behavior: 'smooth' })
             }
           }
         })

         // Refresh the file list
         fetchReceivedFiles(true) // Refresh with notifications
       }
     }

    socket.on('file-shared', handleFileShared)

    return () => {
      socket.off('file-shared', handleFileShared)
    }
  }, [socket, session, fetchReceivedFiles])

  // Polling for real-time updates (fallback for socket-based notifications)
  useEffect(() => {
    if (!session) return

    const pollInterval = setInterval(() => {
      fetchReceivedFiles(true) // Show notifications for new files
    }, 60000) // Poll every 60 seconds (reduced frequency for better performance)

    return () => clearInterval(pollInterval)
  }, [session, fetchReceivedFiles])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄'
    if (type.includes('zip') || type.includes('rar')) return '📦'
    if (type.includes('image')) return '🖼️'
    if (type.includes('video')) return '🎥'
    if (type.includes('audio')) return '🎵'
    if (isDocumentType(type)) return '📝'
    return '📄'
  }

  // Helper function to properly detect document types
  const isDocumentType = (type: string) => {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation'
    ]
    return documentTypes.some(docType => type.includes(docType.split('/')[1]) || type === docType)
  }

  // Memoized user presence function for better performance
  const getUserPresence = useCallback((email: string) => {
    const presence = userPresence[email]
    if (presence?.isOnline) {
      return {
        status: 'online',
        text: 'Online',
        color: 'text-green-600',
        dotColor: 'bg-green-500',
        deviceType: presence.deviceType,
        lastSeen: presence.lastSeen
      }
    } else if (presence) {
      const lastSeen = new Date(presence.lastSeen)
      const now = new Date()
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60))

      if (diffMinutes < 1) {
        return {
          status: 'away',
          text: 'Last seen just now',
          color: 'text-gray-500',
          dotColor: 'bg-gray-400',
          deviceType: presence.deviceType,
          lastSeen: presence.lastSeen
        }
      }
      if (diffMinutes < 60) {
        return {
          status: 'away',
          text: `Last seen ${diffMinutes}m ago`,
          color: 'text-gray-500',
          dotColor: 'bg-gray-400',
          deviceType: presence.deviceType,
          lastSeen: presence.lastSeen
        }
      }

      const diffHours = Math.floor(diffMinutes / 60)
      if (diffHours < 24) {
        return {
          status: 'away',
          text: `Last seen ${diffHours}h ago`,
          color: 'text-gray-500',
          dotColor: 'bg-gray-400',
          deviceType: presence.deviceType,
          lastSeen: presence.lastSeen
        }
      }

      return {
        status: 'offline',
        text: `Last seen ${lastSeen.toLocaleDateString()}`,
        color: 'text-gray-400',
        dotColor: 'bg-gray-300',
        deviceType: presence.deviceType,
        lastSeen: presence.lastSeen
      }
    }
    return {
      status: 'offline',
      text: 'Offline',
      color: 'text-gray-400',
      dotColor: 'bg-gray-300',
      deviceType: 'desktop' as const,
      lastSeen: new Date()
    }
  }, [userPresence])

  const handleDownload = async (file: ReceivedFile) => {
    if (file.encrypted) {
      setDecryptingFile(file)
      setDecryptionKey("")
      setDecryptionError(null)
      return
    }

    // Track file download for delivery status (placeholder for future implementation)
    if (session?.user?.email) {
      console.log(`⬇️ File downloaded: ${file.name} by ${session.user.email}`)
    }

    // Add to download queue instead of downloading immediately
    addToQueue({
      id: `download-${file.id}-${Date.now()}`,
      fileId: file.fileId,
      name: file.name,
      originalName: file.originalName,
      size: file.size,
      type: file.type,
      url: file.url,
      encrypted: file.encrypted,
      senderEmail: file.senderEmail,
      senderName: file.senderName,
      sharedAt: file.sharedAt,
      permissions: file.permissions,
      expiresAt: file.expiresAt,
      priority: 'normal',
      totalBytes: file.size,
      maxRetries: 3
    })
  }

  const downloadFileWithRetry = async (file: ReceivedFile, key: string, maxRetries: number) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Download attempt ${attempt}/${maxRetries} for file: ${file.name}`)
        await downloadFile(file, key)
        return // Success, exit retry loop
      } catch (error) {
        console.error(`Download attempt ${attempt} failed:`, error)

        if (attempt === maxRetries) {
          // Last attempt failed, show final error
          const errorMessage = error instanceof Error ? error.message : 'Download failed after multiple attempts'
          setDecryptionError(errorMessage)
          addToast({
            type: 'error',
            title: 'Download Failed',
            message: `Failed after ${maxRetries} attempts: ${errorMessage}`,
            duration: 7000
          })
          break
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  const downloadFile = async (file: ReceivedFile, key: string) => {
    let timeoutId: NodeJS.Timeout | null = null

    try {
      setActionLoading(file.id)
      const url = `/api/files/download/${file.fileId}${key ? `?key=${encodeURIComponent(key)}` : ''}`

      console.log('Starting download for file:', file.name, 'URL:', url)

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Download request timed out after 30 seconds'))
        }, 30000) // 30 second timeout
      })

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(url),
        timeoutPromise
      ]) as Response

      // Clear timeout since we got a response
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      console.log('Download response status:', response.status)

      if (!response.ok) {
        let errorMessage = 'Download failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If we can't parse error JSON, use status text
          errorMessage = `Download failed: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      console.log('Starting blob creation...')
      const blob = await response.blob()
      console.log('Blob created, size:', blob.size)

      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }

      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = file.originalName || file.name
      a.style.display = 'none'
      a.rel = 'noopener noreferrer' // Security best practice

      console.log('Triggering download...')
      document.body.appendChild(a)

      // Use a more reliable click method
      try {
        a.click()
        console.log('Download click triggered successfully')
      } catch (clickError) {
        console.error('Click failed, trying alternative method:', clickError)
        // Fallback for some browsers
        const event = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        })
        a.dispatchEvent(event)
      }

      // Clean up with longer delay for safety
      setTimeout(() => {
        try {
          document.body.removeChild(a)
          window.URL.revokeObjectURL(downloadUrl)
          console.log('Download cleanup completed')
        } catch (cleanupError) {
          console.warn('Cleanup warning (non-critical):', cleanupError)
        }
      }, 200)

      setDecryptingFile(null)
      setDecryptionKey("")

      console.log('Download completed successfully')

      // Show success feedback
      const successMessage = `${file.name} downloaded successfully!`
      console.log(successMessage)

      // Optional: Show a brief success toast (you can implement this)
      // For now, we'll just log it

    } catch (error) {
      console.error('Download error:', error)

      // Clear timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const errorMessage = error instanceof Error ? error.message : 'Download failed'
      setDecryptionError(errorMessage)

      // Show user-friendly toast for critical errors
      if (errorMessage.includes('timed out') || errorMessage.includes('Failed to fetch')) {
        addToast({
          type: 'error',
          title: 'Download Failed',
          message: `${errorMessage}. Please check your internet connection and try again.`,
          duration: 6000
        })
      } else {
        addToast({
          type: 'error',
          title: 'Download Error',
          message: errorMessage,
          duration: 5000
        })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecryptAndDownload = async () => {
    if (!decryptingFile || !decryptionKey.trim()) {
      setDecryptionError("Please enter a decryption key")
      return
    }

    if (viewingFile) {
      // Handle viewing decrypted file (preview or open in new tab)
      if (previewFile) {
        // Load preview for decrypted file
        await loadPreview(decryptingFile, decryptionKey.trim())
      } else {
        // Open in new tab
        try {
          setActionLoading(decryptingFile.id)
          const url = `/api/files/download/${decryptingFile.fileId}?key=${encodeURIComponent(decryptionKey.trim())}`
          const response = await fetch(url)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || 'Failed to fetch decrypted file')
          }

          const blob = await response.blob()
          const viewUrl = window.URL.createObjectURL(blob)

          // Open in new tab
          window.open(viewUrl, '_blank')

          // Clean up after a delay
          setTimeout(() => {
            window.URL.revokeObjectURL(viewUrl)
          }, 1000)

          setDecryptingFile(null)
          setViewingFile(null)
          setDecryptionKey("")
        } catch (error) {
          console.error('View decryption error:', error)
          setDecryptionError(error instanceof Error ? error.message : 'Failed to view file')
        } finally {
          setActionLoading(null)
        }
      }
    } else {
      // Handle downloading decrypted file - add to queue with decryption key
      addToQueue({
        id: `download-${decryptingFile.id}-${Date.now()}`,
        fileId: decryptingFile.fileId,
        name: decryptingFile.name,
        originalName: decryptingFile.originalName,
        size: decryptingFile.size,
        type: decryptingFile.type,
        url: decryptingFile.url,
        encrypted: decryptingFile.encrypted,
        senderEmail: decryptingFile.senderEmail,
        senderName: decryptingFile.senderName,
        sharedAt: decryptingFile.sharedAt,
        permissions: decryptingFile.permissions,
        expiresAt: decryptingFile.expiresAt,
        priority: 'normal',
        totalBytes: decryptingFile.size,
        maxRetries: 3,
        decryptionKey: decryptionKey.trim()
      })
    }
  }

  const handlePreview = async (file: ReceivedFile) => {
    if (file.encrypted) {
      // For encrypted files, we need to decrypt first
      setViewingFile(file)
      setDecryptingFile(file)
      setDecryptionKey("")
      setDecryptionError(null)
      return
    }

    // Track file access for delivery status (placeholder for future implementation)
    if (session?.user?.email) {
      console.log(`👁️ File viewed: ${file.name} by ${session.user.email}`)
    }

    // For non-encrypted files, try to preview
    await loadPreview(file)
  }

  const loadPreview = async (file: ReceivedFile, decryptionKey?: string) => {
    try {
      setPreviewLoading(true)
      setPreviewFile(file)

      const url = `/api/files/download/${file.fileId}${decryptionKey ? `?key=${encodeURIComponent(decryptionKey)}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch file for preview')
      }

      const blob = await response.blob()

      // Check if file can be previewed
      if (file.type.startsWith('image/') || file.type.includes('pdf') || file.type.includes('text')) {
        const previewUrl = window.URL.createObjectURL(blob)
        setPreviewUrl(previewUrl)
      } else {
        // For non-previewable files, trigger download
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = file.originalName || file.name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        document.body.removeChild(a)
        setPreviewFile(null)
      }
    } catch (error) {
      console.error('Preview error:', error)
      setPreviewFile(null)
      // Fallback to download with retry
      await downloadFileWithRetry(file, decryptionKey || "", 2)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleView = async (file: ReceivedFile) => {
    // For now, preview and view are the same - open in new tab
    if (file.encrypted) {
      setViewingFile(file)
      setDecryptingFile(file)
      setDecryptionKey("")
      setDecryptionError(null)
      return
    }

    try {
      setActionLoading(file.id)
      const url = `/api/files/download/${file.fileId}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch file for viewing')
      }

      const blob = await response.blob()
      const viewUrl = window.URL.createObjectURL(blob)

      // Open in new tab
      window.open(viewUrl, '_blank')

      // Clean up after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(viewUrl)
      }, 1000)
    } catch (error) {
      console.error('View error:', error)
      // Fallback to download if view fails
      await downloadFileWithRetry(file, "", 2)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (file: ReceivedFile) => {
    if (!confirm(`Are you sure you want to remove "${file.name}" from your received files? This action cannot be undone.`)) {
      return
    }

    try {
      setActionLoading(file.id)
      const response = await fetch(`/api/files/received/${file.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete file')
      }

      // Remove from local state
      setReceivedFiles(prev => prev.filter(f => f.id !== file.id))
    } catch (error) {
      console.error('Delete error:', error)
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: `Failed to delete "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptReject = (file: ReceivedFile, action: 'accept' | 'reject') => {
    setAcceptRejectFile(file)
    setAcceptRejectAction(action)
    setShowAcceptRejectConfirm(true)
  }

  const confirmAcceptReject = async () => {
    if (!acceptRejectFile || !acceptRejectAction) return

    try {
      setActionLoading(acceptRejectFile.id)
      const response = await fetch(`/api/files/received/${acceptRejectFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: acceptRejectAction })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to ${acceptRejectAction} file`)
      }

      const result = await response.json()

      // Update local state based on action
      if (acceptRejectAction === 'reject') {
        // Remove rejected files from the list
        setReceivedFiles(prev => prev.filter(f => f.id !== acceptRejectFile.id))
      }
      // For accept, we could add some visual indication, but for now just keep it

      // Close modal
      setShowAcceptRejectConfirm(false)
      setAcceptRejectFile(null)
      setAcceptRejectAction(null)

      // Show success toast
      addToast({
        type: acceptRejectAction === 'accept' ? 'success' : 'warning',
        title: `File ${acceptRejectAction === 'accept' ? 'Accepted' : 'Rejected'}`,
        message: `"${acceptRejectFile.name}" has been ${acceptRejectAction === 'accept' ? 'accepted' : 'rejected'} successfully`,
        duration: 3000
      })

    } catch (error) {
      console.error('Accept/Reject error:', error)
      alert(`Failed to ${acceptRejectAction} file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBrowseSharedFiles = () => {
    // Navigate to connections page to see available users
    window.location.href = '/connections'
  }

  // Memoized filtering and sorting logic for better performance
  const filteredAndSortedFiles = useMemo(() => {
    return receivedFiles
      .filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              file.senderEmail.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = filterType === "all" ||
                              (filterType === "encrypted" && file.encrypted) ||
                              (filterType === "documents" && isDocumentType(file.type)) ||
                              (filterType === "images" && file.type.includes("image")) ||
                              (filterType === "videos" && file.type.includes("video"))

        // Date range filtering
        const fileDate = new Date(file.sharedAt)
        const fromDate = dateFrom ? new Date(dateFrom) : null
        const toDate = dateTo ? new Date(dateTo) : null
        const matchesDateRange = (!fromDate || fileDate >= fromDate) && (!toDate || fileDate <= toDate)

        // Permissions filtering
        const matchesPermissions = filterPermissions.length === 0 ||
                                   filterPermissions.some(perm => file.permissions.includes(perm))

        // Sender filtering
        const matchesSender = !senderFilter || file.senderEmail.toLowerCase().includes(senderFilter.toLowerCase())

        // Size range filtering
        const minSize = sizeMin ? parseInt(sizeMin) * 1024 * 1024 : null // Convert MB to bytes
        const maxSize = sizeMax ? parseInt(sizeMax) * 1024 * 1024 : null
        const matchesSizeRange = (!minSize || file.size >= minSize) && (!maxSize || file.size <= maxSize)

        return matchesSearch && matchesType && matchesDateRange && matchesPermissions && matchesSender && matchesSizeRange
      })
      .sort((a, b) => {
        let comparison = 0
        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name)
            break
          case "size":
            comparison = a.size - b.size
            break
          case "date":
          default:
            comparison = new Date(a.sharedAt).getTime() - new Date(b.sharedAt).getTime()
            break
        }
        return sortOrder === "asc" ? comparison : -comparison
      })
  }, [receivedFiles, searchQuery, filterType, sortBy, sortOrder, dateFrom, dateTo, filterPermissions, senderFilter, sizeMin, sizeMax])

  // Bulk actions
  const handleSelectFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredAndSortedFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filteredAndSortedFiles.map(f => f.id)))
    }
  }

  const handleBulkDownload = async () => {
    // Add all selected files to download queue
    for (const fileId of selectedFiles) {
      const file = receivedFiles.find(f => f.id === fileId)
      if (file && !file.encrypted) { // Only add non-encrypted files to bulk download
        addToQueue({
          id: `download-${file.id}-${Date.now()}`,
          fileId: file.fileId,
          name: file.name,
          originalName: file.originalName,
          size: file.size,
          type: file.type,
          url: file.url,
          encrypted: file.encrypted,
          senderEmail: file.senderEmail,
          senderName: file.senderName,
          sharedAt: file.sharedAt,
          permissions: file.permissions,
          expiresAt: file.expiresAt,
          priority: 'low', // Bulk downloads have lower priority
          totalBytes: file.size,
          maxRetries: 3
        })
      }
    }
    setSelectedFiles(new Set())
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedFiles.size} files? This action cannot be undone.`)) {
      return
    }

    try {
      setActionLoading("bulk-delete")
      const deletePromises = Array.from(selectedFiles).map(fileId =>
        fetch(`/api/files/received/${fileId}`, { method: 'DELETE' })
      )

      await Promise.all(deletePromises)

      // Remove from local state
      setReceivedFiles(prev => prev.filter(f => !selectedFiles.has(f.id)))
      setSelectedFiles(new Set())
    } catch (error) {
      console.error('Bulk delete error:', error)
      addToast({
        type: 'error',
        title: 'Bulk Delete Failed',
        message: 'Some files could not be deleted. Please try again.',
        duration: 5000
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkAcceptReject = (operation: 'accept' | 'reject') => {
    setBulkOperation(operation)
    setShowBulkConfirm(true)
  }

  const handleBulkExport = (format: 'csv' | 'json' = 'json') => {
    setBulkOperation('export')
    performBulkExport(format)
  }

  const performBulkExport = async (format: 'csv' | 'json' = 'json') => {
    try {
      setActionLoading("bulk-export")
      const shareIds = Array.from(selectedFiles)

      const response = await fetch('/api/files/received/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'export',
          shareIds,
          format
        })
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Create download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `received-files-export.${format === 'csv' ? 'csv' : 'json'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      setSelectedFiles(new Set())
      addToast({
        type: 'success',
        title: 'Export Completed',
        message: `Successfully exported ${shareIds.length} files`,
        duration: 4000
      })
    } catch (error) {
      console.error('Bulk export error:', error)
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Please try again.',
        duration: 5000
      })
    } finally {
      setActionLoading(null)
    }
  }

  const confirmBulkAcceptReject = async () => {
    if (!bulkOperation || selectedFiles.size === 0) return

    const shareIds = Array.from(selectedFiles)
    setBulkProgress({ completed: 0, total: shareIds.length })
    setShowBulkConfirm(false)

    try {
      const response = await fetch('/api/files/received/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: bulkOperation,
          shareIds
        })
      })

      if (!response.ok) {
        throw new Error('Bulk operation failed')
      }

      const result = await response.json()
      setBulkResults(result.results)

      // Update local state based on operation
      if (bulkOperation === 'reject' || bulkOperation === 'delete') {
        const successfulIds = result.results
          .filter((r: any) => r.success)
          .map((r: any) => r.shareId)
        setReceivedFiles(prev => prev.filter(f => !successfulIds.includes(f.id)))
      }

      setSelectedFiles(new Set())

      // Show results summary
      const successCount = result.summary.totalSuccess
      const failCount = result.summary.totalFailed
      addToast({
        type: failCount > 0 ? 'warning' : 'success',
        title: `Bulk ${bulkOperation.charAt(0).toUpperCase() + bulkOperation.slice(1)} Completed`,
        message: `${successCount} successful${failCount > 0 ? `, ${failCount} failed` : ''}`,
        duration: 5000
      })

    } catch (error) {
      console.error('Bulk operation error:', error)
      addToast({
        type: 'error',
        title: `Bulk ${bulkOperation.charAt(0).toUpperCase() + bulkOperation.slice(1)} Failed`,
        message: 'Please try again.',
        duration: 5000
      })
    } finally {
      setBulkProgress(null)
      setBulkOperation(null)
    }
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">Please login to view received files</div>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading received files...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-4">Error Loading Files</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">

          {/* Load More Button for Pagination */}
          {receivedFiles.length > 0 && receivedFiles.length < totalFiles && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchReceivedFiles(false, currentPage + 1, true)}
                disabled={isLoadingMore}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed touch-manipulation"
              >
                {isLoadingMore ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Loading...
                  </div>
                ) : (
                  `Load More Files (${totalFiles - receivedFiles.length} remaining)`
                )}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-6 mb-8">
           <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
             <div className="flex items-center gap-4">
               <h1 className="text-2xl md:text-3xl font-bold">Received Files</h1>
               <ConnectionStatus />
             </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  {filteredAndSortedFiles.length} of {receivedFiles.length} files
                  {lastUpdate && (
                    <span className="ml-2 text-xs">
                      • Updated {lastUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fetchReceivedFiles()}
                  disabled={loading}
                  className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg transition-colors text-sm touch-manipulation disabled:cursor-not-allowed"
                  title="Refresh files"
                >
                  {loading ? "🔄" : "🔄 Refresh"}
                </button>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search files by name or sender..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  >
                    <option value="all">All Files</option>
                    <option value="encrypted">Encrypted</option>
                    <option value="documents">Documents</option>
                    <option value="images">Images</option>
                    <option value="videos">Videos</option>
                  </select>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [sort, order] = e.target.value.split('-')
                      setSortBy(sort as "date" | "name" | "size")
                      setSortOrder(order as "asc" | "desc")
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="size-desc">Largest First</option>
                    <option value="size-asc">Smallest First</option>
                  </select>
                </div>
              </div>

              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <label className="block text-sm font-medium mb-1">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sender</label>
                  <select
                    value={senderFilter}
                    onChange={(e) => setSenderFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  >
                    <option value="">All Senders</option>
                    {availableSenders.map(sender => (
                      <option key={sender} value={sender}>{sender}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Permissions</label>
                  <select
                    multiple
                    value={filterPermissions}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value)
                      setFilterPermissions(values)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  >
                    <option value="VIEW">View</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="EDIT">Edit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min Size (MB)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={sizeMin}
                    onChange={(e) => setSizeMin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Size (MB)</label>
                  <input
                    type="number"
                    placeholder="No limit"
                    value={sizeMax}
                    onChange={(e) => setSizeMax(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setDateFrom("")
                      setDateTo("")
                      setSenderFilter("")
                      setFilterPermissions([])
                      setSizeMin("")
                      setSizeMax("")
                    }}
                    className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedFiles.size > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setSelectedFiles(new Set())}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm underline"
                    >
                      Clear selection
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleBulkAcceptReject('accept')}
                      disabled={actionLoading !== null}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      Accept Selected
                    </button>
                    <button
                      onClick={() => handleBulkAcceptReject('reject')}
                      disabled={actionLoading !== null}
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      Reject Selected
                    </button>
                    <button
                      onClick={handleBulkDownload}
                      disabled={actionLoading === "bulk-download"}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      {actionLoading === "bulk-download" ? "Downloading..." : "Download Selected"}
                    </button>
                    <button
                      onClick={() => handleBulkExport('json')}
                      disabled={actionLoading === "bulk-export"}
                      className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      {actionLoading === "bulk-export" ? "Exporting..." : "Export JSON"}
                    </button>
                    <button
                      onClick={() => handleBulkExport('csv')}
                      disabled={actionLoading === "bulk-export"}
                      className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      {actionLoading === "bulk-export" ? "Exporting..." : "Export CSV"}
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={actionLoading === "bulk-delete"}
                      className="bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      {actionLoading === "bulk-delete" ? "Deleting..." : "Delete Selected"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {receivedFiles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">📥</div>
              <h2 className="text-2xl font-semibold mb-4">No files received yet</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                When someone shares files with you, they'll appear here.
              </p>
              <button
                onClick={handleBrowseSharedFiles}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors touch-manipulation"
              >
                Browse Shared Files
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All Checkbox */}
              {filteredAndSortedFiles.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === filteredAndSortedFiles.length && filteredAndSortedFiles.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select All ({filteredAndSortedFiles.length} files)
                  </label>
                </div>
              )}

              <div className="grid gap-4">
                {filteredAndSortedFiles.map((file) => (
                  <SwipeableFileCard
                    key={file.id}
                    file={file}
                    isSelected={selectedFiles.has(file.id)}
                    onSelect={handleSelectFile}
                    onAccept={(file) => handleAcceptReject(file, 'accept')}
                    onReject={(file) => handleAcceptReject(file, 'reject')}
                    onDownload={handleDownload}
                    onPreview={handlePreview}
                    onDelete={handleDelete}
                    actionLoading={actionLoading}
                  >
                    {/* File content */}
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="text-2xl md:text-3xl">{getFileIcon(file.type)}</div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base md:text-lg font-semibold truncate">{file.name}</h3>
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                          From {file.senderEmail} • {formatFileSize(file.size)} • {formatDate(file.sharedAt)}
                        </p>
                      </div>
                    </div>
                  </SwipeableFileCard>
                ))}
              </div>
            </div>
          )}

          {/* File Statistics */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {receivedFiles.length}
              </div>
              <p className="text-gray-600 dark:text-gray-400">Total Files</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {receivedFiles.filter(f => f.encrypted).length}
              </div>
              <p className="text-gray-600 dark:text-gray-400">Encrypted Files</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {formatFileSize(receivedFiles.reduce((acc, file) => acc + file.size, 0))}
              </div>
              <p className="text-gray-600 dark:text-gray-400">Total Size</p>
            </div>
          </div>

        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getFileIcon(previewFile.type)}</div>
                <div>
                  <h3 className="font-semibold text-lg truncate max-w-md">{previewFile.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatFileSize(previewFile.size)} • From {previewFile.senderName || previewFile.senderEmail}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm touch-manipulation"
                >
                  ⬇️ Download
                </button>
                <button
                  onClick={() => {
                    setPreviewFile(null)
                    setPreviewUrl(null)
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors touch-manipulation"
                  aria-label="Close preview"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[70vh] overflow-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p>Loading preview...</p>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="flex justify-center">
                  {previewFile.type.startsWith('image/') ? (
                    <LazyImage
                      src={previewUrl}
                      alt={previewFile.name}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg"
                    />
                  ) : previewFile.type.includes('pdf') ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[60vh] border rounded-lg"
                      title={`Preview of ${previewFile.name}`}
                    />
                  ) : (
                    <div className="text-center p-8">
                      <div className="text-6xl mb-4">{getFileIcon(previewFile.type)}</div>
                      <p className="text-gray-600 dark:text-gray-400">
                        Preview not available for this file type
                      </p>
                      <button
                        onClick={() => handleDownload(previewFile)}
                        className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors touch-manipulation"
                      >
                        Download File Instead
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">⚠️</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Failed to load preview
                  </p>
                  <button
                    onClick={() => handleDownload(previewFile)}
                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors touch-manipulation"
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decryption Modal */}
      {decryptingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg md:text-xl font-semibold mb-4">Decrypt File</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter the decryption key to {viewingFile ? 'view' : 'download'} <strong className="break-words">{decryptingFile.name}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Decryption Key</label>
                <input
                  type="password"
                  value={decryptionKey}
                  onChange={(e) => setDecryptionKey(e.target.value)}
                  placeholder="Enter decryption key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-base"
                  onKeyPress={(e) => e.key === 'Enter' && handleDecryptAndDownload()}
                  autoFocus
                />
              </div>

              {decryptionError && (
                <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                  {decryptionError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDecryptAndDownload}
                  disabled={actionLoading !== null || !decryptionKey.trim()}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white py-3 rounded-lg transition-colors disabled:cursor-not-allowed text-base font-medium touch-manipulation"
                >
                  {actionLoading !== null ? "Processing..." : `Decrypt & ${viewingFile ? 'View' : 'Download'}`}
                </button>
                <button
                  onClick={() => {
                    setDecryptingFile(null)
                    setViewingFile(null)
                    setDecryptionKey("")
                    setDecryptionError(null)
                  }}
                  disabled={actionLoading !== null}
                  className="flex-1 sm:flex-none px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed text-base font-medium touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accept/Reject Confirmation Modal */}
      {showAcceptRejectConfirm && acceptRejectFile && acceptRejectAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold mb-4">
              {acceptRejectAction === 'accept' ? 'Accept' : 'Reject'} File Share
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to <strong>{acceptRejectAction}</strong> the file share for{' '}
              <strong className="break-words">"{acceptRejectFile.name}"</strong>?
            </p>
            {acceptRejectAction === 'reject' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> Rejecting will revoke access to this file. This action cannot be undone.
                </p>
              </div>
            )}
            {acceptRejectAction === 'accept' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Accepting acknowledges receipt of this file share. The share will remain active.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={confirmAcceptReject}
                disabled={actionLoading !== null}
                className={`flex-1 py-3 rounded-lg transition-colors disabled:cursor-not-allowed text-base font-medium touch-manipulation ${
                  acceptRejectAction === 'accept'
                    ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white'
                    : 'bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white'
                }`}
              >
                {actionLoading !== null ? "Processing..." : `Yes, ${acceptRejectAction}`}
              </button>
              <button
                onClick={() => {
                  setShowAcceptRejectConfirm(false)
                  setAcceptRejectFile(null)
                  setAcceptRejectAction(null)
                }}
                disabled={actionLoading !== null}
                className="flex-1 sm:flex-none px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed text-base font-medium touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operation Confirmation Modal */}
      {showBulkConfirm && bulkOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold mb-4">
              Bulk {bulkOperation.charAt(0).toUpperCase() + bulkOperation.slice(1)}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to <strong>{bulkOperation}</strong> {selectedFiles.size} selected file{selectedFiles.size !== 1 ? 's' : ''}?
            </p>
            {(bulkOperation === 'reject' || bulkOperation === 'delete') && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> This action cannot be undone.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={confirmBulkAcceptReject}
                disabled={actionLoading !== null}
                className={`flex-1 py-3 rounded-lg transition-colors disabled:cursor-not-allowed text-base font-medium touch-manipulation ${
                  bulkOperation === 'accept'
                    ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-400'
                    : bulkOperation === 'reject'
                    ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-400'
                    : 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400'
                } text-white`}
              >
                {actionLoading !== null ? "Processing..." : `Yes, ${bulkOperation}`}
              </button>
              <button
                onClick={() => {
                  setShowBulkConfirm(false)
                  setBulkOperation(null)
                }}
                disabled={actionLoading !== null}
                className="flex-1 sm:flex-none px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed text-base font-medium touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Progress Modal */}
      {bulkProgress && bulkOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold mb-4">
              Processing Bulk {bulkOperation.charAt(0).toUpperCase() + bulkOperation.slice(1)}
            </h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>{bulkProgress.completed} / {bulkProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
            {bulkProgress.currentFile && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Processing: <strong className="break-words">{bulkProgress.currentFile}</strong>
              </p>
            )}
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      )}

      {/* Download Queue */}
      <DownloadQueue />
    </div>
  )
}

export default function Receive() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ReceiveContent />
      </ToastProvider>
    </ErrorBoundary>
  )
}