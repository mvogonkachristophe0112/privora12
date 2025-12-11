"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePresence } from './presence-context'

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

  // Get user presence status - this will be replaced by direct usage of usePresence in components
  const getUserPresence = useCallback((email: string) => {
    // This is a placeholder - components should use usePresence directly
    return {
      status: 'offline',
      text: 'Offline',
      color: 'text-gray-400',
      dotColor: 'bg-gray-300',
      deviceType: 'desktop' as const,
      lastSeen: new Date()
    }
  }, [])

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
    isLoading,
    error,
    newUsers,
    fetchUsers,
    getUserPresence,
    clearNewUsers
  }
}