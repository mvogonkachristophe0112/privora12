"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { usePresence } from "@/lib/presence-context"
import { useNotifications } from "@/lib/notification-context"
import { useToast } from "@/components/Toast"
import ConnectionStatus from "@/components/ConnectionStatus"
import { Loading } from "@/components/Loading"
import { ErrorBoundary } from "@/components/ErrorBoundary"

interface ReceivedFile {
   id: string // Share ID
   fileId: string // Actual file ID for downloads
   name: string
   originalName: string
   size: number
   type: string
   url: string
   encrypted: boolean
   senderEmail: string
   senderName?: string
   sharedAt: string
   permissions: string[]
   expiresAt?: string
   maxAccessCount?: number
   accessCount: number
   revoked: boolean
   password?: string
   deliveryStatus?: {
     status: string
     deliveredAt?: string
     viewedAt?: string
     downloadedAt?: string
   }
}

function ReceiveContent() {
  const { data: session } = useSession()
  const { socket } = usePresence()
  const { incrementNewFiles } = useNotifications()
  const { addToast } = useToast()

  // State management
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date")

  // Fetch received files
  const fetchReceivedFiles = useCallback(async (showNotifications = false) => {
    if (!session) return

    try {
      setLoading(true)
      const response = await fetch('/api/files/received?page=1&limit=50')
      if (!response.ok) {
        throw new Error('Failed to fetch received files')
      }

      const data = await response.json()
      const files = data.files || []

      // Check for new files if requested
      if (showNotifications && receivedFiles.length > 0) {
        const previousFileIds = new Set(receivedFiles.map(f => f.id))
        const newFiles: ReceivedFile[] = files.filter((file: ReceivedFile) => !previousFileIds.has(file.id))

        if (newFiles.length > 0) {
          incrementNewFiles(newFiles.length)
          addToast({
            type: 'success',
            title: `📨 ${newFiles.length} new file${newFiles.length > 1 ? 's' : ''} received!`,
            message: `From ${newFiles.map((f: ReceivedFile) => f.senderName || f.senderEmail.split('@')[0]).join(', ')}`,
            duration: 5000
          })
        }
      }

      setReceivedFiles(files)
      setError(null)
    } catch (err) {
      console.error('Error fetching received files:', err)
      setError(`Failed to fetch received files: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [session, receivedFiles, incrementNewFiles, addToast])

  // Initial load
  useEffect(() => {
    fetchReceivedFiles()
  }, [fetchReceivedFiles])

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket || !session) return

    // Register user with socket server
    socket.emit('register-user', {
      userId: session.user.id,
      email: session.user.email
    })

    const handleFileReceived = (data: any) => {
      console.log('New file received via real-time:', data)

      // Show notification
      addToast({
        type: 'success',
        title: '📨 New file received!',
        message: `"${data.fileName}" from ${data.senderName || data.senderEmail?.split('@')[0] || 'Unknown'}`,
        duration: 6000
      })

      // Refresh the file list
      fetchReceivedFiles(true)
    }

    const handleRegistrationSuccess = (data: any) => {
      console.log('Socket registration successful:', data)
    }

    const handleRegistrationFailed = (data: any) => {
      console.error('Socket registration failed:', data)
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to connect to real-time service',
        duration: 5000
      })
    }

    socket.on('file-received', handleFileReceived)
    socket.on('registration-success', handleRegistrationSuccess)
    socket.on('registration-failed', handleRegistrationFailed)

    return () => {
      socket.off('file-received', handleFileReceived)
      socket.off('registration-success', handleRegistrationSuccess)
      socket.off('registration-failed', handleRegistrationFailed)
    }
  }, [socket, session, fetchReceivedFiles, addToast])

  // Download file handler
  const handleDownload = async (file: ReceivedFile) => {
    if (downloading) return

    setDownloading(file.id)

    try {
      // Check if file is expired
      if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
        addToast({
          type: 'error',
          title: 'File expired',
          message: 'This file has expired and cannot be downloaded',
          duration: 5000
        })
        return
      }

      // Check if access count exceeded
      if (file.maxAccessCount && file.accessCount >= file.maxAccessCount) {
        addToast({
          type: 'error',
          title: 'Download limit reached',
          message: 'The download limit for this file has been exceeded',
          duration: 5000
        })
        return
      }

      // Check if file is revoked
      if (file.revoked) {
        addToast({
          type: 'error',
          title: 'File revoked',
          message: 'This file has been revoked and is no longer available',
          duration: 5000
        })
        return
      }

      // Check permissions
      if (!file.permissions.includes('DOWNLOAD')) {
        addToast({
          type: 'error',
          title: 'Permission denied',
          message: 'You do not have download permission for this file',
          duration: 5000
        })
        return
      }

      // Check if password is required
      let password = ''
      if (file.password) {
        password = prompt('Enter password to download this file:') || ''
        if (!password) {
          setDownloading(null)
          return
        }
      }

      // Check if decryption key is required for encrypted files
      let decryptionKey = ''
      if (file.encrypted) {
        decryptionKey = prompt('Enter decryption key for this encrypted file:') || ''
        if (!decryptionKey) {
          setDownloading(null)
          return
        }
      }

      // Create download URL with parameters
      let downloadUrl = `/api/files/download/${file.fileId}`
      const params = new URLSearchParams()

      if (password) {
        params.append('password', password)
      }

      if (decryptionKey) {
        params.append('key', decryptionKey)
      }

      if (params.toString()) {
        downloadUrl += `?${params.toString()}`
      }

      // Fetch the file data
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Download failed: ${response.status}`)
      }

      // Get the file data as blob
      const blob = await response.blob()

      // Create download link with blob
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = file.originalName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl)

      addToast({
        type: 'success',
        title: 'Download completed',
        message: `${file.name} has been downloaded successfully`,
        duration: 3000
      })

      // Refresh the file list to update access counts
      setTimeout(() => {
        fetchReceivedFiles()
      }, 1000)

    } catch (error) {
      console.error('Download error:', error)
      addToast({
        type: 'error',
        title: 'Download failed',
        message: error instanceof Error ? error.message : 'Failed to download the file. Please try again.',
        duration: 5000
      })
    } finally {
      setDownloading(null)
    }
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get file icon
  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄'
    if (type.includes('zip') || type.includes('rar')) return '📦'
    if (type.includes('image')) return '🖼️'
    if (type.includes('video')) return '🎥'
    if (type.includes('audio')) return '🎵'
    return '📄'
  }

  // Filter and sort files
  const filteredAndSortedFiles = receivedFiles
    .filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.senderEmail.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'size':
          return b.size - a.size
        case 'date':
        default:
          return new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime()
      }
    })

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-semibold mb-4">Authentication Required</h2>
          <p className="text-gray-600 dark:text-gray-400">Please login to view received files</p>
        </div>
      </div>
    )
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
            onClick={() => fetchReceivedFiles()}
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

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold">Received Files</h1>
              <ConnectionStatus />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {filteredAndSortedFiles.length} of {receivedFiles.length} files
              </div>
              <button
                onClick={() => fetchReceivedFiles()}
                disabled={loading}
                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                title="Refresh files"
              >
                {loading ? "🔄" : "🔄 Refresh"}
              </button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
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
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "date" | "name" | "size")}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                >
                  <option value="date">Newest First</option>
                  <option value="name">Name A-Z</option>
                  <option value="size">Largest First</option>
                </select>
              </div>
            </div>
          </div>

          {/* Files List */}
          {filteredAndSortedFiles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">
                {searchQuery ? '🔍' : '📥'}
              </div>
              <h2 className="text-2xl font-semibold mb-4">
                {searchQuery ? 'No files found' : 'No files received yet'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'When someone shares files with you, they\'ll appear here automatically'
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={() => window.location.href = '/connections'}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors touch-manipulation"
                >
                  Browse Connections
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredAndSortedFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold truncate mb-1">
                        {file.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        From {file.senderEmail} • {formatFileSize(file.size)} • {formatDate(file.sharedAt)}
                      </p>
                      {file.deliveryStatus && (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            file.deliveryStatus.status === 'delivered'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : file.deliveryStatus.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {file.deliveryStatus.status === 'delivered' ? '✅ Delivered' :
                             file.deliveryStatus.status === 'pending' ? '⏳ Pending' : '👁️ Viewed'}
                          </span>
                          {file.encrypted && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              🔒 Encrypted
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={downloading === file.id}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed touch-manipulation"
                      >
                        {downloading === file.id ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Downloading...
                          </div>
                        ) : (
                          '⬇️ Download'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Statistics */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {receivedFiles.length}
              </div>
              <p className="text-gray-600 dark:text-gray-400">Total Files</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {receivedFiles.filter(f => f.deliveryStatus?.status === 'delivered').length}
              </div>
              <p className="text-gray-600 dark:text-gray-400">Delivered</p>
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
    </div>
  )
}

export default function Receive() {
  return (
    <ErrorBoundary>
      <ReceiveContent />
    </ErrorBoundary>
  )
}