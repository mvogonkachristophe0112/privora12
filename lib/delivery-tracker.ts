"use client"

import { useState, useEffect, useCallback } from 'react'

export interface DeliveryStatus {
  id: string
  shareId: string
  recipientId: string
  recipientEmail: string
  status: 'pending' | 'sent' | 'delivered' | 'viewed' | 'downloaded' | 'failed'
  sentAt?: Date
  deliveredAt?: Date
  viewedAt?: Date
  downloadedAt?: Date
  failedAt?: Date
  failureReason?: string
  retryCount: number
  maxRetries: number
  notificationChannels: ('email' | 'push' | 'sms')[]
  lastNotificationSent?: Date
}

export interface DeliveryAttempt {
  id: string
  deliveryId: string
  channel: 'email' | 'push' | 'sms'
  status: 'pending' | 'sent' | 'failed'
  sentAt?: Date
  failedAt?: Date
  errorMessage?: string
  retryCount: number
}

export interface DeliveryAnalytics {
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
  recentFailures: DeliveryStatus[]
}

class DeliveryTracker {
  private static instance: DeliveryTracker
  private deliveryStatuses: Map<string, DeliveryStatus> = new Map()
  private deliveryAttempts: Map<string, DeliveryAttempt[]> = new Map()
  private listeners: Set<(status: DeliveryStatus) => void> = new Set()

  static getInstance(): DeliveryTracker {
    if (!DeliveryTracker.instance) {
      DeliveryTracker.instance = new DeliveryTracker()
    }
    return DeliveryTracker.instance
  }

  // Track delivery status
  trackDelivery(delivery: Omit<DeliveryStatus, 'id'>): string {
    const id = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const deliveryStatus: DeliveryStatus = {
      id,
      ...delivery,
      retryCount: 0,
      maxRetries: 3
    }

    this.deliveryStatuses.set(id, deliveryStatus)
    this.persistDeliveryStatus(deliveryStatus)

    // Notify listeners
    this.listeners.forEach(listener => listener(deliveryStatus))

    return id
  }

  // Update delivery status
  updateDeliveryStatus(deliveryId: string, updates: Partial<DeliveryStatus>): void {
    const delivery = this.deliveryStatuses.get(deliveryId)
    if (!delivery) return

    const updatedDelivery = { ...delivery, ...updates }
    this.deliveryStatuses.set(deliveryId, updatedDelivery)
    this.persistDeliveryStatus(updatedDelivery)

    // Notify listeners
    this.listeners.forEach(listener => listener(updatedDelivery))
  }

  // Record delivery attempt
  recordDeliveryAttempt(deliveryId: string, attempt: Omit<DeliveryAttempt, 'id' | 'deliveryId'>): void {
    const attempts = this.deliveryAttempts.get(deliveryId) || []
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const deliveryAttempt: DeliveryAttempt = {
      id: attemptId,
      deliveryId,
      ...attempt
    }

    attempts.push(deliveryAttempt)
    this.deliveryAttempts.set(deliveryId, attempts)
    this.persistDeliveryAttempts(deliveryId, attempts)
  }

  // Get delivery status
  getDeliveryStatus(deliveryId: string): DeliveryStatus | undefined {
    return this.deliveryStatuses.get(deliveryId)
  }

  // Get all delivery statuses for a share
  getShareDeliveries(shareId: string): DeliveryStatus[] {
    return Array.from(this.deliveryStatuses.values())
      .filter(delivery => delivery.shareId === shareId)
  }

  // Get delivery attempts
  getDeliveryAttempts(deliveryId: string): DeliveryAttempt[] {
    return this.deliveryAttempts.get(deliveryId) || []
  }

