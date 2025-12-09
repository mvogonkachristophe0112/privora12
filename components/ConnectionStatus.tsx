"use client"

import React, { useState, useEffect } from 'react'
import { usePresence } from '@/lib/presence-context'

interface ConnectionStatusProps {
  className?: string
  showDetails?: boolean
}

export default function ConnectionStatus({ className = "", showDetails = false }: ConnectionStatusProps) {
  const { isConnected, socket } = usePresence()
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('offline')
  const [lastPing, setLastPing] = useState<number | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!socket) return

    const checkConnectionQuality = () => {
      const startTime = Date.now()

      // Simple ping check
      socket.emit('ping', () => {
        const pingTime = Date.now() - startTime
        setLastPing(pingTime)

        if (pingTime < 100) {
          setConnectionQuality('excellent')
        } else if (pingTime < 300) {
          setConnectionQuality('good')
        } else {
          setConnectionQuality('poor')
        }
        setRetryCount(0)
      })
    }

    // Check connection quality every 30 seconds
    const interval = setInterval(checkConnectionQuality, 30000)

    // Initial check
    checkConnectionQuality()

    // Handle connection events
    const handleConnect = () => {
      setConnectionQuality('good')
      setRetryCount(0)
    }

    const handleDisconnect = () => {
      setConnectionQuality('offline')
    }

    const handleReconnectAttempt = () => {
      setRetryCount(prev => prev + 1)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('reconnect_attempt', handleReconnectAttempt)

    return () => {
      clearInterval(interval)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('reconnect_attempt', handleReconnectAttempt)
    }
  }, [socket])

  const getStatusInfo = () => {
    if (!isConnected || connectionQuality === 'offline') {
      return {
        status: 'offline',
        text: 'Offline',
        color: 'text-gray-500',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        dotColor: 'bg-gray-400',
        icon: '🔴',
        description: retryCount > 0 ? `Reconnecting... (${retryCount})` : 'No connection'
      }
    }

    switch (connectionQuality) {
      case 'excellent':
        return {
          status: 'excellent',
          text: 'Excellent',
          color: 'text-green-600',
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          dotColor: 'bg-green-500',
          icon: '🟢',
          description: lastPing ? `${lastPing}ms` : 'Connected'
        }
      case 'good':
        return {
          status: 'good',
          text: 'Good',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100 dark:bg-blue-900/20',
          dotColor: 'bg-blue-500',
          icon: '🟡',
          description: lastPing ? `${lastPing}ms` : 'Connected'
        }
      case 'poor':
        return {
          status: 'poor',
          text: 'Poor',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100 dark:bg-orange-900/20',
          dotColor: 'bg-orange-500',
          icon: '🟠',
          description: lastPing ? `${lastPing}ms` : 'Slow connection'
        }
      default:
        return {
          status: 'unknown',
          text: 'Unknown',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          dotColor: 'bg-gray-400',
          icon: '⚪',
          description: 'Checking...'
        }
    }
  }

  const statusInfo = getStatusInfo()

  if (!showDetails) {
    // Simple status indicator
    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${statusInfo.bgColor} ${statusInfo.color} ${className}`}>
        <div className={`w-2 h-2 rounded-full ${statusInfo.dotColor} animate-pulse`}></div>
        <span className="hidden sm:inline">{statusInfo.text}</span>
        <span className="sm:hidden">{statusInfo.icon}</span>
      </div>
    )
  }

  // Detailed status display
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-white">Connection Status</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${statusInfo.bgColor} ${statusInfo.color}`}>
          <div className={`w-2 h-2 rounded-full ${statusInfo.dotColor} ${isConnected ? 'animate-pulse' : ''}`}></div>
          <span>{statusInfo.text}</span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span>Status:</span>
          <span className={statusInfo.color}>{statusInfo.description}</span>
        </div>

        {lastPing && (
          <div className="flex justify-between">
            <span>Ping:</span>
            <span>{lastPing}ms</span>
          </div>
        )}

        {retryCount > 0 && (
          <div className="flex justify-between">
            <span>Reconnect attempts:</span>
            <span className="text-orange-600">{retryCount}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Real-time updates:</span>
          <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
            {isConnected ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {!isConnected && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Limited functionality:</strong> Real-time updates are disabled. File changes may not appear automatically.
          </p>
        </div>
      )}
    </div>
  )
}

// Hook for accessing connection status in components
export function useConnectionStatus() {
  const { isConnected, socket } = usePresence()
  const [quality, setQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('offline')

  useEffect(() => {
    if (!socket || !isConnected) {
      setQuality('offline')
      return
    }

    const checkQuality = () => {
      const startTime = Date.now()
      socket.emit('ping', () => {
        const pingTime = Date.now() - startTime
        if (pingTime < 100) setQuality('excellent')
        else if (pingTime < 300) setQuality('good')
        else setQuality('poor')
      })
    }

    checkQuality()
    const interval = setInterval(checkQuality, 30000)

    return () => clearInterval(interval)
  }, [socket, isConnected])

  return {
    isConnected,
    quality,
    isOnline: isConnected && quality !== 'offline'
  }
}