"use client"

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DownloadHistory as DownloadHistoryType } from './DownloadManager'
import { DownloadQueue as DownloadQueueUtil } from '@/lib/downloadQueue'

interface DownloadHistoryProps {
  onReDownload?: (fileId: string, fileName: string) => void
}

export default function DownloadHistory({ onReDownload }: DownloadHistoryProps) {
  const { data: session } = useSession()
  const [history, setHistory] = useState<DownloadHistoryType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchHistory()
  }, [session])

  const fetchHistory = async () => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      const response = await fetch('/api/files/download/history')
      if (!response.ok) {
        throw new Error('Failed to fetch download history')
      }
      const data = await response.json()
      setHistory(data.history || [])
    } catch (err) {
      console.error('Error fetching download history:', err)
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear all download history? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/files/download/history', {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to clear history')
      }
      setHistory([])
    } catch (err) {
      console.error('Error clearing history:', err)
      alert('Failed to clear history')
    }
  }

  const exportHistory = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await fetch(`/api/files/download/history?format=${format}`)
      if (!response.ok) {
        throw new Error('Failed to export history')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `download-history.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting history:', err)
      alert('Failed to export history')
    }
  }

  const deleteHistoryItem = async (id: string) => {
    try {
      const response = await fetch(`/api/files/download/history/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete history item')
      }
      setHistory(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      console.error('Error deleting history item:', err)
      alert('Failed to delete history item')
    }
  }

  const filteredAndSortedHistory = history
    .filter(item => {
      if (filter === 'completed') return item.status === 'completed'
      if (filter === 'failed') return item.status === 'failed'
      return true
    })
    .filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'date':
        default:
          comparison = new Date(a.downloadedAt).getTime() - new Date(b.downloadedAt).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading download history...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-500 mb-4">⚠️</div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchHistory}
          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Download History</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportHistory('csv')}
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={() => exportHistory('json')}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm"
            >
              Export JSON
            </button>
            <button
              onClick={clearHistory}
              disabled={history.length === 0}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white rounded-lg text-sm disabled:cursor-not-allowed"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search downloads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            >
              <option value="all">All Downloads</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split('-')
                setSortBy(sort as typeof sortBy)
                setSortOrder(order as typeof sortOrder)
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
      </div>

      {/* History List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredAndSortedHistory.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium mb-2">No download history</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {history.length === 0
                ? "Your completed downloads will appear here"
                : "No downloads match your current filters"
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedHistory.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="text-lg">
                      {item.status === 'completed' ? '✅' : '❌'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium truncate">{item.name}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{DownloadQueueUtil.formatBytes(item.size)}</span>
                        <span>{new Date(item.downloadedAt).toLocaleDateString()}</span>
                        {item.speed > 0 && (
                          <span>{DownloadQueueUtil.formatSpeed(item.speed)}</span>
                        )}
                        {item.duration > 0 && (
                          <span>{Math.round(item.duration)}s</span>
                        )}
                      </div>
                      {item.error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{item.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {onReDownload && item.status === 'completed' && (
                      <button
                        onClick={() => onReDownload(item.fileId, item.name)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                        title="Download again"
                      >
                        ⬇️
                      </button>
                    )}
                    <button
                      onClick={() => deleteHistoryItem(item.id)}
                      className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete from history"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {history.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              {filteredAndSortedHistory.length} of {history.length} downloads
            </span>
            <div className="flex items-center gap-4">
              <span>
                ✅ {history.filter(h => h.status === 'completed').length} completed
              </span>
              <span>
                ❌ {history.filter(h => h.status === 'failed').length} failed
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}