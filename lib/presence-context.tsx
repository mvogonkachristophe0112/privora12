"use client"

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { supabase } from './supabase'

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
  isConnected: boolean
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [userPresence, setUserPresence] = useState<Record<string, UserPresence>>({})
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
    const heartbeat = setInterval(async () => {
      const now = new Date()
      const timeSinceActivity = now.getTime() - lastActivity.getTime()

      if (session?.user?.id) {
        try {
          if (timeSinceActivity > 30000) {
            // Mark as away
            await fetch('/api/presence', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'away' })
            })
          } else {
            // Mark as active
            await fetch('/api/presence', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'active' })
            })
          }
        } catch (error) {
          console.error('Heartbeat error:', error)
        }
      }
    }, 10000) // Check every 10 seconds

    heartbeatIntervalRef.current = heartbeat

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
    }
  }, [lastActivity, session])

  // Effect to handle user authentication and presence initialization
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      // Clean up when user logs out
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      setIsConnected(false)
      return
    }

    // Only initialize on client side
    if (typeof window === 'undefined') return

    setIsConnected(true)

    // Immediately fetch presence data when user logs in
    const fetchInitialPresence = async () => {
      try {
        const response = await fetch('/api/presence')
        if (response.ok) {
          const presenceData = await response.json()
          setUserPresence(presenceData)
        }
      } catch (error) {
        console.error('Failed to fetch initial presence:', error)
      }
    }

    // Fetch immediately when user logs in
    fetchInitialPresence()

    // Then poll for updates
    const presenceInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/presence')
        if (response.ok) {
          const presenceData = await response.json()
          setUserPresence(presenceData)
        }
      } catch (error) {
        console.error('Failed to fetch presence:', error)
      }
    }, 5000) // Poll every 5 seconds

    // Cleanup on unmount or session change
    return () => {
      clearInterval(presenceInterval)
      setIsConnected(false)
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
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