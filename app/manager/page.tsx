"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { usePresence } from "@/lib/presence-context"
import { useDownloadManager } from "@/components/DownloadManager"
import DownloadQueue from "@/components/DownloadQueue"
import { ToastProvider, useToast } from "@/components/Toast"
import ConnectionStatus from "@/components/ConnectionStatus"
import { Loading } from "@/components/Loading"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import LazyImage from "@/components/LazyImage"
import VirtualizedFileList from "@/components/VirtualizedFileList"

interface ManagedFile {
  id: string
  name: string
  originalName: string
  size: number
  type: string
  url: string
  encrypted: boolean
  fileType: string
  createdAt: string
  updatedAt: string
  shares?: {
    id: string
    sharedWithEmail: string
    permissions: string
    expiresAt?: string
    status: string
    recipient?: {
      name: string
      email: string
    }
  }[]
  downloadCount: number
  viewCount: number
  shareCount: number
  lastAccessed?: string
}

interface FileStats {
  totalFiles: number
  totalSize: number
  encryptedFiles: number
  sharedFiles: number
  recentUploads: number
  storageUsed: number
  storageLimit: number
}

interface SocketFileUpdateData {
  userId: string
  fileName?: string
  fileSize?: number
  senderName?: string
  senderEmail?: string
}

