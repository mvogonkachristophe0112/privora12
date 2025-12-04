"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { usePresence } from "@/lib/presence-context"
import { useNotifications } from "@/lib/notification-context"

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

export default function Receive() {
   const { data: session } = useSession()
   const { isConnected, userPresence } = usePresence()
   const { incrementNewFiles, clearNewFiles } = useNotifications()
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
   const [newFileNotifications, setNewFileNotifications] = useState<ReceivedFile[]>([])
   const [showNotification, setShowNotification] = useState(false)
   const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
   const [previewFile, setPreviewFile] = useState<ReceivedFile | null>(null)
   const [previewUrl, setPreviewUrl] = useState<string | null>(null)
   const [previewLoading, setPreviewLoading] = useState(false)
 
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
        const newFiles = files.filter((file: ReceivedFile) => !previousFileIds.has(file.id))

        if (newFiles.length > 0) {
          setNewFileNotifications(newFiles)
          setShowNotification(true)
          incrementNewFiles(newFiles.length)

          // Auto-hide notification after 5 seconds
          setTimeout(() => {
            setShowNotification(false)
            setNewFileNotifications([])
          }, 5000)

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
    if (type.includes('word') || type.includes('document')) return '📝'
    return '📄'
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

    await downloadFileWithRetry(file, "", 3) // Retry up to 3 times
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
          alert(`Download failed after ${maxRetries} attempts: ${errorMessage}`)
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

      // Show user-friendly alert for critical errors
      if (errorMessage.includes('timed out') || errorMessage.includes('Failed to fetch')) {
        alert(`Download failed: ${errorMessage}. Please check your internet connection and try again.`)
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
      // Handle downloading decrypted file
      await downloadFileWithRetry(decryptingFile, decryptionKey.trim(), 3)
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
      alert(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
                            (filterType === "documents" && file.type.includes("document")) ||
                            (filterType === "images" && file.type.includes("image")) ||
                            (filterType === "videos" && file.type.includes("video"))
        return matchesSearch && matchesType
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
  }, [receivedFiles, searchQuery, filterType, sortBy, sortOrder])

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
    for (const fileId of selectedFiles) {
      const file = receivedFiles.find(f => f.id === fileId)
      if (file) {
        await handleDownload(file)
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
      alert('Some files could not be deleted. Please try again.')
    } finally {
      setActionLoading(null)
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
          {/* Real-time Notification Banner */}
          {showNotification && newFileNotifications.length > 0 && (
            <div className="mb-6 bg-gradient-to-r from-green-500 to-blue-500 text-white p-4 rounded-xl shadow-lg animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📨</div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {newFileNotifications.length} new file{newFileNotifications.length > 1 ? 's' : ''} received!
                    </h3>
                    <p className="text-sm opacity-90">
                      From {newFileNotifications.map(f => f.senderName || f.senderEmail.split('@')[0]).join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowNotification(false)
                    setNewFileNotifications([])
                  }}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors touch-manipulation"
                  aria-label="Dismiss notification"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

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
                {isConnected && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Live Updates
                  </div>
                )}
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
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkDownload}
                      disabled={actionLoading === "bulk-download"}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      {actionLoading === "bulk-download" ? "Downloading..." : "Download Selected"}
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
                  <div key={file.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-xl transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 md:gap-4">
                        {/* File Selection Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => handleSelectFile(file.id)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div className="text-2xl md:text-3xl">{getFileIcon(file.type)}</div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base md:text-lg font-semibold truncate">{file.name}</h3>
                          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                            From {file.senderEmail} • {formatFileSize(file.size)} • {formatDate(file.sharedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {file.encrypted && (
                          <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium self-start sm:self-center">
                            🔒 Encrypted
                          </span>
                        )}

                        <div className="flex gap-2 w-full sm:w-auto">
                          {file.type.startsWith('image/') && (
                            <button
                              onClick={() => handlePreview(file)}
                              disabled={actionLoading === file.id}
                              className="flex-1 sm:flex-none bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
                            >
                              {actionLoading === file.id ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                  <span>Loading...</span>
                                </div>
                              ) : (
                                "👁️ Preview"
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDownload(file)}
                            disabled={actionLoading === file.id}
                            className="flex-1 sm:flex-none bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
                          >
                            {actionLoading === file.id ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                <span>Downloading...</span>
                              </div>
                            ) : (
                              "⬇️ Download"
                            )}
                          </button>
                          <button
                            onClick={() => handleView(file)}
                            disabled={actionLoading === file.id}
                            className="flex-1 sm:flex-none bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
                          >
                            {actionLoading === file.id ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                <span>Loading...</span>
                              </div>
                            ) : (
                              "🔗 Open"
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(file)}
                            disabled={actionLoading === file.id}
                            className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
                          >
                            {actionLoading === file.id ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                <span>Deleting...</span>
                              </div>
                            ) : (
                              "🗑️ Delete"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
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
                    <img
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
    </div>
  )
}