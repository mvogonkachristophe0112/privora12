"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"

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

  useEffect(() => {
    const fetchReceivedFiles = async () => {
      if (!session) return

      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/files/received')
        if (!response.ok) {
          throw new Error('Failed to fetch received files')
        }
        const files = await response.json()
        setReceivedFiles(files)
      } catch (err) {
        console.error('Error fetching received files:', err)
        setError(`Failed to fetch received files: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    }

    fetchReceivedFiles()
  }, [session])

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

  const handleDownload = async (file: ReceivedFile) => {
    if (file.encrypted) {
      setDecryptingFile(file)
      setDecryptionKey("")
      setDecryptionError(null)
      return
    }

    await downloadFile(file, "")
  }

  const downloadFile = async (file: ReceivedFile, key: string) => {
    try {
      setActionLoading(file.id)
      const url = `/api/files/download/${file.fileId}${key ? `?key=${encodeURIComponent(key)}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Download failed')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = file.originalName || file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      setDecryptingFile(null)
      setDecryptionKey("")
    } catch (error) {
      console.error('Download error:', error)
      setDecryptionError(error instanceof Error ? error.message : 'Download failed')
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
      // Handle viewing decrypted file
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
    } else {
      // Handle downloading decrypted file
      await downloadFile(decryptingFile, decryptionKey.trim())
    }
  }

  const handleView = async (file: ReceivedFile) => {
    if (file.encrypted) {
      // For encrypted files, we need to download and then view
      setViewingFile(file)
      setDecryptingFile(file)
      setDecryptionKey("")
      setDecryptionError(null)
      return
    }

    // For non-encrypted files, try to view directly
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
      await downloadFile(file, "")
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold">Received Files</h1>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {receivedFiles.length} files received
              </div>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm touch-manipulation"
                title="Refresh files"
              >
                🔄 Refresh
              </button>
            </div>
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
            <div className="grid gap-4">
              {receivedFiles.map((file) => (
                <div key={file.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-xl transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
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
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={actionLoading === file.id}
                          className="flex-1 sm:flex-none bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-3 md:px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed touch-manipulation"
                        >
                          {actionLoading === file.id ? "Processing..." : "Download"}
                        </button>
                        <button
                          onClick={() => handleView(file)}
                          disabled={actionLoading === file.id}
                          className="flex-1 sm:flex-none bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-3 md:px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed touch-manipulation"
                        >
                          {actionLoading === file.id ? "Loading..." : "View"}
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          disabled={actionLoading === file.id}
                          className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white px-3 md:px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed touch-manipulation"
                        >
                          {actionLoading === file.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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