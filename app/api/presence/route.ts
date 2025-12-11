import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { getAuthOptions } from "@/lib/auth"
import { getPrismaClient } from "@/lib/prisma"
import { emitSocketEvent } from "@/lib/socket"

// GET - Fetch all online users' presence
export async function GET() {
  try {
    const prisma = await getPrismaClient()
    const presenceData = await prisma.userPresence.findMany({
      where: { isOnline: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    // Transform to email-keyed object for easier lookup
    const presenceMap: Record<string, any> = {}
    presenceData.forEach((p: any) => {
      if (p.user) {
        presenceMap[p.user.email] = {
          isOnline: p.isOnline,
          lastSeen: p.lastSeen,
          deviceType: p.deviceType,
          user: p.user
        }
      }
    })

    return NextResponse.json(presenceMap)
  } catch (error) {
    console.error('GET /api/presence error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Set user online
export async function POST(request: NextRequest) {
   try {
     const authOptions = await getAuthOptions()
     const session = await getServerSession(authOptions)
     if (!session?.user?.id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
     }

     const { userId, deviceType, user } = await request.json()
     const prisma = await getPrismaClient()

     // Check if user exists before updating presence (handles database reset scenarios)
     const userExists = await prisma.user.findUnique({
       where: { id: userId },
       select: { id: true }
     })

     if (!userExists) {
       // User doesn't exist in database, return success without updating presence
       return NextResponse.json({
         success: true,
         presence: null,
         message: "User presence not updated - user not found in database"
       })
     }

     // Get client IP address for tracking
     const clientIP = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      '127.0.0.1'

     // Get user agent for device tracking
     const userAgent = request.headers.get('user-agent') || ''

     const presence = await prisma.userPresence.upsert({
       where: { userId },
       update: {
         isOnline: true,
         lastSeen: new Date(),
         deviceType,
         ipAddress: clientIP,
         userAgent,
       },
       create: {
         userId,
         isOnline: true,
         lastSeen: new Date(),
         deviceType,
         ipAddress: clientIP,
         userAgent,
       },
     })

     // Check for pending deliveries that can be retried now that user is online
     try {
       const pendingDeliveries = await prisma.fileDelivery.findMany({
         where: {
           recipientId: userId,
           status: { in: ['PENDING', 'FAILED'] },
           deliveryAttempts: { lt: 3 }, // Less than max retries
           expiresAt: { gt: new Date() }
         },
         include: {
           file: true,
           sender: true
         }
       })

       if (pendingDeliveries.length > 0) {
         console.log(`User ${userId} came online, found ${pendingDeliveries.length} pending deliveries to retry`)

         // Process retries asynchronously (don't block the response)
         setImmediate(async () => {
           for (const delivery of pendingDeliveries) {
             try {
               // Update delivery status to retrying
               await prisma.fileDelivery.update({
                 where: { id: delivery.id },
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
                 maxRetries: 3,
                 retryAt: new Date().toISOString(),
                 triggeredBy: 'user_online'
               })

               // Simulate delivery completion (in a real implementation, this would trigger actual delivery)
               setTimeout(async () => {
                 try {
                   await prisma.fileDelivery.update({
                     where: { id: delivery.id },
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
                     attemptNumber: delivery.deliveryAttempts + 1,
                     triggeredBy: 'user_online'
                   })
                 } catch (completionError) {
                   console.error(`Error completing delivery retry for ${delivery.id}:`, completionError)
                 }
               }, 3000) // 3 second delay to simulate delivery

             } catch (retryError) {
               console.error(`Error retrying delivery ${delivery.id}:`, retryError)
             }
           }
         })
       }
     } catch (deliveryCheckError) {
       console.error('Error checking pending deliveries:', deliveryCheckError)
       // Don't fail the presence update if delivery check fails
     }

     return NextResponse.json({ success: true, presence })
   } catch (error) {
     console.error('POST /api/presence error:', error)
     return NextResponse.json({ error: "Internal server error" }, { status: 500 })
   }
 }

// PATCH - Update user presence (active/away)
export async function PATCH(request: NextRequest) {
   try {
     const authOptions = await getAuthOptions()
     const session = await getServerSession(authOptions)
     if (!session?.user?.id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
     }

     const { status } = await request.json()
     const prisma = await getPrismaClient()

     // Check if user exists before updating presence (handles database reset scenarios)
     const userExists = await prisma.user.findUnique({
       where: { id: session.user.id },
       select: { id: true }
     })

     if (!userExists) {
       // User doesn't exist in database, return success without updating presence
       return NextResponse.json({
         success: true,
         presence: null,
         message: "User presence not updated - user not found in database"
       })
     }

     const presence = await prisma.userPresence.upsert({
       where: { userId: session.user.id },
       update: {
         lastSeen: new Date(),
         // Keep isOnline as true for both active and away
       },
       create: {
         userId: session.user.id,
         isOnline: true,
         lastSeen: new Date(),
         deviceType: 'desktop',
       },
     })


     return NextResponse.json({ success: true, presence })
   } catch (error) {
     console.error('PATCH /api/presence error:', error)
     return NextResponse.json({ error: "Internal server error" }, { status: 500 })
   }
 }

// DELETE - Set user offline
export async function DELETE(request: NextRequest) {
  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, deviceType, lastSeen } = await request.json()
    const prisma = await getPrismaClient()

    // Check if user exists before updating presence (handles database reset scenarios)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!userExists) {
      // User doesn't exist in database, return success without updating presence
      return NextResponse.json({
        success: true,
        presence: null,
        message: "User presence not updated - user not found in database"
      })
    }

    const presence = await prisma.userPresence.upsert({
      where: { userId },
      update: {
        isOnline: false,
        lastSeen: new Date(lastSeen),
        deviceType,
      },
      create: {
        userId,
        isOnline: false,
        lastSeen: new Date(lastSeen),
        deviceType,
      },
    })


    return NextResponse.json({ success: true, presence })
  } catch (error) {
    console.error('DELETE /api/presence error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}