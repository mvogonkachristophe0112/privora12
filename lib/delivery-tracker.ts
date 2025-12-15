// Server-side delivery tracker
// Simplified for server-side use only

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

class DeliveryTracker {
  private static instance: DeliveryTracker
  private deliveryStatuses: Map<string, DeliveryStatus> = new Map()

  static getInstance(): DeliveryTracker {
    if (!DeliveryTracker.instance) {
      DeliveryTracker.instance = new DeliveryTracker()
    }
    return DeliveryTracker.instance
  }

  // Get delivery status by delivery ID
  getDeliveryStatus(deliveryId: string): DeliveryStatus | undefined {
    return this.deliveryStatuses.get(deliveryId)
  }

  // Get all deliveries for a specific share ID
  getShareDeliveries(shareId: string): DeliveryStatus[] {
    const deliveries: DeliveryStatus[] = []
    for (const delivery of this.deliveryStatuses.values()) {
      if (delivery.shareId === shareId) {
        deliveries.push(delivery)
      }
    }
    return deliveries
  }

  // Get delivery analytics
  getDeliveryAnalytics({ from, to }: { from: Date; to: Date }) {
    const deliveries = Array.from(this.deliveryStatuses.values())
    const filteredDeliveries = deliveries.filter(delivery =>
      delivery.sentAt && delivery.sentAt >= from && delivery.sentAt <= to
    )

    const totalDeliveries = filteredDeliveries.length
    const deliveredCount = filteredDeliveries.filter(d => d.status === 'delivered').length
    const viewedCount = filteredDeliveries.filter(d => d.status === 'viewed').length
    const downloadedCount = filteredDeliveries.filter(d => d.status === 'downloaded').length
    const failedCount = filteredDeliveries.filter(d => d.status === 'failed').length

    const deliveryTimes = filteredDeliveries
      .filter(d => d.sentAt && d.deliveredAt)
      .map(d => d.deliveredAt!.getTime() - d.sentAt!.getTime())

    const averageDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length
      : 0

    const recentFailures = filteredDeliveries
      .filter(d => d.status === 'failed')
      .sort((a, b) => (b.failedAt?.getTime() || 0) - (a.failedAt?.getTime() || 0))
      .slice(0, 10)

    return {
      totalDeliveries,
      deliveredCount,
      viewedCount,
      downloadedCount,
      failedCount,
      deliveryRate: totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 0,
      averageDeliveryTime,
      recentFailures
    }
  }

  // Mark as delivered (used by API routes)
  markAsDelivered(deliveryId: string): void {
    const delivery = this.deliveryStatuses.get(deliveryId)
    if (delivery) {
      delivery.status = 'delivered'
      delivery.deliveredAt = new Date()
      this.deliveryStatuses.set(deliveryId, delivery)
    }
  }

  // Mark as viewed
  markAsViewed(deliveryId: string): void {
    const delivery = this.deliveryStatuses.get(deliveryId)
    if (delivery) {
      delivery.status = 'viewed'
      delivery.viewedAt = new Date()
      this.deliveryStatuses.set(deliveryId, delivery)
    }
  }

  // Mark as downloaded
  markAsDownloaded(deliveryId: string): void {
    const delivery = this.deliveryStatuses.get(deliveryId)
    if (delivery) {
      delivery.status = 'downloaded'
      delivery.downloadedAt = new Date()
      this.deliveryStatuses.set(deliveryId, delivery)
    }
  }

  // Retry delivery
  async retryDelivery(deliveryId: string): Promise<boolean> {
    const delivery = this.deliveryStatuses.get(deliveryId)
    if (!delivery) {
      return false
    }

    if (delivery.retryCount >= delivery.maxRetries) {
      return false
    }

    delivery.retryCount++
    delivery.status = 'pending'
    delivery.sentAt = new Date()
    this.deliveryStatuses.set(deliveryId, delivery)

    // Here you would implement the actual retry logic
    // For now, we'll just mark it as sent after a delay
    setTimeout(() => {
      const updatedDelivery = this.deliveryStatuses.get(deliveryId)
      if (updatedDelivery && updatedDelivery.status === 'pending') {
        updatedDelivery.status = 'sent'
        this.deliveryStatuses.set(deliveryId, updatedDelivery)
      }
    }, 1000)

    return true
  }

  // Track delivery (used by API routes)
  trackDelivery(delivery: Omit<DeliveryStatus, 'id'>): string {
    const id = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const deliveryStatus: DeliveryStatus = {
      id,
      ...delivery,
      retryCount: 0,
      maxRetries: 3
    }
    this.deliveryStatuses.set(id, deliveryStatus)
    return id
  }
}

// Export singleton instance
export const deliveryTracker = DeliveryTracker.getInstance()