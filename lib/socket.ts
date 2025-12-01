import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { getPrismaClient } from './prisma'

export type NextApiResponseServerIo = NextApiResponse & {
  socket: any & {
    server: NetServer & {
      io: ServerIO
    }
  }
}

export const initSocket = (httpServer: NetServer) => {
  const io = new ServerIO(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  // Store online users
  const onlineUsers = new Map<string, string>() // userId -> socketId

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    socket.on('user-online', async (data: { userId: string; deviceType: string; user: any }) => {
      try {
        const prisma = await getPrismaClient()

        // Update user presence in database
        await prisma.userPresence.upsert({
          where: { userId: data.userId },
          update: {
            isOnline: true,
            lastSeen: new Date(),
            socketId: socket.id,
            deviceType: data.deviceType,
          },
          create: {
            userId: data.userId,
            isOnline: true,
            socketId: socket.id,
            deviceType: data.deviceType,
          },
        })

        // Store in memory
        onlineUsers.set(data.userId, socket.id)

        // Broadcast user online status with device info
        socket.broadcast.emit('user-status-changed', {
          userId: data.userId,
          isOnline: true,
          lastSeen: new Date(),
          deviceType: data.deviceType,
          user: data.user,
        })

        console.log(`User ${data.userId} is now online from ${data.deviceType}`)
      } catch (error) {
        console.error('Error setting user online:', error)
      }
    })

    socket.on('user-offline', async (data: { userId: string; deviceType: string; lastSeen: Date }) => {
      try {
        const prisma = await getPrismaClient()

        // Update user presence in database
        await prisma.userPresence.upsert({
          where: { userId: data.userId },
          update: {
            isOnline: false,
            lastSeen: data.lastSeen,
            socketId: null,
            deviceType: data.deviceType,
          },
          create: {
            userId: data.userId,
            isOnline: false,
            lastSeen: data.lastSeen,
            socketId: null,
            deviceType: data.deviceType,
          },
        })

        // Remove from memory
        onlineUsers.delete(data.userId)

        // Broadcast user offline status
        socket.broadcast.emit('user-status-changed', {
          userId: data.userId,
          isOnline: false,
          lastSeen: data.lastSeen,
          deviceType: data.deviceType,
        })

        console.log(`User ${data.userId} is now offline from ${data.deviceType}`)
      } catch (error) {
        console.error('Error setting user offline:', error)
      }
    })

    // Handle user activity updates
    socket.on('user-active', async (userId: string) => {
      try {
        const prisma = await getPrismaClient()

        // Update last seen time to show user is active
        await prisma.userPresence.upsert({
          where: { userId },
          update: {
            lastSeen: new Date(),
          },
          create: {
            userId,
            isOnline: true,
            lastSeen: new Date(),
            socketId: socket.id,
          },
        })

        // Broadcast user active status (still online)
        socket.broadcast.emit('user-status-changed', {
          userId,
          isOnline: true,
          lastSeen: new Date(),
        })

        console.log(`User ${userId} is active`)
      } catch (error) {
        console.error('Error updating user activity:', error)
      }
    })

    socket.on('user-away', async (userId: string) => {
      try {
        const prisma = await getPrismaClient()

        // Update last seen time but keep online status
        await prisma.userPresence.upsert({
          where: { userId },
          update: {
            lastSeen: new Date(),
          },
          create: {
            userId,
            isOnline: true,
            lastSeen: new Date(),
            socketId: socket.id,
          },
        })

        // For now, keep them online but update last seen
        // In a more advanced implementation, you could show "away" status
        console.log(`User ${userId} is away`)
      } catch (error) {
        console.error('Error updating user away status:', error)
      }
    })

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id)

      // Find user by socket ID and mark as offline
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          try {
            const prisma = await getPrismaClient()

            // Get current presence to preserve device type
            const currentPresence = await prisma.userPresence.findUnique({
              where: { userId },
            })

            await prisma.userPresence.upsert({
              where: { userId },
              update: {
                isOnline: false,
                lastSeen: new Date(),
                socketId: null,
              },
              create: {
                userId,
                isOnline: false,
                lastSeen: new Date(),
                socketId: null,
                deviceType: currentPresence?.deviceType || 'desktop',
              },
            })

            onlineUsers.delete(userId)

            // Broadcast user offline status
            socket.broadcast.emit('user-status-changed', {
              userId,
              isOnline: false,
              lastSeen: new Date(),
              deviceType: currentPresence?.deviceType || 'desktop',
            })

            console.log(`User ${userId} disconnected and marked offline`)
          } catch (error) {
            console.error('Error handling disconnect:', error)
          }
          break
        }
      }
    })

    // Handle connection requests
    socket.on('request-connection', async (data: { fromUserId: string; toUserEmail: string }) => {
      try {
        const prisma = await getPrismaClient()

        // Create connection request
        await prisma.userConnection.upsert({
          where: {
            userId_connectedTo: {
              userId: data.fromUserId,
              connectedTo: data.toUserEmail,
            },
          },
          update: {
            status: 'pending',
            updatedAt: new Date(),
          },
          create: {
            userId: data.fromUserId,
            connectedTo: data.toUserEmail,
            status: 'pending',
          },
        })

        // Notify the target user if they're online
        const targetPresence = await prisma.userPresence.findUnique({
          where: { userId: data.toUserEmail },
        })

        if (targetPresence?.socketId) {
          io.to(targetPresence.socketId).emit('connection-request', {
            fromUserId: data.fromUserId,
            fromUserEmail: data.toUserEmail,
          })
        }

        console.log(`Connection request from ${data.fromUserId} to ${data.toUserEmail}`)
      } catch (error) {
        console.error('Error creating connection request:', error)
      }
    })

    socket.on('accept-connection', async (data: { userId: string; requesterEmail: string }) => {
      try {
        const prisma = await getPrismaClient()

        // Update connection status
        await prisma.userConnection.updateMany({
          where: {
            userId: data.userId,
            connectedTo: data.requesterEmail,
            status: 'pending',
          },
          data: {
            status: 'accepted',
            updatedAt: new Date(),
          },
        })

        // Also create reverse connection
        await prisma.userConnection.upsert({
          where: {
            userId_connectedTo: {
              userId: data.requesterEmail,
              connectedTo: data.userId,
            },
          },
          update: {
            status: 'accepted',
            updatedAt: new Date(),
          },
          create: {
            userId: data.requesterEmail,
            connectedTo: data.userId,
            status: 'accepted',
          },
        })

        // Notify the requester if they're online
        const requesterPresence = await prisma.userPresence.findUnique({
          where: { userId: data.requesterEmail },
        })

        if (requesterPresence?.socketId) {
          io.to(requesterPresence.socketId).emit('connection-accepted', {
            fromUserId: data.userId,
          })
        }

        console.log(`Connection accepted between ${data.userId} and ${data.requesterEmail}`)
      } catch (error) {
        console.error('Error accepting connection:', error)
      }
    })
  })

  return io
}