  // Retry failed delivery
  async retryDelivery(deliveryId: string): Promise<boolean> {
    const delivery = this.deliveryStatuses.get(deliveryId)
    if (!delivery || delivery.retryCount >= delivery.maxRetries) {
      return false
    }

    // Update retry count
    this.updateDeliveryStatus(deliveryId, {
      retryCount: delivery.retryCount + 1,
      status: 'pending'
    })

    try {
      // Attempt delivery through available channels
      const success = await this.attemptDelivery(delivery)
      if (success) {
        this.updateDeliveryStatus(deliveryId, {
          status: 'sent',
          sentAt: new Date()
        })
        return true
      } else {
        this.updateDeliveryStatus(deliveryId, {
          status: 'failed',
          failedAt: new Date(),
          failureReason: 'All delivery channels failed'
        })
        return false
      }
    } catch (error) {
      this.updateDeliveryStatus(deliveryId, {
        status: 'failed',
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  // Attempt delivery through available channels
  private async attemptDelivery(delivery: DeliveryStatus): Promise<boolean> {
    for (const channel of delivery.notificationChannels) {
      try {
        const success = await this.sendNotification(delivery, channel)
        if (success) {
          this.recordDeliveryAttempt(delivery.id, {
            channel,
            status: 'sent',
            sentAt: new Date(),
            retryCount: delivery.retryCount
          })
          return true
        } else {
          this.recordDeliveryAttempt(delivery.id, {
            channel,
            status: 'failed',
            failedAt: new Date(),
            errorMessage: `Failed to send via ${channel}`,
            retryCount: delivery.retryCount
          })
        }
      } catch (error) {
        this.recordDeliveryAttempt(delivery.id, {
          channel,
          status: 'failed',
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          retryCount: delivery.retryCount
        })
      }
    }
    return false
  }

  // Send notification via specific channel
  private async sendNotification(delivery: DeliveryStatus, channel: 'email' | 'push' | 'sms'): Promise<boolean> {
    const payload = {
      deliveryId: delivery.id,
      shareId: delivery.shareId,
      recipientEmail: delivery.recipientEmail,
      channel
    }

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      return response.ok
    } catch (error) {
      console.error(`Failed to send ${channel} notification:`, error)
      return false
    }
  }

  // Mark as delivered (when recipient accesses the file)
  markAsDelivered(deliveryId: string): void {
    this.updateDeliveryStatus(deliveryId, {
      status: 'delivered',
      deliveredAt: new Date()
    })
  }

  // Mark as viewed (when recipient views the file)
  markAsViewed(deliveryId: string): void {
    this.updateDeliveryStatus(deliveryId, {
      status: 'viewed',
      viewedAt: new Date()
    })
  }

  // Mark as downloaded (when recipient downloads the file)
  markAsDownloaded(deliveryId: string): void {
    this.updateDeliveryStatus(deliveryId, {
      status: 'downloaded',
      downloadedAt: new Date()
    })
  }

  // Get delivery analytics
  getDeliveryAnalytics(timeRange: { from: Date, to: Date }): DeliveryAnalytics {
    const deliveries = Array.from(this.deliveryStatuses.values())
      .filter(delivery =>
        delivery.sentAt &&
        delivery.sentAt >= timeRange.from &&
        delivery.sentAt <= timeRange.to
      )

    const successfulDeliveries = deliveries.filter(d => d.status !== 'failed').length
    const failedDeliveries = deliveries.filter(d => d.status === 'failed').length
    const totalShares = deliveries.length

    // Calculate average delivery time
    const deliveredDeliveries = deliveries.filter(d => d.deliveredAt && d.sentAt)
    const totalDeliveryTime = deliveredDeliveries.reduce((sum, d) =>
      sum + (d.deliveredAt!.getTime() - d.sentAt!.getTime()), 0
    )
    const averageDeliveryTime = deliveredDeliveries.length > 0
      ? totalDeliveryTime / deliveredDeliveries.length
      : 0

    // Channel performance
    const channelPerformance = {
      email: { sent: 0, delivered: 0, rate: 0 },
      push: { sent: 0, delivered: 0, rate: 0 },
      sms: { sent: 0, delivered: 0, rate: 0 }
    }

    deliveries.forEach(delivery => {
      delivery.notificationChannels.forEach(channel => {
        channelPerformance[channel].sent++
        if (delivery.status !== 'failed') {
          channelPerformance[channel].delivered++
        }
      })
    })

    // Calculate rates
    Object.keys(channelPerformance).forEach(channel => {
      const perf = channelPerformance[channel as keyof typeof channelPerformance]
      perf.rate = perf.sent > 0 ? (perf.delivered / perf.sent) * 100 : 0
    })

    const recentFailures = deliveries
      .filter(d => d.status === 'failed')
      .sort((a, b) => (b.failedAt?.getTime() || 0) - (a.failedAt?.getTime() || 0))
      .slice(0, 10)

    return {
      totalShares,
      successfulDeliveries,
      failedDeliveries,
      averageDeliveryTime,
      deliveryRate: totalShares > 0 ? (successfulDeliveries / totalShares) * 100 : 0,
      channelPerformance,
      recentFailures
    }
  }

  // Subscribe to delivery status changes
  subscribe(listener: (status: DeliveryStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Persistence methods
  private persistDeliveryStatus(delivery: DeliveryStatus): void {
    try {
      const key = `delivery_status_${delivery.id}`
      localStorage.setItem(key, JSON.stringify({
        ...delivery,
        sentAt: delivery.sentAt?.toISOString(),
        deliveredAt: delivery.deliveredAt?.toISOString(),
        viewedAt: delivery.viewedAt?.toISOString(),
        downloadedAt: delivery.downloadedAt?.toISOString(),
        failedAt: delivery.failedAt?.toISOString(),
        lastNotificationSent: delivery.lastNotificationSent?.toISOString()
      }))
    } catch (error) {
      console.warn('Failed to persist delivery status:', error)
    }
  }

  private persistDeliveryAttempts(deliveryId: string, attempts: DeliveryAttempt[]): void {
    try {
      const key = `delivery_attempts_${deliveryId}`
      localStorage.setItem(key, JSON.stringify(
        attempts.map(attempt => ({
          ...attempt,
          sentAt: attempt.sentAt?.toISOString(),
          failedAt: attempt.failedAt?.toISOString()
        }))
      ))
    } catch (error) {
      console.warn('Failed to persist delivery attempts:', error)
    }
  }

  // Load persisted data
  loadPersistedData(): void {
    try {
      // Load delivery statuses
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('delivery_status_')) {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          const delivery: DeliveryStatus = {
            ...data,
            sentAt: data.sentAt ? new Date(data.sentAt) : undefined,
            deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
            viewedAt: data.viewedAt ? new Date(data.viewedAt) : undefined,
            downloadedAt: data.downloadedAt ? new Date(data.downloadedAt) : undefined,
            failedAt: data.failedAt ? new Date(data.failedAt) : undefined,
            lastNotificationSent: data.lastNotificationSent ? new Date(data.lastNotificationSent) : undefined
          }
          this.deliveryStatuses.set(delivery.id, delivery)
        }
      }

      // Load delivery attempts
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('delivery_attempts_')) {
          const deliveryId = key.replace('delivery_attempts_', '')
          const attempts = JSON.parse(localStorage.getItem(key) || '[]')
          const parsedAttempts: DeliveryAttempt[] = attempts.map((attempt: any) => ({
            ...attempt,
            sentAt: attempt.sentAt ? new Date(attempt.sentAt) : undefined,
            failedAt: attempt.failedAt ? new Date(attempt.failedAt) : undefined
          }))
          this.deliveryAttempts.set(deliveryId, parsedAttempts)
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted delivery data:', error)
    }
  }
}

// Export singleton instance
export const deliveryTracker = DeliveryTracker.getInstance()

// React hook for using delivery tracker
export function useDeliveryTracker() {
  const [, forceUpdate] = useState({})

  useEffect(() => {
    deliveryTracker.loadPersistedData()
  }, [])

  const trackDelivery = useCallback((delivery: Omit<DeliveryStatus, 'id'>) => {
    return deliveryTracker.trackDelivery(delivery)
  }, [])

  const updateDeliveryStatus = useCallback((deliveryId: string, updates: Partial<DeliveryStatus>) => {
    deliveryTracker.updateDeliveryStatus(deliveryId, updates)
    forceUpdate({})
  }, [])

  const getDeliveryStatus = useCallback((deliveryId: string) => {
    return deliveryTracker.getDeliveryStatus(deliveryId)
  }, [])

  const getShareDeliveries = useCallback((shareId: string) => {
    return deliveryTracker.getShareDeliveries(shareId)
  }, [])

  const retryDelivery = useCallback(async (deliveryId: string) => {
    const success = await deliveryTracker.retryDelivery(deliveryId)
    forceUpdate({})
    return success
  }, [])

  const markAsDelivered = useCallback((deliveryId: string) => {
    deliveryTracker.markAsDelivered(deliveryId)
    forceUpdate({})
  }, [])

  const markAsViewed = useCallback((deliveryId: string) => {
    deliveryTracker.markAsViewed(deliveryId)
    forceUpdate({})
  }, [])

  const markAsDownloaded = useCallback((deliveryId: string) => {
    deliveryTracker.markAsDownloaded(deliveryId)
    forceUpdate({})
  }, [])

  const getDeliveryAnalytics = useCallback((timeRange: { from: Date, to: Date }) => {
    return deliveryTracker.getDeliveryAnalytics(timeRange)
  }, [])

  return {
    trackDelivery,
    updateDeliveryStatus,
    getDeliveryStatus,
    getShareDeliveries,
    retryDelivery,
    markAsDelivered,
    markAsViewed,
    markAsDownloaded,
    getDeliveryAnalytics
  }
}