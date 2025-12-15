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

  // Get delivery status by share ID (used by API routes)
  getDeliveryStatus(shareId: string): DeliveryStatus | undefined {
    return this.deliveryStatuses.get(shareId)
  }

  // Mark as delivered (used by API routes)
  markAsDelivered(shareId: string): void {
    const delivery = this.deliveryStatuses.get(shareId)
    if (delivery) {
      delivery.status = 'delivered'
      delivery.deliveredAt = new Date()
      this.deliveryStatuses.set(shareId, delivery)
    }
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