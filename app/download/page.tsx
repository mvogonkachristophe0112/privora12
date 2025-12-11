'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { Loading } from '@/components/Loading'
import { ErrorBoundary } from '@/components/ErrorBoundary'

interface DownloadableFile {
  id: string
  fileId: string
  name: string
  originalName: string
  size: number
  type: string
  encrypted: boolean
  senderEmail: string
  senderName?: string
  sharedAt: string
  expiresAt?: string
  permissions: string[]
  shareType: string
  groupName?: string
  hasViewed: boolean
  lastViewed?: string
  accessCount: number
  viewCount: number
  downloadCount: number
  maxAccessCount?: number
  password?: string
  revoked: boolean
  deliveryStatus?: {
    status: string
    deliveredAt?: string
    viewedAt?: string
    downloadedAt?: string
    retryCount: number
    failureReason?: string
  }
}

function DownloadContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const { addToast } = useToast()

  const [files, setFiles] = useState<DownloadableFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }
    fetchFiles()
  }, [session, router])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/files/received?page=1&limit=100')
      if (!response.ok) {
        throw new Error('Failed to fetch received files')
      }

      const data = await response.json()
      setFiles(data.files || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching files:', err)
      setError(`Failed to fetch received files: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (file: DownloadableFile) => {
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
        fetchFiles()
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
    return '📄'
  }

  const getStatusBadge = (file: DownloadableFile) => {
    if (file.revoked) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Revoked</span>
    }

    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Expired</span>
    }

    if (file.maxAccessCount && file.accessCount >= file.maxAccessCount) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Limit Reached</span>
    }

    if (file.deliveryStatus?.status === 'delivered') {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Available</span>
    }

    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Available</span>
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-semibold mb-4">Authentication Required</h2>
          <p className="text-gray-600 dark:text-gray-400">Please login to view download files</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading your files...</p>
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
            onClick={() => fetchFiles()}
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
              <h1 className="text-2xl md:text-3xl font-bold">Download Files</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {files.length} files available
              </div>
              <button
                onClick={() => fetchFiles()}
                disabled={loading}
                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                title="Refresh files"
              >
                {loading ? "🔄" : "🔄 Refresh"}
              </button>
            </div>
          </div>

          {/* Files List */}
          {files.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">📥</div>
              <h2 className="text-2xl font-semibold mb-4">No files available</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You don't have any files available for download at the moment.
                Files shared with you will appear here.
              </p>
              <button
                onClick={() => window.location.href = '/connections'}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors touch-manipulation"
              >
                Browse Connections
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {files.map((file) => (
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
                        From {file.senderName || file.senderEmail} • {formatFileSize(file.size)} • {formatDate(file.sharedAt)}
                      </p>
                      {file.deliveryStatus && (
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(file)}
                          {file.encrypted && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              🔒 Encrypted
                            </span>
                          )}
                          {file.password && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              🔑 Password
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Views: {file.viewCount}</span>
                        <span>Downloads: {file.downloadCount}</span>
                        {file.maxAccessCount && (
                          <span>Limit: {file.maxAccessCount}</span>
                        )}
                        {file.expiresAt && (
                          <span className={new Date(file.expiresAt) < new Date() ? 'text-red-600' : ''}>
                            Expires: {formatDate(file.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={
                          downloading === file.id ||
                          file.revoked ||
                          (file.expiresAt && new Date(file.expiresAt) < new Date()) ||
                          (file.maxAccessCount && file.accessCount >= file.maxAccessCount) ||
                          !file.permissions.includes('DOWNLOAD')
                        }
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

        </div>
      </div>
    </div>
  )
}

export default function Download() {
  return (
    <ErrorBoundary>
      <DownloadContent />
    </ErrorBoundary>
  )
}