"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  _count: {
    files: number
    sharedFiles: number
  }
}

interface UserPresence {
  isOnline: boolean
  lastSeen: Date
  deviceType: string
  user: User
}

export function useUserDetection() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [userPresence, setUserPresence] = useState<Record<string, UserPresence>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUsers, setNewUsers] = useState<User[]>([])

  // Fetch users from the API
  const fetchUsers = useCallback(async () => {
    if (!session) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const usersData: User[] = await response.json()

      // Detect new users
      const existingUserIds = new Set(users.map(u => u.id))
      const newlyDetectedUsers = usersData.filter(user => !existingUserIds.has(user.id))

      if (newlyDetectedUsers.length > 0) {
        setNewUsers(prev => [...prev, ...newlyDetectedUsers])

        // Auto-clear new users notification after 10 seconds
        setTimeout(() => {
          setNewUsers(prev => prev.filter(u => !newlyDetectedUsers.some(nu => nu.id === u.id)))
        }, 10000)
      }

      setUsers(usersData)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }, [session, users])

  // Update user presence information
  const updatePresence = useCallback((email: string, presence: Partial<UserPresence>) => {
    setUserPresence(prev => ({
      ...prev,
      [email]: {
        ...prev[email],
        ...presence,
        lastSeen: new Date()
      }
    }))
  }, [])

  // Get user presence status
  const getUserPresence = useCallback((email: string) => {
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
  }, [userPresence])

  // Initialize user detection
  useEffect(() => {
    fetchUsers()

    // Set up periodic user discovery
    const discoveryInterval = setInterval(() => {
      if (session) {
        fetchUsers()
      }
    }, 15000) // Check for new users every 15 seconds

    return () => clearInterval(discoveryInterval)
  }, [session, fetchUsers])

  // Clear new users notification
  const clearNewUsers = useCallback(() => {
    setNewUsers([])
  }, [])

  return {
    users,
    userPresence,
    isLoading,
    error,
    newUsers,
    fetchUsers,
    updatePresence,
    getUserPresence,
    clearNewUsers
  }
}