import { Server as NetServer } from 'http'
import { NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { getPrismaClient } from './prisma'

export type NextApiResponseServerIo = NextApiResponse & {
  socket: any & {
    server: NetServer & {
      io: ServerIO | undefined
    }
  }
}

// Store connected users with their IP addresses and socket IDs
interface ConnectedUser {
  userId: string
  email: string
  socketId: string
  ipAddress: string
  connectedAt: Date
  lastActivity: Date
}

const connectedUsers = new Map<string, ConnectedUser[]>()

let io: ServerIO | null = null

// Helper function to check for pending deliveries
async function checkPendingDeliveries(userId: string, socket: any) {
  try {
    const prisma = await getPrismaClient()

    // Find pending file shares for this user
    const pendingShares = await prisma.fileShare.findMany({
      where: {
        sharedWithEmail: {
          equals: await getUserEmail(userId)
        },
        status: 'pending',
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        file: true
      }
    })

    for (const share of pendingShares) {
      console.log('Delivering pending file:', share.id, 'to user:', userId)

      // Emit file-received event to this specific socket
      socket.emit('file-received', {
        shareId: share.id,
        fileId: share.fileId,
        fileName: share.file.originalName || share.file.name,
        fileSize: share.file.size,
        fileType: share.file.type,
        senderEmail: share.createdBy,
        senderName: share.createdBy,
        sharedAt: share.createdAt.toISOString(),
        permissions: share.permissions,
        expiresAt: share.expiresAt?.toISOString(),
        encrypted: share.file.encrypted,
        deliveryStatus: 'delivered'
      })

      // Update delivery status
      await updateDeliveryStatus(share.id, 'delivered')
    }
  } catch (error) {
    console.error('Error checking pending deliveries:', error)
  }
}

// Helper function to get user email
async function getUserEmail(userId: string): Promise<string> {
  const prisma = await getPrismaClient()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  })
  return user?.email || ''
}

