import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth'
import { getPrismaClient } from '@/lib/prisma'
import { emitSocketEvent } from '@/lib/socket'

export async function POST(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { deliveryId, maxRetries = 3 } = await request.json()

    if (!deliveryId) {
      return NextResponse.json({ error: 'Delivery ID is required' }, { status: 400 })
    }

    // Find the delivery record
    const delivery = await prisma.fileDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        file: true,
        sender: true,
        recipient: true
      }
    })

    if (!delivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    // Check if user is authorized (sender or recipient)
    if (delivery.senderId !== session.user.id && delivery.recipientId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized to retry this delivery' }, { status: 403 })
    }

    // Check if delivery can be retried
    if (delivery.status === 'DELIVERED') {
      return NextResponse.json({ error: 'Delivery already completed' }, { status: 400 })
    }

    if (delivery.deliveryAttempts >= maxRetries) {
      return NextResponse.json({ error: 'Maximum retry attempts exceeded' }, { status: 400 })
    }

    // Check if recipient is online (via presence)
    const recipientPresence = await prisma.userPresence.findUnique({
      where: { userId: delivery.recipientId }
    })

    const isRecipientOnline = recipientPresence?.isOnline &&
                             (new Date().getTime() - new Date(recipientPresence.lastSeen).getTime()) < 5 * 60 * 1000 // 5 minutes

    if (!isRecipientOnline) {
      return NextResponse.json({
        error: 'Recipient is not online. Retry will be attempted when they come online.',
        willRetryLater: true
      }, { status: 202 })
    }

    // Attempt to retry the delivery
    try {
      // Update delivery status to retrying
      await prisma.fileDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'PENDING',
          deliveryAttempts: { increment: 1 },
          lastRetryAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Emit retry event
      emitSocketEvent('lan-delivery-retry', {
        deliveryId: delivery.id,
        fileId: delivery.fileId,
        senderId: delivery.senderId,
        recipientId: delivery.recipientId,
        attemptNumber: delivery.deliveryAttempts + 1,
        maxRetries,
        retryAt: new Date().toISOString()
      })

      // Simulate delivery attempt (in a real implementation, this would trigger the actual delivery)
      // For now, we'll mark as delivered after a short delay to simulate success
      setTimeout(async () => {
        try {
          await prisma.fileDelivery.update({
            where: { id: deliveryId },
            data: {
              status: 'DELIVERED',
              deliveredAt: new Date(),
              updatedAt: new Date()
            }
          })

          emitSocketEvent('lan-delivery-completed', {
            deliveryId: delivery.id,
            fileId: delivery.fileId,
            senderId: delivery.senderId,
            recipientId: delivery.recipientId,
            status: 'delivered',
            deliveredAt: new Date().toISOString(),
            attemptNumber: delivery.deliveryAttempts + 1
          })
        } catch (error) {
          console.error('Error completing delivery retry:', error)
          await prisma.fileDelivery.update({
            where: { id: deliveryId },
            data: {
              status: 'FAILED',
              failureReason: 'Delivery retry failed',
              updatedAt: new Date()
            }
          })

          emitSocketEvent('lan-delivery-failed', {
            deliveryId: delivery.id,
            fileId: delivery.fileId,
            senderId: delivery.senderId,
            recipientId: delivery.recipientId,
            failureReason: 'Delivery retry failed',
            attemptNumber: delivery.deliveryAttempts + 1
          })
        }
      }, 2000) // 2 second delay to simulate delivery

      return NextResponse.json({
        success: true,
        message: 'Delivery retry initiated',
        deliveryId,
        attemptNumber: delivery.deliveryAttempts + 1
      })

    } catch (retryError) {
      console.error('Error initiating delivery retry:', retryError)
      return NextResponse.json({ error: 'Failed to initiate delivery retry' }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in delivery retry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to check retry status and get pending retries
export async function GET(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getPrismaClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || session.user.id

    // Check if user is authorized to view retries for this user
    if (userId !== session.user.id) {
      // Allow admins to view any user's retries
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Get pending deliveries that can be retried
    const pendingRetries = await prisma.fileDelivery.findMany({
      where: {
        OR: [
          { senderId: userId },
          { recipientId: userId }
        ],
        status: { in: ['PENDING', 'FAILED'] },
        deliveryAttempts: { lt: 3 }, // Less than max retries
        expiresAt: { gt: new Date() }
      },
      include: {
        file: {
          select: { id: true, name: true, size: true, type: true }
        },
        sender: {
          select: { id: true, name: true, email: true }
        },
        recipient: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Check recipient online status for each delivery
    const retriesWithStatus = await Promise.all(
      pendingRetries.map(async (delivery: any) => {
        const recipientPresence = await prisma.userPresence.findUnique({
          where: { userId: delivery.recipientId }
        })

        const isRecipientOnline = recipientPresence?.isOnline &&
                                 (new Date().getTime() - new Date(recipientPresence.lastSeen).getTime()) < 5 * 60 * 1000

        return {
          ...delivery,
          recipientOnline: isRecipientOnline,
          canRetry: isRecipientOnline && delivery.deliveryAttempts < 3
        }
      })
    )

    return NextResponse.json({
      pendingRetries: retriesWithStatus,
      totalCount: retriesWithStatus.length
    })

  } catch (error) {
    console.error('Error fetching delivery retries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}