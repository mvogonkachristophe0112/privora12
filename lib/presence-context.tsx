"use client"

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'

// Device detection utility
function detectDeviceType(): 'phone' | 'laptop' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'

  const userAgent = navigator.userAgent.toLowerCase()
  const screenWidth = window.screen.width
  const screenHeight = window.screen.height

  // Check for mobile devices
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    // Distinguish between phone and tablet
    if (screenWidth <= 768 && screenHeight <= 1024) {
      return 'phone'
    } else {
      return 'tablet'
    }
  }

  // Check for touch capability (likely tablet or 2-in-1 laptop)
  if ('ontouchstart' in window && screenWidth >= 768) {
    return 'tablet'
  }

  // Check screen size for laptop vs desktop
  if (screenWidth < 1366) {
    return 'laptop'
  }

  return 'desktop'
}

interface UserPresence {
  isOnline: boolean
  lastSeen: Date
  deviceType: 'phone' | 'laptop' | 'tablet' | 'desktop'
  user: {
    id: string
    name: string | null
    email: string
    image?: string | null
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
  const [deviceType, setDeviceType] = useState<'phone' | 'laptop' | 'tablet' | 'desktop'>('desktop')
  const [lastActivity, setLastActivity] = useState<Date>(new Date())
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize device type detection (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDeviceType(detectDeviceType())
    }
  }, [])

  // Activity tracking for automatic offline detection (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateActivity = () => {
      setLastActivity(new Date())
    }

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    // Heartbeat to keep user online
    const heartbeat = setInterval(() => {
      const now = new Date()
      const timeSinceActivity = now.getTime() - lastActivity.getTime()

      // If inactive for more than 30 seconds, mark as away/offline
      if (timeSinceActivity > 30000 && socket && session?.user?.id) {
        socket.emit('user-away', session.user.id)
      } else if (timeSinceActivity <= 30000 && socket && session?.user?.id) {
        socket.emit('user-active', session.user.id)
      }
    }, 10000) // Check every 10 seconds

    heartbeatIntervalRef.current = heartbeat

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
    }
  }, [lastActivity, socket, session])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      // Clean up socket connection when user logs out
      if (socket) {
        socket.emit('user-offline', {
          userId: session?.user?.id,
          deviceType,
          lastSeen: new Date()
        })
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // Only initialize Socket.io on client side
    if (typeof window === 'undefined') return

    // Initialize Socket.io connection for authenticated users
    const socketConnection = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      path: '/api/socket',
    })

    socketConnection.on('connect', () => {
      console.log('Presence: Connected to Socket.io server')
      setIsConnected(true)
      // Mark user as online when socket connects
      socketConnection.emit('user-online', {
        userId: session.user.id,
        deviceType,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        }
      })
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
          deviceType: data.deviceType || 'desktop',
          user: {
            id: data.userId,
            name: data.user?.name || null,
            email: data.user?.email || data.userId,
            image: data.user?.image || null
          },
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
      socketConnection.emit('user-offline', {
        userId: session.user.id,
        deviceType,
        lastSeen: new Date()
      })
      socketConnection.disconnect()
      setSocket(null)
      setIsConnected(false)
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }
  }, [session, status, deviceType])

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
    return {
      status: 'online',
      text: 'Online',
      color: 'text-green-600',
      dotColor: 'bg-green-500',
      deviceType: presence.deviceType,
      lastSeen: presence.lastSeen
    }
  } else if (presence) {
    const lastSeen = new Date(presence.lastSeen)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60))

    if (diffMinutes < 1) {
      return {
        status: 'away',
        text: 'Last seen just now',
        color: 'text-gray-500',
        dotColor: 'bg-gray-400',
        deviceType: presence.deviceType,
        lastSeen: presence.lastSeen
      }
    }
    if (diffMinutes < 60) {
      return {
        status: 'away',
        text: `Last seen ${diffMinutes}m ago`,
        color: 'text-gray-500',
        dotColor: 'bg-gray-400',
        deviceType: presence.deviceType,
        lastSeen: presence.lastSeen
      }
    }

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) {
      return {
        status: 'away',
        text: `Last seen ${diffHours}h ago`,
        color: 'text-gray-500',
        dotColor: 'bg-gray-400',
        deviceType: presence.deviceType,
        lastSeen: presence.lastSeen
      }
    }

    return {
      status: 'offline',
      text: `Last seen ${lastSeen.toLocaleDateString()}`,
      color: 'text-gray-400',
      dotColor: 'bg-gray-300',
      deviceType: presence.deviceType,
      lastSeen: presence.lastSeen
    }
  }
  return {
    status: 'offline',
    text: 'Offline',
    color: 'text-gray-400',
    dotColor: 'bg-gray-300',
    deviceType: 'desktop' as const,
    lastSeen: new Date()
  }
}