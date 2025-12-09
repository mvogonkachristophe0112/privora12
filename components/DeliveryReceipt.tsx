"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeliveryResult {
  shareId: string
  recipientEmail: string
  recipientName?: string
  status: 'success' | 'failed' | 'pending'
  deliveryId?: string
  errorMessage?: string
  notificationChannels: ('email' | 'push' | 'sms')[]
}

interface DeliveryReceiptProps {
  isOpen: boolean
  onClose: () => void
  fileName: string
  fileSize: number
  totalRecipients: number
  successfulDeliveries: number
  failedDeliveries: number
  deliveryResults: DeliveryResult[]
  shareUrl?: string
  onViewStatus?: () => void
}

export default function DeliveryReceipt({
  isOpen,
  onClose,
  fileName,
  fileSize,
  totalRecipients,
  successfulDeliveries,
  failedDeliveries,
  deliveryResults,
  shareUrl,
  onViewStatus
}: DeliveryReceiptProps) {
  const router = useRouter()
  const [copiedUrl, setCopiedUrl] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const copyShareUrl = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } catch (error) {
        console.error('Failed to copy URL:', error)
      }
    }
  }

  const getStatusIcon = (status: DeliveryResult['status']) => {
    switch (status) {
      case 'success': return '✅'
      case 'failed': return '❌'
      case 'pending': return '⏳'
      default: return '❓'
    }
  }

  const getStatusColor = (status: DeliveryResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100 dark:bg-green-900/20'
      case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900/20'
      case 'pending': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700'
    }
  }

  const getDeliveryRate = () => {
    if (totalRecipients === 0) return 0
    return Math.round((successfulDeliveries / totalRecipients) * 100)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">📤</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                File Shared Successfully
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your file has been shared with {totalRecipients} recipient{totalRecipients !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {/* File Info */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📄</span>
              <div>
                <h3 className="font-medium text-gray-800 dark:text-white">{fileName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatFileSize(fileSize)}
                </p>
              </div>
            </div>
          </div>

          {/* Delivery Summary */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 dark:text-white mb-4">Delivery Summary</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1">{totalRecipients}</div>
                <div className="text-sm text-blue-800 dark:text-blue-200">Total Recipients</div>
              </div>

              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">{successfulDeliveries}</div>
                <div className="text-sm text-green-800 dark:text-green-200">Successful</div>
              </div>

              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600 mb-1">{failedDeliveries}</div>
                <div className="text-sm text-red-800 dark:text-red-200">Failed</div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                <span className="text-sm font-medium">Delivery Rate:</span>
                <span className={`font-bold ${
                  getDeliveryRate() >= 80 ? 'text-green-600' :
                  getDeliveryRate() >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {getDeliveryRate()}%
                </span>
              </div>
            </div>
          </div>

          {/* Share URL */}
          {shareUrl && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 dark:text-white mb-2">Share Link</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <button
                  onClick={copyShareUrl}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {copiedUrl ? '✅' : '📋'}
                  {copiedUrl ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Delivery Results */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 dark:text-white mb-3">Delivery Details</h3>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {deliveryResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${getStatusColor(result.status)} px-2 py-1 rounded`}>
                      {getStatusIcon(result.status)}
                    </span>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white">
                        {result.recipientName || result.recipientEmail}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {result.recipientEmail}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {result.notificationChannels.map(channel => (
                      <span
                        key={channel}
                        className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded"
                        title={`Notified via ${channel}`}
                      >
                        {channel === 'email' ? '📧' : channel === 'push' ? '📱' : '💬'}
                      </span>
                    ))}

                    {result.status === 'failed' && result.errorMessage && (
                      <span
                        className="text-xs text-red-600 bg-red-100 dark:bg-red-900/20 px-2 py-1 rounded"
                        title={result.errorMessage}
                      >
                        Error
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {onViewStatus && (
              <button
                onClick={onViewStatus}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                📊 View Delivery Status
              </button>
            )}

            <button
              onClick={() => router.push('/upload')}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              📤 Share Another File
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Recipients will receive notifications via email and can access the file immediately.
            </div>
            <button
              onClick={onClose}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}