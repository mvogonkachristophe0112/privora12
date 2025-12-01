"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { usePresence, useUserPresence } from "@/lib/presence-context"

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
  user: User
}

interface Connection {
  id: string
  userId: string
  connectedTo: string
  status: string
  user: User
}

export default function Connections() {
  const { data: session } = useSession()
  const router = useRouter()
  const { userPresence, socket } = usePresence()
  const [users, setUsers] = useState<User[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [actionMode, setActionMode] = useState<"send" | "receive" | null>(null)
  const [connectionRequests, setConnectionRequests] = useState<Connection[]>([])

  const fetchConnections = async () => {
    if (!session) return

    try {
      const response = await fetch('/api/connections')
      if (response.ok) {
        const connectionsData = await response.json()
        setConnections(connectionsData)

        const pendingRequests = connectionsData.filter((conn: Connection) =>
          conn.status === 'pending' && conn.connectedTo === session.user.email
        )
        setConnectionRequests(pendingRequests)
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
    }
  }

  // Listen for connection-related socket events
  useEffect(() => {
    if (!socket) return

    const handleConnectionRequest = () => {
      fetchConnections()
    }

    const handleConnectionAccepted = () => {
      fetchConnections()
    }

    socket.on('connection-request', handleConnectionRequest)
    socket.on('connection-accepted', handleConnectionAccepted)

    return () => {
      socket.off('connection-request', handleConnectionRequest)
      socket.off('connection-accepted', handleConnectionAccepted)
    }
  }, [socket])

  useEffect(() => {
    const fetchData = async () => {
      if (!session) return

      try {
        setLoading(true)
        setError(null)

        // Fetch users and connections in parallel
        const [usersResponse, connectionsResponse] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/connections'),
        ])

        if (!usersResponse.ok || !connectionsResponse.ok) {
          throw new Error('Failed to fetch data')
        }

        const [usersData, connectionsData] = await Promise.all([
          usersResponse.json(),
          connectionsResponse.json(),
        ])

        setUsers(usersData)
        setConnections(connectionsData)

        // Filter pending connection requests
        const pendingRequests = connectionsData.filter((conn: Connection) =>
          conn.status === 'pending' && conn.connectedTo === session.user.email
        )
        setConnectionRequests(pendingRequests)

      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session])

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSendFiles = () => {
    if (selectedUsers.size === 0) return

    // Store selected users in sessionStorage for the upload page
    const selectedUserEmails = users
      .filter(user => selectedUsers.has(user.id))
      .map(user => user.email)

    sessionStorage.setItem('selectedRecipients', JSON.stringify(selectedUserEmails))
    router.push('/upload')
  }

  const handleViewReceivedFiles = () => {
    router.push('/receive')
  }

  const clearSelection = () => {
    setSelectedUsers(new Set())
    setActionMode(null)
  }

  const handleAddConnection = async (targetEmail: string) => {
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetEmail }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send connection request')
      }

      // Emit socket event for real-time notification
      if (socket) {
        socket.emit('request-connection', {
          fromUserId: session?.user?.id,
          toUserEmail: targetEmail,
        })
      }

      alert('Connection request sent successfully!')
      fetchConnections()
    } catch (error) {
      console.error('Error adding connection:', error)
      alert(`Failed to send connection request: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleAcceptConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      })

      if (!response.ok) {
        throw new Error('Failed to accept connection')
      }

      // Emit socket event for real-time notification
      if (socket) {
        socket.emit('accept-connection', {
          userId: session?.user?.id,
          requesterEmail: connectionRequests.find(c => c.id === connectionId)?.userId,
        })
      }

      alert('Connection accepted!')
      fetchConnections()
    } catch (error) {
      console.error('Error accepting connection:', error)
      alert(`Failed to accept connection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRejectConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject' }),
      })

      if (!response.ok) {
        throw new Error('Failed to reject connection')
      }

      alert('Connection request rejected')
      fetchConnections()
    } catch (error) {
      console.error('Error rejecting connection:', error)
      alert(`Failed to reject connection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getUserStatus = (email: string) => {
    return useUserPresence(email)
  }

  const isConnected = (email: string) => {
    return connections.some(conn =>
      (conn.userId === session?.user?.id && conn.connectedTo === email && conn.status === 'accepted') ||
      (conn.connectedTo === session?.user?.email && conn.userId === email && conn.status === 'accepted')
    )
  }

  const hasPendingRequest = (email: string) => {
    return connections.some(conn =>
      conn.userId === session?.user?.id && conn.connectedTo === email && conn.status === 'pending'
    )
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">Please login to view connections</div>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading connections...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-4">Error Loading Connections</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">User Directory</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                All signed-in users are automatically visible here. Share files and connect directly.
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {users.length} users available
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActionMode("send")}
                  className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                    actionMode === "send"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  📤 Send Files
                </button>
                <button
                  onClick={() => setActionMode("receive")}
                  className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                    actionMode === "receive"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  📥 View Received Files
                </button>
              </div>

              {selectedUsers.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-red-500 hover:text-red-700 text-sm underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {actionMode === "send" && selectedUsers.size > 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                  Ready to send files to {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''}?
                </p>
                <button
                  onClick={handleSendFiles}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  Continue to Upload
                </button>
              </div>
            )}

            {actionMode === "receive" && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  View files that have been shared with you
                </p>
                <button
                  onClick={handleViewReceivedFiles}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  View Received Files
                </button>
              </div>
            )}
          </div>

          {/* Connection Requests */}
          {connectionRequests.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 mb-6">
              <h2 className="text-lg md:text-xl font-semibold mb-4">Connection Requests</h2>
              <div className="space-y-3">
                {connectionRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {request.user.image ? (
                          <img
                            src={request.user.image}
                            alt={request.user.name || request.user.email}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          (request.user.name || request.user.email).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm md:text-base">
                          {request.user.name || request.user.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {request.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptConnection(request.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium touch-manipulation"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectConnection(request.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium touch-manipulation"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Users Directory */}
          {users.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h2 className="text-2xl font-semibold mb-4">No Other Users Online</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Other users will appear here automatically when they sign in.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-xl transition-all cursor-pointer ${
                    selectedUsers.has(user.id) && actionMode === "send"
                      ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "hover:scale-105"
                  }`}
                  onClick={() => actionMode === "send" && toggleUserSelection(user.id)}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name || user.email}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          (user.name || user.email).charAt(0).toUpperCase()
                        )}
                      </div>
                      {/* Online status indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${getUserStatus(user.email).dotColor}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base md:text-lg truncate">
                          {user.name || user.email.split('@')[0]}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getUserStatus(user.email).color} bg-gray-100 dark:bg-gray-700`}>
                          {getUserStatus(user.email).text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span>{user._count.files} files uploaded</span>
                    <span>{user._count.sharedFiles} files shared</span>
                  </div>

                  {/* Action buttons - all users are automatically visible */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Direct file sharing without connection request
                          toggleUserSelection(user.id)
                          setActionMode("send")
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium touch-manipulation"
                      >
                        Share Files
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Could implement direct messaging or other actions
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium touch-manipulation"
                      >
                        Message
                      </button>
                    </div>

                    {/* Optional connection request for closer relationships */}
                    {!isConnected(user.email) && !hasPendingRequest(user.email) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddConnection(user.email)
                        }}
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium touch-manipulation"
                      >
                        Add to Connections
                      </button>
                    )}

                    {isConnected(user.email) && (
                      <div className="flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Connected
                        </span>
                      </div>
                    )}

                    {hasPendingRequest(user.email) && (
                      <div className="flex items-center justify-center">
                        <span className="text-yellow-600 dark:text-yellow-400 text-sm font-medium flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Request Pending
                        </span>
                      </div>
                    )}
                  </div>

                  {actionMode === "send" && (
                    <div className="mt-4 flex items-center justify-center">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedUsers.has(user.id)
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {selectedUsers.has(user.id) && (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}