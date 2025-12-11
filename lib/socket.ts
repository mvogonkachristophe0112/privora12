import { Server as NetServer } from 'http'
import { NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'

export type NextApiResponseServerIo = NextApiResponse & {
  socket: any & {
    server: NetServer & {
      io: ServerIO | undefined
    }
  }
}

let io: ServerIO | null = null

export const initSocket = (httpServer: NetServer): ServerIO => {
  io = new ServerIO(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id)

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

    // Handle file sharing notifications
    socket.on('share-file', (data) => {
      console.log('File shared:', data)
      // Notify all connected clients about the new shared file
      socket.broadcast.emit('file-shared', data)
    })

    // Handle advanced sharing events
    socket.on('file-shared', (data) => {
      console.log('Advanced file shared event:', data)
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