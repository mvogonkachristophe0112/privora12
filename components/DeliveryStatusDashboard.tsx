"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import ConnectionStatus from './ConnectionStatus'
import { Loading } from './Loading'

interface DeliveryAnalytics {
  totalShares: number
  successfulDeliveries: number
  failedDeliveries: number
  averageDeliveryTime: number
  deliveryRate: number
  channelPerformance: {
    email: { sent: number, delivered: number, rate: number }
    push: { sent: number, delivered: number, rate: number }
    sms: { sent: number, delivered: number, rate: number }
  }
  recentFailures: Array<{
    id: string
    shareId: string
    recipientEmail: string
    status: string
    failureReason?: string
    retryCount: number
    sentAt?: string
    failedAt?: string
  }>
}

interface DeliveryStatus {
  id: string
  shareId: string
  recipientId: string
  recipientEmail: string
  status: 'pending' | 'sent' | 'delivered' | 'viewed' | 'downloaded' | 'failed'
  sentAt?: string
  deliveredAt?: string
  viewedAt?: string
  downloadedAt?: string
  failedAt?: string
  failureReason?: string
  retryCount: number
  maxRetries: number
  notificationChannels: ('email' | 'push' | 'sms')[]
  lastNotificationSent?: string
}

interface ShareDeliveryData {
  shareId: string
  file: {
    id: string
    name: string
    originalName: string
    size: number
    type: string
  }
  creator: {
    id: string
    name: string
    email: string
  }
  deliveries: DeliveryStatus[]
  accessLogs: Array<{
    userId: string
    viewedAt: string
  }>
}

