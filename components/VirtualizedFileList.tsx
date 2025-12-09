"use client"

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

interface VirtualizedFileListProps {
  files: ManagedFile[]
  selectedFiles: Set<string>
  onSelectFile: (fileId: string) => void
  onSelectAll: () => void
  actionLoading: string | null
  onAccept: () => void
  onReject: () => void
  onDownload: (file: ManagedFile) => void
  onPreview: (file: ManagedFile) => void
  onDelete: (file: ManagedFile) => void
  formatFileSize: (bytes: number) => string
  formatDate: (dateString: string) => string
  getFileIcon: (type: string) => string
  itemHeight: number
  className?: string
}

function FileListItem({
  file,
  isSelected,
  onSelect,
  actionLoading,
  onDownload,
  onPreview,
  onDelete,
  formatFileSize,
  formatDate,
  getFileIcon
}: {
  file: ManagedFile
  isSelected: boolean
  onSelect: (fileId: string) => void
  actionLoading: string | null
  onDownload: (file: ManagedFile) => void
  onPreview: (file: ManagedFile) => void
  onDelete: (file: ManagedFile) => void
  formatFileSize: (bytes: number) => string
  formatDate: (dateString: string) => string
  getFileIcon: (type: string) => string
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-xl transition-shadow ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(file.id)}
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
              onClick={() => onPreview(file)}
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
              onClick={() => onDownload(file)}
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
  itemHeight,
  className = ""
}: VirtualizedFileListProps) {
  return (
    <div className={`${className} max-h-[600px] overflow-y-auto space-y-4`}>
      {files.map((file) => {
        const isSelected = selectedFiles.has(file.id)

        return (
          <FileListItem
            key={file.id}
            file={file}
            isSelected={isSelected}
            onSelect={onSelectFile}
            actionLoading={actionLoading}
            onDownload={onDownload}
            onPreview={onPreview}
            onDelete={onDelete}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
            getFileIcon={getFileIcon}
          />
        )
      })}
    </div>
  )
}