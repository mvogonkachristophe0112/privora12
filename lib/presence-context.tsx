"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'

interface UserPresence {
  isOnline: boolean
  lastSeen: Date
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface PresenceContextType {
  userPresence: Record<string, UserPresence>
  socket: Socket | null
  isConnected: boolean
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [userPresence, setUserPresence] = useState<Record<string, UserPresence>>({})
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      // Clean up socket connection when user logs out
      if (socket) {
        socket.emit('user-offline', session?.user?.id)
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // Initialize Socket.io connection for authenticated users
    const socketConnection = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      path: '/api/socket',
    })

    socketConnection.on('connect', () => {
      console.log('Presence: Connected to Socket.io server')
      setIsConnected(true)
      // Mark user as online when socket connects
      socketConnection.emit('user-online', session.user.id)
    })

    socketConnection.on('disconnect', () => {
      console.log('Presence: Disconnected from Socket.io server')
      setIsConnected(false)
    })

    socketConnection.on('user-status-changed', (data: any) => {
      setUserPresence(prev => ({
        ...prev,
        [data.userId]: {
          isOnline: data.isOnline,
          lastSeen: new Date(data.lastSeen),
          user: prev[data.userId]?.user || { id: data.userId, name: null, email: data.userId },
        },
      }))
    })

    socketConnection.on('connection-request', () => {
      // Handle connection requests - could trigger notifications
      console.log('Presence: Connection request received')
    })

    socketConnection.on('connection-accepted', () => {
      // Handle accepted connections
      console.log('Presence: Connection accepted')
    })

    setSocket(socketConnection)

    // Cleanup on unmount or session change
    return () => {
      socketConnection.emit('user-offline', session.user.id)
      socketConnection.disconnect()
      setSocket(null)
      setIsConnected(false)
    }
  }, [session, status])

  // Fetch initial presence data
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      const fetchPresenceData = async () => {
        try {
          const response = await fetch('/api/presence')
          if (response.ok) {
            const presenceData = await response.json()
            setUserPresence(presenceData)
          }
        } catch (error) {
          console.error('Presence: Failed to fetch presence data:', error)
        }
      }

      fetchPresenceData()
    }
  }, [session, status])

  const value: PresenceContextType = {
    userPresence,
    socket,
    isConnected,
  }

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  const context = useContext(PresenceContext)
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider')
  }
  return context
}

// Hook for getting a specific user's presence status
export function useUserPresence(email: string) {
  const { userPresence } = usePresence()

  const presence = userPresence[email]
  if (presence?.isOnline) {
    return { status: 'online', text: 'Online', color: 'text-green-600', dotColor: 'bg-green-500' }
  } else if (presence) {
    const lastSeen = new Date(presence.lastSeen)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60))

    if (diffMinutes < 1) return { status: 'away', text: 'Just now', color: 'text-gray-500', dotColor: 'bg-gray-400' }
    if (diffMinutes < 60) return { status: 'away', text: `${diffMinutes}m ago`, color: 'text-gray-500', dotColor: 'bg-gray-400' }

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return { status: 'away', text: `${diffHours}h ago`, color: 'text-gray-500', dotColor: 'bg-gray-400' }

    return { status: 'offline', text: lastSeen.toLocaleDateString(), color: 'text-gray-400', dotColor: 'bg-gray-300' }
  }
  return { status: 'offline', text: 'Offline', color: 'text-gray-400', dotColor: 'bg-gray-300' }
}