// Helper function to update delivery status
async function updateDeliveryStatus(shareId: string, status: string) {
  try {
    const prisma = await getPrismaClient()
    await prisma.fileShare.update({
      where: { id: shareId },
      data: {
        status,
        updatedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Error updating delivery status:', error)
  }
}

// Helper function to get connected sockets for a user
function getUserSockets(userId: string): ConnectedUser[] {
  return connectedUsers.get(userId) || []
}

// Helper function to emit to specific user sockets
function emitToUserSockets(userId: string, event: string, data: any) {
  const userSockets = getUserSockets(userId)
  userSockets.forEach(userSocket => {
    const socket = io?.sockets.sockets.get(userSocket.socketId)
    if (socket) {
      socket.emit(event, data)
    }
  })
}

export const initSocket = (httpServer: NetServer): ServerIO => {
  io = new ServerIO(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', async (socket) => {
    console.log('Socket connected:', socket.id)

    // Extract client IP address
    const clientIP = socket.handshake.address || 'unknown'
    console.log('Client IP:', clientIP)

    // Handle user authentication and IP tracking
    socket.on('register-user', async (data: { userId: string; email: string }) => {
      try {
        const { userId, email } = data
        console.log('Registering user:', userId, email, 'from IP:', clientIP)

        // Check if user exists in database
        const prisma = await getPrismaClient()
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true }
        })

        if (!userExists) {
          console.warn('User not found in database:', userId)
          socket.emit('registration-failed', { reason: 'User not found' })
          return
        }

        // Track user connection
        const userConnections = connectedUsers.get(userId) || []
        const existingConnection = userConnections.find(conn => conn.socketId === socket.id)

        if (!existingConnection) {
          const newConnection: ConnectedUser = {
            userId,
            email,
            socketId: socket.id,
            ipAddress: clientIP,
            connectedAt: new Date(),
            lastActivity: new Date()
          }
          userConnections.push(newConnection)
          connectedUsers.set(userId, userConnections)

          console.log('User registered successfully:', userId, 'Total connections:', userConnections.length)
          socket.emit('registration-success', { message: 'Connected successfully' })

          // Check for pending deliveries
          await checkPendingDeliveries(userId, socket)
        }
      } catch (error) {
        console.error('Error registering user:', error)
        socket.emit('registration-failed', { reason: 'Internal error' })
      }
    })

    // Handle user online/offline status
    socket.on('user-online', (data) => {
      console.log('User online:', data)
      socket.broadcast.emit('user-status-changed', {
        ...data,
        isOnline: true,
      })
    })

    socket.on('user-offline', (data) => {
      console.log('User offline:', data)
      socket.broadcast.emit('user-status-changed', {
        ...data,
        isOnline: false,
      })
    })

    socket.on('user-away', (data) => {
      console.log('User away:', data)
      socket.broadcast.emit('user-status-changed', {
        ...data,
        isOnline: false,
      })
    })

    socket.on('user-active', (data) => {
      console.log('User active:', data)
      socket.broadcast.emit('user-status-changed', {
        ...data,
        isOnline: true,
      })
    })

    // Handle file sharing notifications with targeted delivery
    socket.on('share-file', async (data) => {
      console.log('File shared:', data)

      try {
        const prisma = await getPrismaClient()

        // Find the recipient user
        const recipient = await prisma.user.findFirst({
          where: { email: data.receiverEmail }
        })

        if (!recipient) {
          console.warn('Recipient not found:', data.receiverEmail)
          socket.emit('share-failed', { reason: 'Recipient not found' })
          return
        }

        // Get recipient's connected sockets
        const recipientSockets = getUserSockets(recipient.id)

        if (recipientSockets.length > 0) {
          // Deliver to all recipient's connected devices
          recipientSockets.forEach(userSocket => {
            const targetSocket = io?.sockets.sockets.get(userSocket.socketId)
            if (targetSocket) {
              console.log('Delivering file to socket:', userSocket.socketId, 'IP:', userSocket.ipAddress)
              targetSocket.emit('file-received', {
                ...data,
                deliveryStatus: 'delivered',
                deliveredAt: new Date().toISOString()
              })
            }
          })

          // Update delivery status
          await updateDeliveryStatus(data.shareId, 'delivered')
        } else {
          // No active connections - mark as pending
          console.log('No active connections for recipient, marking as pending')
          await updateDeliveryStatus(data.shareId, 'pending')
        }

        // Notify sender of successful share
        socket.emit('share-success', { shareId: data.shareId })

      } catch (error) {
        console.error('Error handling file share:', error)
        socket.emit('share-failed', { reason: 'Internal error' })
      }
    })

    // Handle advanced sharing events (legacy support)
    socket.on('file-shared', (data) => {
      console.log('Legacy file shared event:', data)
      socket.broadcast.emit('file-shared', data)
    })

    socket.on('file-accessed', (data) => {
      console.log('File accessed:', data)
      socket.broadcast.emit('file-accessed', data)
    })

    socket.on('file-edited', (data) => {
      console.log('File edited:', data)
      socket.broadcast.emit('file-edited', data)
    })

    socket.on('permission-changed', (data) => {
      console.log('Permission changed:', data)
      socket.broadcast.emit('permission-changed', data)
    })

    socket.on('file-version-created', (data) => {
      console.log('File version created:', data)
      socket.broadcast.emit('file-version-created', data)
    })

    socket.on('file-rolled-back', (data) => {
      console.log('File rolled back:', data)
      socket.broadcast.emit('file-rolled-back', data)
    })

    socket.on('group-created', (data) => {
      console.log('Group created:', data)
      socket.broadcast.emit('group-created', data)
    })

    socket.on('group-member-added', (data) => {
      console.log('Group member added:', data)
      socket.broadcast.emit('group-member-added', data)
    })

    // Handle LAN file delivery events
    socket.on('lan-file-delivery', (data) => {
      console.log('LAN file delivery initiated:', data)
      socket.broadcast.emit('lan-file-delivery', data)
    })

    socket.on('lan-delivery-status-update', (data) => {
      console.log('LAN delivery status update:', data)
      socket.broadcast.emit('lan-delivery-status-update', data)
    })

    socket.on('lan-delivery-retry', (data) => {
      console.log('LAN delivery retry:', data)
      socket.broadcast.emit('lan-delivery-retry', data)
    })

    socket.on('lan-delivery-completed', (data) => {
      console.log('LAN delivery completed:', data)
      socket.broadcast.emit('lan-delivery-completed', data)
    })

    socket.on('lan-delivery-failed', (data) => {
      console.log('LAN delivery failed:', data)
      socket.broadcast.emit('lan-delivery-failed', data)
    })

    // Handle connection requests
    socket.on('request-connection', (data) => {
      console.log('Connection requested:', data)
      socket.broadcast.emit('connection-request', data)
    })

    socket.on('accept-connection', (data) => {
      console.log('Connection accepted:', data)
      socket.broadcast.emit('connection-accepted', data)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id)

      // Remove user from connected users
      for (const [userId, userSockets] of connectedUsers.entries()) {
        const filteredSockets = userSockets.filter(conn => conn.socketId !== socket.id)
        if (filteredSockets.length === 0) {
          connectedUsers.delete(userId)
        } else {
          connectedUsers.set(userId, filteredSockets)
        }
      }
    })
  })

  return io
}

// Function to emit events from server-side API routes
export const emitSocketEvent = (event: string, data: any) => {
  if (io) {
    console.log('Emitting socket event:', event, data)
    io.emit(event, data)
  } else {
    console.warn('Socket.io not initialized, cannot emit event:', event)
  }
}

// Function to emit events to specific user
export const emitToUser = (userId: string, event: string, data: any) => {
  const userSockets = getUserSockets(userId)
  let emitted = false

  userSockets.forEach(userSocket => {
    const socket = io?.sockets.sockets.get(userSocket.socketId)
    if (socket) {
      console.log('Emitting to user socket:', userSocket.socketId, event, data)
      socket.emit(event, data)
      emitted = true
    }
  })

  if (!emitted) {
    console.warn('No active sockets found for user:', userId)
  }

  return emitted
}

// Function to get connected users count
export const getConnectedUsersCount = () => {
  return connectedUsers.size
}

// Function to get user connection info
export const getUserConnections = (userId: string) => {
  return connectedUsers.get(userId) || []
}