function FileManagerContent() {
  const { data: session } = useSession()
  const { socket } = usePresence()
  const { addToast } = useToast()
  const { addToQueue } = useDownloadManager()

  const [files, setFiles] = useState<ManagedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<FileStats | null>(null)

  // View modes
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  // Search and filtering
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // UI states
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<ManagedFile | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(50)
  const [totalFiles, setTotalFiles] = useState(0)

  // Fetch files
  const fetchFiles = useCallback(async (page = 1, append = false) => {
    if (!session) return

    try {
      const response = await fetch(`/api/files?page=${page}&limit=${filesPerPage}&includeShares=true&includeStats=true`)

      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }

      const data = await response.json()
      const fetchedFiles = data.files || []
      const fetchedStats = data.stats || null

      if (append) {
        setFiles(prev => [...prev, ...fetchedFiles])
      } else {
        setFiles(fetchedFiles)
        setStats(fetchedStats)
      }

      setTotalFiles(data.total || fetchedFiles.length)
      setCurrentPage(page)
      setError(null)
    } catch (err) {
      console.error('Error fetching files:', err)
      setError(`Failed to fetch files: ${err instanceof Error ? err.message : 'Unknown error'}`)
      addToast({
        type: 'error',
        title: 'Failed to Load Files',
        message: 'Unable to load your files. Please try again.',
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }, [session, filesPerPage, addToast])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // Real-time updates
  useEffect(() => {
    if (!socket || !session) return

    const handleFileUpdate = (data: SocketFileUpdateData) => {
      if (data.userId === session.user.id) {
        console.log('File update received:', data)
        fetchFiles()
        addToast({
          type: 'info',
          title: 'Files Updated',
          message: 'Your file list has been refreshed',
          duration: 3000
        })
      }
    }

    socket.on('file-updated', handleFileUpdate)
    socket.on('file-deleted', handleFileUpdate)
    socket.on('file-shared', handleFileUpdate)

    return () => {
      socket.off('file-updated', handleFileUpdate)
      socket.off('file-deleted', handleFileUpdate)
      socket.off('file-shared', handleFileUpdate)
    }
  }, [socket, session, fetchFiles, addToast])

  // Utility functions
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

  // Filtered and sorted files
  const filteredAndSortedFiles = useMemo(() => {
    return files
      .filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             file.originalName.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesType = filterType === "all" ||
                           (filterType === "encrypted" && file.encrypted) ||
                           (filterType === "documents" && (file.type.includes("document") || file.type.includes("pdf"))) ||
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
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            break
        }
        return sortOrder === "asc" ? comparison : -comparison
      })
  }, [files, searchQuery, filterType, sortBy, sortOrder])

  // File actions
  const handleDownload = async (file: ManagedFile) => {
    if (file.encrypted) {
      addToast({
        type: 'warning',
        title: 'Encrypted File',
        message: 'Encrypted files require decryption key to download',
        duration: 4000
      })
      return
    }

    addToQueue({
      id: `download-${file.id}-${Date.now()}`,
      fileId: file.id,
      name: file.name,
      originalName: file.originalName,
      size: file.size,
      type: file.type,
      url: file.url,
      encrypted: file.encrypted,
      senderEmail: session?.user?.email || '',
      senderName: session?.user?.name || '',
      sharedAt: file.createdAt,
      permissions: 'download',
      priority: 'normal',
      totalBytes: file.size,
      maxRetries: 3
    })

    addToast({
      type: 'success',
      title: 'Download Started',
      message: `${file.name} has been added to download queue`,
      duration: 3000
    })
  }

  const handlePreview = async (file: ManagedFile) => {
    setPreviewFile(file)
    setShowPreview(true)
  }

  const handleShare = async (file: ManagedFile) => {
    window.location.href = `/sharing?file=${file.id}`
  }

  const handleDelete = async (file: ManagedFile) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      setActionLoading(file.id)
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      setFiles(prev => prev.filter(f => f.id !== file.id))
      setStats(prev => prev ? {
        ...prev,
        totalFiles: prev.totalFiles - 1,
        totalSize: prev.totalSize - file.size
      } : null)

      addToast({
        type: 'success',
        title: 'File Deleted',
        message: `"${file.name}" has been deleted successfully`,
        duration: 4000
      })
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

  // Bulk operations
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

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedFiles.size} files? This action cannot be undone.`)) {
      return
    }

    try {
      setActionLoading("bulk-delete")
      const deletePromises = Array.from(selectedFiles).map(fileId =>
        fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      )

      await Promise.all(deletePromises)

      setFiles(prev => prev.filter(f => !selectedFiles.has(f.id)))
      setSelectedFiles(new Set())

      addToast({
        type: 'success',
        title: 'Bulk Delete Completed',
        message: `${selectedFiles.size} files deleted successfully`,
        duration: 4000
      })
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loading size="lg" text="Please login to access file manager" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Loading size="lg" text="Loading your files..." />
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
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold">File Manager</h1>
              <ConnectionStatus />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {filteredAndSortedFiles.length} of {files.length} files
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

          {/* Stats Dashboard */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Files</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.totalFiles}</p>
                  </div>
                  <div className="text-3xl">📁</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Size</p>
                    <p className="text-2xl font-bold text-green-600">{formatFileSize(stats.totalSize)}</p>
                  </div>
                  <div className="text-3xl">💾</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Encrypted Files</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.encryptedFiles}</p>
                  </div>
                  <div className="text-3xl">🔒</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Shared Files</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.sharedFiles}</p>
                  </div>
                  <div className="text-3xl">📤</div>
                </div>
              </div>
            </div>
          )}

          {/* Search and Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 mb-4">

              {/* Search */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search files by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                />
              </div>

              {/* Quick Filters */}
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                >
                  <option value="all">All Types</option>
                  <option value="documents">Documents</option>
                  <option value="images">Images</option>
                  <option value="videos">Videos</option>
                  <option value="encrypted">Encrypted</option>
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

                {/* View Mode Toggle */}
                <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 rounded-l-lg ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    ⊞
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 rounded-r-lg ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    ☰
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedFiles.size > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
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
                    onClick={handleBulkDelete}
                    disabled={actionLoading === "bulk-delete"}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                  >
                    {actionLoading === "bulk-delete" ? "Deleting..." : "Delete Selected"}
                  </button>
                  <a
                    href={`/sharing?files=${Array.from(selectedFiles).join(',')}`}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    Share Selected
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* File List */}
          {filteredAndSortedFiles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">
                {searchQuery || filterType !== 'all' ? '🔍' : '📁'}
              </div>
              <h2 className="text-2xl font-semibold mb-4">
                {searchQuery || filterType !== 'all' ? 'No files found' : 'No files uploaded yet'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery || filterType !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Upload your first file to get started.'
                }
              </p>
              <a
                href="/upload"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors inline-flex items-center gap-2 touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Upload Files
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All */}
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

              {/* File Grid/List */}
              {filteredAndSortedFiles.length > 100 ? (
                // Use virtualized list for large datasets
                <VirtualizedFileList
                  files={filteredAndSortedFiles}
                  selectedFiles={selectedFiles}
                  onSelectFile={handleSelectFile}
                  onSelectAll={handleSelectAll}
                  actionLoading={actionLoading}
                  onAccept={() => {}} // Not applicable for owned files
                  onReject={() => {}} // Not applicable for owned files
                  onDownload={handleDownload}
                  onPreview={handlePreview}
                  onDelete={handleDelete}
                  formatFileSize={formatFileSize}
                  formatDate={formatDate}
                  getFileIcon={getFileIcon}
                  itemHeight={viewMode === 'grid' ? 200 : 120}
                  className="min-h-[600px]"
                />
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredAndSortedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${
                        selectedFiles.has(file.id) ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      {/* File Preview */}
                      <div className="aspect-video bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative">
                        {file.type.startsWith('image/') ? (
                          <LazyImage
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-4xl">{getFileIcon(file.type)}</div>
                        )}

                        {/* Selection Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => handleSelectFile(file.id)}
                          className="absolute top-2 right-2 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                        />

                        {/* Encrypted Badge */}
                        {file.encrypted && (
                          <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium">
                            🔒 Encrypted
                          </div>
                        )}
                      </div>

                      {/* File Info */}
                      <div className="p-4">
                        <h3 className="font-semibold truncate mb-1" title={file.name}>
                          {file.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                        </p>

                        {/* Sharing Info */}
                        {file.shares && file.shares.length > 0 && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                            Shared with {file.shares.length} recipient{file.shares.length !== 1 ? 's' : ''}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePreview(file)}
                            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
                          >
                            👁️ View
                          </button>
                          <button
                            onClick={() => handleDownload(file)}
                            disabled={file.encrypted}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-3 py-2 rounded text-sm transition-colors disabled:cursor-not-allowed"
                          >
                            ⬇️ Download
                          </button>
                          <button
                            onClick={() => handleShare(file)}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors"
                          >
                            📤 Share
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-2">
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
                              {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          {file.encrypted && (
                            <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium self-start sm:self-center">
                              🔒 Encrypted
                            </span>
                          )}

                          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handlePreview(file)}
                              disabled={actionLoading === file.id}
                              className="flex-1 sm:flex-none bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
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
                            <button
                              onClick={() => handleDownload(file)}
                              disabled={actionLoading === file.id || file.encrypted}
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
                              onClick={() => handleShare(file)}
                              disabled={actionLoading === file.id}
                              className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
                            >
                              {actionLoading === file.id ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                  <span>Sharing...</span>
                                </div>
                              ) : (
                                "📤 Share"
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
              )}
            </div>
          )}

          {/* Load More */}
          {files.length > 0 && files.length < totalFiles && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchFiles(currentPage + 1, true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors touch-manipulation"
              >
                Load More Files ({totalFiles - files.length} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {showPreview && previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getFileIcon(previewFile.type)}</div>
                <div>
                  <h3 className="font-semibold text-lg truncate max-w-md">{previewFile.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatFileSize(previewFile.size)}
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
                    setShowPreview(false)
                    setPreviewFile(null)
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
              {previewFile.type.startsWith('image/') ? (
                <div className="flex justify-center">
                  <Image
                    src={previewFile.url}
                    alt={previewFile.name}
                    width={800}
                    height={600}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg"
                    unoptimized // Since these are user-uploaded files
                  />
                </div>
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
          </div>
        </div>
      )}

      {/* Download Queue */}
      <DownloadQueue />
    </div>
  )
}

export default function FileManager() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <FileManagerContent />
      </ToastProvider>
    </ErrorBoundary>
  )
}