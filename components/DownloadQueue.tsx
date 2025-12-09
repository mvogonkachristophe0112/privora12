"use client"

import React, { useState } from 'react'
import { useDownloadManager, DownloadItem } from './DownloadManager'
import { DownloadQueue as DownloadQueueUtil } from '@/lib/downloadQueue'

export default function DownloadQueue() {
  const { state, pauseDownload, resumeDownload, cancelDownload, retryDownload, removeFromQueue, clearCompleted, clearFailed, setMaxConcurrent, pauseAll, resumeAll, getQueueProgress } = useDownloadManager()
  const [isExpanded, setIsExpanded] = useState(false)
  const [maxConcurrentInput, setMaxConcurrentInput] = useState(state.maxConcurrent.toString())

  const queueProgress = getQueueProgress()

  const getStatusColor = (status: DownloadItem['status']) => {
    switch (status) {
      case 'downloading': return 'text-blue-600'
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'paused': return 'text-yellow-600'
      case 'pending': return 'text-gray-600'
      case 'cancelled': return 'text-gray-400'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: DownloadItem['status']) => {
    switch (status) {
      case 'downloading': return '⬇️'
      case 'completed': return '✅'
      case 'failed': return '❌'
      case 'paused': return '⏸️'
      case 'pending': return '⏳'
      case 'cancelled': return '🚫'
      default: return '❓'
    }
  }

  const handleMaxConcurrentChange = () => {
    const value = parseInt(maxConcurrentInput)
    if (value > 0 && value <= 10) {
      setMaxConcurrent(value)
    } else {
      setMaxConcurrentInput(state.maxConcurrent.toString())
    }
  }

  const renderDownloadItem = (item: DownloadItem, showActions = true) => (
    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-lg">{getStatusIcon(item.status)}</span>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium truncate text-sm">{item.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {DownloadQueueUtil.formatBytes(item.downloadedBytes)} / {DownloadQueueUtil.formatBytes(item.totalBytes)}
              {item.speed > 0 && (
                <span className="ml-2">• {DownloadQueueUtil.formatSpeed(item.speed)}</span>
              )}
              {item.eta > 0 && (
                <span className="ml-2">• {DownloadQueueUtil.formatETA(item.eta)} left</span>
              )}
            </p>
          </div>
        </div>
        {showActions && (
          <div className="flex items-center gap-1 ml-2">
            {item.status === 'downloading' && (
              <button
                onClick={() => pauseDownload(item.id)}
                className="p-1 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
                title="Pause download"
              >
                ⏸️
              </button>
            )}
            {item.status === 'paused' && (
              <button
                onClick={() => resumeDownload(item.id)}
                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                title="Resume download"
              >
                ▶️
              </button>
            )}
            {item.status === 'failed' && item.retryCount < item.maxRetries && (
              <button
                onClick={() => retryDownload(item.id)}
                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                title="Retry download"
              >
                🔄
              </button>
            )}
            {(item.status === 'pending' || item.status === 'paused' || item.status === 'failed') && (
              <button
                onClick={() => cancelDownload(item.id)}
                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                title="Cancel download"
              >
                ❌
              </button>
            )}
            {item.status === 'pending' && (
              <button
                onClick={() => removeFromQueue(item.id)}
                className="p-1 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded"
                title="Remove from queue"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${item.progress}%` }}
        />
      </div>

      {/* Error message */}
      {item.error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{item.error}</p>
      )}

      {/* Priority indicator */}
      {item.priority !== 'normal' && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
            {item.priority} priority
          </span>
        </div>
      )}
    </div>
  )

  const hasActiveDownloads = state.activeDownloads.length > 0 || state.queue.length > 0
  const totalItems = state.queue.length + state.activeDownloads.length + state.completedDownloads.length + state.failedDownloads.length

  if (totalItems === 0) {
    return null // Don't show if no downloads
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 min-w-[400px] max-w-[500px]">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">⬇️</div>
            <div>
              <h3 className="font-semibold text-sm">Download Manager</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {state.activeDownloads.length} active • {state.queue.length} queued • {queueProgress.completed}/{queueProgress.total} completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Overall progress */}
            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className="bg-green-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${queueProgress.percentage}%` }}
              />
            </div>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              {isExpanded ? '▼' : '▲'}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 dark:text-gray-400">Max concurrent:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxConcurrentInput}
                onChange={(e) => setMaxConcurrentInput(e.target.value)}
                onBlur={handleMaxConcurrentChange}
                onKeyPress={(e) => e.key === 'Enter' && handleMaxConcurrentChange()}
                className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div className="flex items-center gap-1">
              {state.isPaused ? (
                <button
                  onClick={resumeAll}
                  className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                >
                  Resume All
                </button>
              ) : (
                <button
                  onClick={pauseAll}
                  className="px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                >
                  Pause All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable content */}
        {isExpanded && (
          <div className="max-h-96 overflow-y-auto">
            {/* Active Downloads */}
            {state.activeDownloads.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Active Downloads ({state.activeDownloads.length})
                </h4>
                <div className="space-y-3">
                  {state.activeDownloads.map(item => renderDownloadItem(item))}
                </div>
              </div>
            )}

            {/* Queue */}
            {state.queue.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  Queue ({state.queue.length})
                </h4>
                <div className="space-y-3">
                  {state.queue.map(item => renderDownloadItem(item))}
                </div>
              </div>
            )}

            {/* Completed */}
            {state.completedDownloads.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <span className="text-green-500">✅</span>
                    Completed ({state.completedDownloads.length})
                  </h4>
                  <button
                    onClick={clearCompleted}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {state.completedDownloads.slice(0, 5).map(item => renderDownloadItem(item, false))}
                  {state.completedDownloads.length > 5 && (
                    <p className="text-xs text-gray-500 text-center">
                      ... and {state.completedDownloads.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Failed */}
            {state.failedDownloads.length > 0 && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <span className="text-red-500">❌</span>
                    Failed ({state.failedDownloads.length})
                  </h4>
                  <button
                    onClick={clearFailed}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {state.failedDownloads.slice(0, 3).map(item => renderDownloadItem(item, true))}
                  {state.failedDownloads.length > 3 && (
                    <p className="text-xs text-gray-500 text-center">
                      ... and {state.failedDownloads.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}