export default function DeliveryStatusDashboard() {
  const { data: session } = useSession()
  const [analytics, setAnalytics] = useState<DeliveryAnalytics | null>(null)
  const [selectedShareId, setSelectedShareId] = useState<string>('')
  const [shareData, setShareData] = useState<ShareDeliveryData | null>(null)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)

  // Load delivery analytics
  const loadAnalytics = useCallback(async () => {
    if (!session) return

    setLoading(true)
    try {
      const response = await fetch(`/api/files/delivery?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
      }
    } catch (error) {
      console.error('Failed to load delivery analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [session, timeRange])

  // Load share-specific delivery data
  const loadShareData = useCallback(async (shareId: string) => {
    if (!session || !shareId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/files/delivery?shareId=${shareId}`)
      if (response.ok) {
        const data = await response.json()
        setShareData(data)
      }
    } catch (error) {
      console.error('Failed to load share delivery data:', error)
    } finally {
      setLoading(false)
    }
  }, [session])

  // Retry failed delivery
  const retryDelivery = async (deliveryId: string) => {
    setRetrying(deliveryId)
    try {
      const response = await fetch('/api/files/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'retry_delivery',
          deliveryId
        })
      })

      if (response.ok) {
        // Refresh data
        if (selectedShareId) {
          loadShareData(selectedShareId)
        }
        loadAnalytics()
      }
    } catch (error) {
      console.error('Failed to retry delivery:', error)
    } finally {
      setRetrying(null)
    }
  }

  // Update delivery status
  const updateDeliveryStatus = async (deliveryId: string, action: 'mark_delivered' | 'mark_viewed' | 'mark_downloaded') => {
    try {
      const response = await fetch('/api/files/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          deliveryId
        })
      })

      if (response.ok) {
        // Refresh data
        if (selectedShareId) {
          loadShareData(selectedShareId)
        }
        loadAnalytics()
      }
    } catch (error) {
      console.error('Failed to update delivery status:', error)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  useEffect(() => {
    if (selectedShareId) {
      loadShareData(selectedShareId)
    } else {
      setShareData(null)
    }
  }, [selectedShareId, loadShareData])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-100'
      case 'viewed': return 'text-blue-600 bg-blue-100'
      case 'downloaded': return 'text-purple-600 bg-purple-100'
      case 'sent': return 'text-yellow-600 bg-yellow-100'
      case 'pending': return 'text-gray-600 bg-gray-100'
      case 'failed': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return '✅'
      case 'viewed': return '👁️'
      case 'downloaded': return '⬇️'
      case 'sent': return '📤'
      case 'pending': return '⏳'
      case 'failed': return '❌'
      default: return '❓'
    }
  }

  if (!session) {
    return <div>Please login to view delivery status</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Delivery Status Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor file delivery performance and status
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Time Range:
        </label>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as '24h' | '7d' | '30d')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        <button
          onClick={loadAnalytics}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-lg transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading && <Loading />}

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Shares</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {analytics.totalShares}
                </p>
              </div>
              <div className="text-3xl">📤</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Successful Deliveries</p>
                <p className="text-2xl font-bold text-green-600">
                  {analytics.successfulDeliveries}
                </p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed Deliveries</p>
                <p className="text-2xl font-bold text-red-600">
                  {analytics.failedDeliveries}
                </p>
              </div>
              <div className="text-3xl">❌</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Delivery Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {analytics.deliveryRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Performance */}
      {analytics && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            Channel Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(analytics.channelPerformance).map(([channel, perf]) => (
              <div key={channel} className="text-center">
                <h3 className="font-medium text-gray-700 dark:text-gray-300 capitalize mb-2">
                  {channel}
                </h3>
                <div className="space-y-1 text-sm">
                  <div>Sent: {perf.sent}</div>
                  <div>Delivered: {perf.delivered}</div>
                  <div className="font-medium text-blue-600">
                    Rate: {perf.rate.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Failures */}
      {analytics && analytics.recentFailures.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            Recent Failures
          </h2>
          <div className="space-y-3">
            {analytics.recentFailures.slice(0, 5).map((failure) => (
              <div key={failure.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-800 dark:text-white">
                    {failure.recipientEmail}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {failure.failureReason || 'Unknown error'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Failed: {failure.failedAt ? formatDate(failure.failedAt) : 'Unknown'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Retry: {failure.retryCount}
                  </span>
                  <button
                    onClick={() => retryDelivery(failure.id)}
                    disabled={retrying === failure.id}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-sm rounded transition-colors"
                  >
                    {retrying === failure.id ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share-specific details */}
      {shareData && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Share Details
            </h2>
            <button
              onClick={() => setSelectedShareId('')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-800 dark:text-white mb-2">
              {shareData.file.originalName || shareData.file.name}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Size: {formatFileSize(shareData.file.size)}</div>
              <div>Type: {shareData.file.type}</div>
              <div>Shared by: {shareData.creator.name} ({shareData.creator.email})</div>
            </div>
          </div>

          <h3 className="font-medium text-gray-800 dark:text-white mb-3">
            Delivery Status ({shareData.deliveries.length} recipients)
          </h3>

          <div className="space-y-3">
            {shareData.deliveries.map((delivery) => (
              <div key={delivery.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-800 dark:text-white">
                    {delivery.recipientEmail}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Status: <span className={`px-2 py-1 rounded text-xs ${getStatusColor(delivery.status)}`}>
                      {getStatusIcon(delivery.status)} {delivery.status}
                    </span>
                  </div>
                  {delivery.sentAt && (
                    <div className="text-xs text-gray-500 mt-1">
                      Sent: {formatDate(delivery.sentAt)}
                    </div>
                  )}
                  {delivery.failureReason && (
                    <div className="text-xs text-red-600 mt-1">
                      Error: {delivery.failureReason}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {delivery.status === 'sent' && (
                    <>
                      <button
                        onClick={() => updateDeliveryStatus(delivery.id, 'mark_delivered')}
                        className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                      >
                        Mark Delivered
                      </button>
                      <button
                        onClick={() => updateDeliveryStatus(delivery.id, 'mark_viewed')}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                      >
                        Mark Viewed
                      </button>
                    </>
                  )}
                  {delivery.status === 'delivered' && (
                    <button
                      onClick={() => updateDeliveryStatus(delivery.id, 'mark_downloaded')}
                      className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded transition-colors"
                    >
                      Mark Downloaded
                    </button>
                  )}
                  {delivery.status === 'failed' && (
                    <button
                      onClick={() => retryDelivery(delivery.id)}
                      disabled={retrying === delivery.id}
                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs rounded transition-colors"
                    >
                      {retrying === delivery.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}