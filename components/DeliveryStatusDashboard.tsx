"use client"

import React, { useState, useEffect } from 'react'
import { useDeliveryTracker, DeliveryStatus, DeliveryAnalytics } from '@/lib/delivery-tracker'
import { Loading } from './Loading'

interface DeliveryStatusDashboardProps {
  shareId?: string
  showAnalytics?: boolean
  className?: string
}

export default function DeliveryStatusDashboard({
  shareId,
  showAnalytics = true,
  className = ""
}: DeliveryStatusDashboardProps) {
  const {
    getShareDeliveries,
    getDeliveryAnalytics,
    retryDelivery
  } = useDeliveryTracker()

  const [deliveries, setDeliveries] = useState<DeliveryStatus[]>([])
  const [analytics, setAnalytics] = useState<DeliveryAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  })

  useEffect(() => {
    loadData()
  }, [shareId, timeRange])

  const loadData = async () => {
    setLoading(true)
    try {
      if (shareId) {
        const shareDeliveries = getShareDeliveries(shareId)
        setDeliveries(shareDeliveries)
      } else if (showAnalytics) {
        const analyticsData = getDeliveryAnalytics(timeRange)
        setAnalytics(analyticsData)
        // For analytics view, show recent deliveries
        setDeliveries(analyticsData.recentFailures)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (deliveryId: string) => {
    setRetrying(deliveryId)
    try {
      const success = await retryDelivery(deliveryId)
      if (success) {
        await loadData() // Refresh data
      }
    } finally {
      setRetrying(null)
    }
  }

  const getStatusColor = (status: DeliveryStatus['status']) => {
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

  const getStatusIcon = (status: DeliveryStatus['status']) => {
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

  const formatTime = (date?: Date) => {
    if (!date) return 'Never'
    return date.toLocaleString()
  }

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start || !end) return 'N/A'
    const duration = end.getTime() - start.getTime()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  if (loading) {
    return <Loading text="Loading delivery status..." />
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            📬 Delivery Status
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {shareId ? `Tracking deliveries for share ${shareId}` : 'File delivery analytics and status'}
          </p>
        </div>

        {!shareId && showAnalytics && (
          <div className="flex gap-2">
            <select
              value={timeRange.from.toISOString().split('T')[0]}
              onChange={(e) => setTimeRange(prev => ({
                ...prev,
                from: new Date(e.target.value)
              }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}>
                Last 7 days
              </option>
              <option value={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}>
                Last 30 days
              </option>
              <option value={new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}>
                Last 90 days
              </option>
            </select>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        )}
      </div>

      {/* Analytics Overview */}
      {showAnalytics && analytics && !shareId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Delivery Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {analytics.deliveryRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-3xl">📈</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Delivery Time</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatDuration(new Date(Date.now() - analytics.averageDeliveryTime), new Date())}
                </p>
              </div>
              <div className="text-3xl">⏱️</div>
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
              <div className="text-3xl">⚠️</div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Performance */}
      {showAnalytics && analytics && !shareId && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
            📊 Channel Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(analytics.channelPerformance).map(([channel, perf]) => (
              <div key={channel} className="text-center">
                <div className="text-2xl mb-2">
                  {channel === 'email' ? '📧' : channel === 'push' ? '📱' : '📱'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {channel} Notifications
                </div>
                <div className="text-lg font-semibold text-gray-800 dark:text-white">
                  {perf.rate.toFixed(1)}% success rate
                </div>
                <div className="text-sm text-gray-500">
                  {perf.delivered}/{perf.sent} delivered
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Status Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            📋 Delivery Details
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Delivered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Channels
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {delivery.recipientEmail}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {delivery.id.slice(-8)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                      {getStatusIcon(delivery.status)} {delivery.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(delivery.sentAt)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {delivery.deliveredAt ? (
                      <div>
                        <div>{formatTime(delivery.deliveredAt)}</div>
                        <div className="text-xs text-green-600">
                          {formatDuration(delivery.sentAt, delivery.deliveredAt)}
                        </div>
                      </div>
                    ) : (
                      'Not delivered'
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      {delivery.notificationChannels.map(channel => (
                        <span
                          key={channel}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                          {channel === 'email' ? '📧' : channel === 'push' ? '📱' : '💬'} {channel}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {delivery.status === 'failed' && delivery.retryCount < delivery.maxRetries && (
                      <button
                        onClick={() => handleRetry(delivery.id)}
                        disabled={retrying === delivery.id}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                      >
                        {retrying === delivery.id ? '🔄 Retrying...' : '🔄 Retry'}
                      </button>
                    )}
                    {delivery.failureReason && (
                      <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={delivery.failureReason}>
                        {delivery.failureReason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deliveries.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No deliveries to show
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {shareId ? 'No deliveries found for this share.' : 'Share some files to see delivery status.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}