"use client"

import React from 'react'
import { DownloadItem } from './DownloadManager'
import { DownloadQueue as DownloadQueueUtil } from '@/lib/downloadQueue'

interface DownloadProgressProps {
  item: DownloadItem
  showControls?: boolean
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  compact?: boolean
}

export default function DownloadProgress({
  item,
  showControls = true,
  onPause,
  onResume,
  onCancel,
  onRetry,
  compact = false
}: DownloadProgressProps) {
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

  const getProgressBarColor = (status: DownloadItem['status']) => {
    switch (status) {
      case 'downloading': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      case 'pending': return 'bg-gray-400'
      case 'cancelled': return 'bg-gray-300'
      default: return 'bg-gray-400'
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="text-lg">{getStatusIcon(item.status)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate">{item.name}</span>
            <span className={`text-xs ${getStatusColor(item.status)}`}>
              {item.progress.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div
              className={`h-1 rounded-full transition-all duration-300 ${getProgressBarColor(item.status)}`}
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
        {showControls && item.status === 'downloading' && onPause && (
          <button
            onClick={() => onPause(item.id)}
            className="p-1 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
            title="Pause"
          >
            ⏸️
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getStatusIcon(item.status)}</span>
          <div>
            <h3 className="font-semibold text-lg truncate max-w-md">{item.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              From {item.senderName || item.senderEmail}
            </p>
          </div>
        </div>
        {showControls && (
          <div className="flex items-center gap-2">
            {item.status === 'downloading' && onPause && (
              <button
                onClick={() => onPause(item.id)}
                className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors text-sm"
              >
                Pause
              </button>
            )}
            {item.status === 'paused' && onResume && (
              <button
                onClick={() => onResume(item.id)}
                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
              >
                Resume
              </button>
            )}
            {item.status === 'failed' && item.retryCount < item.maxRetries && onRetry && (
              <button
                onClick={() => onRetry(item.id)}
                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
              >
                Retry
              </button>
            )}
            {item.status !== 'completed' && onCancel && (
              <button
                onClick={() => onCancel(item.id)}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
            {item.progress.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getProgressBarColor(item.status)}`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {DownloadQueueUtil.formatBytes(item.downloadedBytes)} / {DownloadQueueUtil.formatBytes(item.totalBytes)}
          </span>
          {item.status === 'downloading' && item.speed > 0 && (
            <span>{DownloadQueueUtil.formatSpeed(item.speed)}</span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {item.status}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {DownloadQueueUtil.formatBytes(item.size)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Size</div>
        </div>
        {item.speed > 0 && (
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {DownloadQueueUtil.formatSpeed(item.speed)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Speed</div>
          </div>
        )}
        {item.eta > 0 && (
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {DownloadQueueUtil.formatETA(item.eta)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">ETA</div>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        {item.startedAt && (
          <div className="flex justify-between">
            <span>Started:</span>
            <span>{item.startedAt.toLocaleTimeString()}</span>
          </div>
        )}
        {item.completedAt && (
          <div className="flex justify-between">
            <span>Completed:</span>
            <span>{item.completedAt.toLocaleTimeString()}</span>
          </div>
        )}
        {item.retryCount > 0 && (
          <div className="flex justify-between">
            <span>Retries:</span>
            <span>{item.retryCount} / {item.maxRetries}</span>
          </div>
        )}
        {item.priority !== 'normal' && (
          <div className="flex justify-between">
            <span>Priority:</span>
            <span className="capitalize">{item.priority}</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {item.error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-sm text-red-800 dark:text-red-200 font-medium">Error</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{item.error}</p>
        </div>
      )}

      {/* Encrypted indicator */}
      {item.encrypted && (
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <span>🔒</span>
          <span>This file is encrypted and will be decrypted during download</span>
        </div>
      )}
    </div>
  )
}