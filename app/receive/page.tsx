"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"

interface ReceivedFile {
  id: string
  name: string
  size: number
  type: string
  sender: string
  receivedAt: string
  encrypted: boolean
}

export default function Receive() {
  const { data: session } = useSession()
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data for demonstration - in real app, fetch from API
    const mockFiles: ReceivedFile[] = [
      {
        id: "1",
        name: "project_document.pdf",
        size: 2048576, // 2MB
        type: "application/pdf",
        sender: "Alice Johnson",
        receivedAt: "2024-11-25T10:30:00Z",
        encrypted: true
      },
      {
        id: "2",
        name: "vacation_photos.zip",
        size: 15728640, // 15MB
        type: "application/zip",
        sender: "Bob Smith",
        receivedAt: "2024-11-24T15:45:00Z",
        encrypted: true
      },
      {
        id: "3",
        name: "meeting_notes.docx",
        size: 512000, // 500KB
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sender: "Carol Davis",
        receivedAt: "2024-11-23T09:15:00Z",
        encrypted: false
      }
    ]
    setReceivedFiles(mockFiles)
    setLoading(false)
  }, [])

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Received Files</h1>
            <div className="text-sm text-gray-500">
              {receivedFiles.length} files received
            </div>
          </div>

          {receivedFiles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">📥</div>
              <h2 className="text-2xl font-semibold mb-4">No files received yet</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                When someone shares files with you, they'll appear here.
              </p>
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors">
                Browse Shared Files
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {receivedFiles.map((file) => (
                <div key={file.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{getFileIcon(file.type)}</div>
                      <div>
                        <h3 className="text-lg font-semibold">{file.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          From {file.sender} • {formatFileSize(file.size)} • {formatDate(file.receivedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {file.encrypted && (
                        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium">
                          🔒 Encrypted
                        </span>
                      )}

                      <div className="flex gap-2">
                        <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                          Download
                        </button>
                        <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                          View
                        </button>
                        <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                          Delete
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
    </div>
  )
}