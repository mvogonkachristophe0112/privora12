"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'

interface ReceivedFile {
  id: string
  fileId: string
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

interface VirtualizedFileListProps {
  files: ReceivedFile[]
  selectedFiles: Set<string>
  onSelectFile: (fileId: string) => void
  onSelectAll: () => void
  actionLoading: string | null
  onAccept: (file: ReceivedFile) => void
  onReject: (file: ReceivedFile) => void
  onDownload: (file: ReceivedFile) => void
  onPreview: (file: ReceivedFile) => void
  onDelete: (file: ReceivedFile) => void
  formatFileSize: (bytes: number) => string
  formatDate: (dateString: string) => string
  getFileIcon: (type: string) => string
  itemHeight?: number
  className?: string
}

interface FileListItemProps {
  index: number
  style: React.CSSProperties
  data: {
    files: ReceivedFile[]
    selectedFiles: Set<string>
    onSelectFile: (fileId: string) => void
    actionLoading: string | null
    onAccept: (file: ReceivedFile) => void
    onReject: (file: ReceivedFile) => void
    onDownload: (file: ReceivedFile) => void
    onPreview: (file: ReceivedFile) => void
    onDelete: (file: ReceivedFile) => void
    formatFileSize: (bytes: number) => string
    formatDate: (dateString: string) => string
    getFileIcon: (type: string) => string
  }
}

function FileListItem({ index, style, data }: FileListItemProps) {
  const {
    files,
    selectedFiles,
    onSelectFile,
    actionLoading,
    onAccept,
    onReject,
    onDownload,
    onPreview,
    onDelete,
    formatFileSize,
    formatDate,
    getFileIcon
  } = data

  const file = files[index]

  if (!file) return null

  return (
    <div style={style} className="px-4 py-2">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-xl transition-shadow">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            {/* File Selection Checkbox */}
            <input
              type="checkbox"
              checked={selectedFiles.has(file.id)}
              onChange={() => onSelectFile(file.id)}
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

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {/* Action buttons */}
              <button
                onClick={() => onAccept(file)}
                disabled={actionLoading === file.id}
                className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
              >
                {actionLoading === file.id ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  "✅ Accept"
                )}
              </button>
              <button
                onClick={() => onReject(file)}
                disabled={actionLoading === file.id}
                className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
              >
                {actionLoading === file.id ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  "❌ Reject"
                )}
              </button>

              {file.type.startsWith('image/') && (
                <button
                  onClick={() => onPreview(file)}
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
                onClick={() => onDownload(file)}
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
                onClick={() => onDelete(file)}
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
    </div>
  )
}

export default function VirtualizedFileList({
  files,
  selectedFiles,
  onSelectFile,
  onSelectAll,
  actionLoading,
  onAccept,
  onReject,
  onDownload,
  onPreview,
  onDelete,
  formatFileSize,
  formatDate,
  getFileIcon,
  itemHeight = 140,
  className = ""
}: VirtualizedFileListProps) {
  const listRef = useRef<List>(null)
  const [listHeight, setListHeight] = useState(600)

  // Memoize the item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    files,
    selectedFiles,
    onSelectFile,
    actionLoading,
    onAccept,
    onReject,
    onDownload,
    onPreview,
    onDelete,
    formatFileSize,
    formatDate,
    getFileIcon
  }), [
    files,
    selectedFiles,
    onSelectFile,
    actionLoading,
    onAccept,
    onReject,
    onDownload,
    onPreview,
    onDelete,
    formatFileSize,
    formatDate,
    getFileIcon
  ])

  // Scroll to top when files change significantly
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo(0)
    }
  }, [files.length])

  if (files.length === 0) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">📥</div>
          <h2 className="text-2xl font-semibold mb-4">No files found</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your filters or search query.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Select All Checkbox */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <input
          type="checkbox"
          checked={selectedFiles.size === files.length && files.length > 0}
          onChange={onSelectAll}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Select All ({files.length} files)
        </label>
      </div>

      {/* Virtualized List */}
      <div style={{ height: listHeight }} className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <List
          ref={listRef}
          height={listHeight}
          width="100%"
          itemCount={files.length}
          itemSize={itemHeight}
          itemData={itemData}
          overscanCount={5} // Render 5 extra items outside visible area for smoother scrolling
        >
          {FileListItem}
        </List>
      </div>

      {/* Performance info for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 text-center py-2">
          Rendering {files.length} files with virtual scrolling
        </div>
      )}
    </div>
  )
}