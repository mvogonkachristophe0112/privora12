"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { usePresence } from "@/lib/presence-context"

interface Message {
  id: string
  content: string
  user: { name: string; email: string }
  createdAt: string
  type?: 'text' | 'file'
  fileUrl?: string
  fileName?: string
  reactions?: { [emoji: string]: string[] }
  replyTo?: string
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  error?: boolean
}

interface User {
  id: string
  name: string
  email: string
  isOnline: boolean
  lastSeen: string
}

export default function CrypChat() {
  const { data: session, status } = useSession()
  const { userPresence, isConnected: presenceConnected } = usePresence()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [roomId, setRoomId] = useState("general")
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const connectionStatus = presenceConnected ? 'connected' : 'connecting'
  const [activeUsers, setActiveUsers] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDirectMessage, setIsDirectMessage] = useState(false)
  const [directMessageTarget, setDirectMessageTarget] = useState<User | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Check if this is a direct message from URL or sessionStorage
        const urlParams = new URLSearchParams(window.location.search)
        const roomParam = urlParams.get('room')

        if (roomParam && roomParam.startsWith('dm-')) {
          // This is a direct message
          setIsDirectMessage(true)
          setRoomId(roomParam)

          // Check sessionStorage for target user info
          const dmInfo = sessionStorage.getItem('directMessageRoom')
          if (dmInfo) {
            const { targetUser } = JSON.parse(dmInfo)
            setDirectMessageTarget(targetUser)
            sessionStorage.removeItem('directMessageRoom') // Clean up
          }
        } else {
          setIsDirectMessage(false)
          setDirectMessageTarget(null)
        }

        await Promise.all([
          fetchMessages(),
          fetchAllUsers()
        ])
      } catch (err) {
        console.error('Failed to initialize chat:', err)
        setError('Failed to load chat. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    }

    initializeChat()

    // Set up real-time message polling
    const messagePollingInterval = setInterval(async () => {
      if (session && roomId) {
        try {
          const res = await fetch(`/api/messages?roomId=${roomId}`)
          if (res.ok) {
            const data = await res.json()
            const newMessages = data.messages || data

            // Only update if we have new messages
            if (newMessages.length > messages.length) {
              setMessages(newMessages)
            }
          }
        } catch (error) {
          console.error('Failed to poll for new messages:', error)
        }
      }
    }, 3000) // Poll every 3 seconds for real-time updates

    // Cleanup on unmount
    return () => {
      clearInterval(messagePollingInterval)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [roomId, session])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Update active users count from presence data
  useEffect(() => {
    const onlineCount = Object.values(userPresence).filter(presence => presence.isOnline).length
    setActiveUsers(onlineCount)
  }, [userPresence])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/messages?roomId=${roomId}`)
      if (res.ok) {
        const data = await res.json()
        // Handle new API response format with pagination
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages)
        } else if (Array.isArray(data)) {
          // Fallback for old format
          setMessages(data)
        } else {
          console.error("Invalid messages response format")
          setMessages([])
        }
      } else {
        console.error("Failed to fetch messages:", res.status)
        setMessages([])
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error)
      setMessages([])
    }
  }

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const usersData = await response.json()
        setAllUsers(usersData)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const sendMessage = async (retryCount = 0) => {
    if (!newMessage.trim() || !session?.user) return

    const maxRetries = 3
    const retryDelay = Math.pow(2, retryCount) * 1000 // Exponential backoff

    // Add message to UI immediately with sending status
    const tempMessage: Message = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      content: newMessage,
      user: {
        name: session.user.name || 'Unknown User',
        email: session.user.email || ''
      },
      createdAt: new Date().toISOString(),
      status: 'sending',
      replyTo: replyTo?.id
    }

    setMessages(prev => [...prev, tempMessage])
    const messageToSend = newMessage
    const replyToId = replyTo?.id

    setNewMessage("")
    setReplyTo(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: messageToSend,
          roomId,
          replyTo: replyToId
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (res.ok) {
        const message = await res.json()
        // Update the temporary message with the real one
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id ? { ...message, status: 'sent' } : msg
        ))

        // Mark as delivered after a short delay
        setTimeout(() => {
          setMessages(prev => prev.map(msg =>
            msg.id === message.id ? { ...msg, status: 'delivered' } : msg
          ))
        }, 1000)
      } else {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
    } catch (error) {
      console.error(`Failed to send message (attempt ${retryCount + 1}/${maxRetries + 1}):`, error)

      if (retryCount < maxRetries && !(error instanceof Error && error.name === 'AbortError')) {
        // Retry with exponential backoff
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, status: 'sending' } : msg
        ))

        setTimeout(() => {
          sendMessage(retryCount + 1)
        }, retryDelay)
      } else {
        // Mark as failed after all retries
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, status: 'sent', error: true } : msg
        ))
      }
    }
  }

  const addReaction = (messageId: string, emoji: string) => {
    if (!session?.user?.email) return

    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {}
        const users = reactions[emoji] || []
        const userEmail = session.user.email
        if (users.includes(userEmail)) {
          // Remove reaction
          reactions[emoji] = users.filter(email => email !== userEmail)
        } else {
          // Add reaction
          reactions[emoji] = [...users, userEmail]
        }
        return { ...msg, reactions }
      }
      return msg
    }))
  }

  const replyToMessage = (message: Message) => {
    setReplyTo(message)
  }


  const filteredMessages = (messages || []).filter(msg =>
    msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡']

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p>Loading CrypChat...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-4">Access Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please login to access CrypChat</p>
          <a
            href="/login"
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Login
          </a>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Connection Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Loading chat state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p>Connecting to CrypChat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex relative">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 w-80 md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">CrypChat</h2>
              {/* Connection Status */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`} />
                <span className="text-xs text-gray-500 hidden sm:inline">
                  {connectionStatus === 'connected' ? `${activeUsers} online` :
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   'Disconnected'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              {/* Mobile close button */}
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors md:hidden"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
            />
            <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Chat Rooms */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Chat Rooms</h3>
          <div className="space-y-2">
            {["general", "project", "random"].map((room) => (
              <div
                key={room}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  roomId === room
                    ? "bg-primary-100 dark:bg-primary-900 border-l-4 border-primary-500"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => setRoomId(room)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium capitalize">{room}</p>
                    <p className="text-sm text-gray-500">
                      {room === "general" ? "Public chat" :
                       room === "project" ? "Team discussions" :
                       "Random talks"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">
                      {Math.floor(Math.random() * 10) + 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Online Users */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
              Online Users ({activeUsers})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(userPresence)
                .filter(([email, presence]) => presence.isOnline)
                .map(([email, presence]) => {
                  const user = allUsers.find(u => u.email === email)
                  if (!user) return null

                  return (
                    <div key={email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full animate-pulse"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">
                            {user.name || user.email.split('@')[0]}
                          </p>
                          <span className="text-xs">
                            {presence.deviceType === 'phone' && '📱'}
                            {presence.deviceType === 'laptop' && '💻'}
                            {presence.deviceType === 'tablet' && '📱'}
                            {presence.deviceType === 'desktop' && '🖥️'}
                          </span>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">Online now</p>
                      </div>
                    </div>
                  )
                })}
              {activeUsers === 0 && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No users online</p>
                  <p className="text-xs mt-1">Users will appear here when they sign in</p>
                </div>
              )}
            </div>

            {/* All Users (Online & Offline) */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wide">
                All Users ({allUsers.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {allUsers.map((user) => {
                  const presence = userPresence[user.email]

                  // Compute status inline to avoid hook violations
                  const getUserStatus = (email: string) => {
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

                  const status = getUserStatus(user.email)

                  return (
                    <div key={user.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div className="relative">
                        <div className="w-6 h-6 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800 ${status.dotColor}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-xs font-medium truncate">
                            {user.name || user.email.split('@')[0]}
                          </p>
                          {presence?.deviceType && (
                            <span className="text-xs">
                              {presence.deviceType === 'phone' && '📱'}
                              {presence.deviceType === 'laptop' && '💻'}
                              {presence.deviceType === 'tablet' && '📱'}
                              {presence.deviceType === 'desktop' && '🖥️'}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${status.color}`}>{status.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Chat Header */}
        <div className="p-3 md:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg md:text-xl font-bold">
                  {isDirectMessage && directMessageTarget
                    ? `Chat with ${directMessageTarget.name || directMessageTarget.email.split('@')[0]}`
                    : `${roomId} Room`
                  }
                </h1>
                <p className="text-xs md:text-sm text-gray-500">
                  {isDirectMessage
                    ? `${messages.length} messages`
                    : `${activeUsers} online • ${messages.length} messages`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Connection status indicator */}
              <div className="hidden sm:flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`} />
                <span className="text-xs text-gray-500">
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   'Disconnected'}
                </span>
              </div>
              {isTyping && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="hidden sm:inline">Someone is typing...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            {filteredMessages.map((msg) => {
              if (!msg || !msg.user) return null

              const isOwnMessage = msg.user.email === session?.user?.email
              const replyMessage = msg.replyTo ? (messages || []).find(m => m.id === msg.replyTo) : null

              return (
                <div key={msg.id || Math.random()} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} group`}>
                  <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? "order-2" : "order-1"}`}>
                    {/* Reply indicator */}
                    {replyMessage && replyMessage.user && (
                      <div className={`mb-2 p-2 rounded border-l-4 ${
                        isOwnMessage ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-300 bg-gray-50 dark:bg-gray-700"
                      }`}>
                        <p className="text-xs text-gray-500">Replying to {replyMessage.user.name || 'Unknown'}</p>
                        <p className="text-sm truncate">{replyMessage.content || ''}</p>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`relative p-3 rounded-2xl shadow-sm ${
                      isOwnMessage
                        ? "bg-primary-500 text-white"
                        : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                    }`}>
                      {!isOwnMessage && (
                        <p className="font-medium text-sm mb-1 text-primary-600 dark:text-primary-400">
                          {msg.user.name || 'Unknown User'}
                        </p>
                      )}

                      {/* File message */}
                      {msg.type === 'file' && msg.fileName && (
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm font-medium">{msg.fileName}</span>
                        </div>
                      )}

                      {/* Text content */}
                      {msg.content && <p className="break-words">{msg.content}</p>}

                      {/* Message status */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs ${isOwnMessage ? "text-primary-100" : "text-gray-500"}`}>
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                          {msg.error && (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Failed
                            </span>
                          )}
                        </div>
                        {isOwnMessage && (
                          <div className="flex items-center gap-1">
                            {msg.status === 'sending' && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>}
                            {msg.status === 'sent' && <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            {msg.status === 'delivered' && <svg className="w-3 h-3 text-gray-200" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            {msg.status === 'read' && <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            {msg.status === 'failed' && (
                              <button
                                onClick={() => {
                                  // Retry sending this message
                                  const retryMessage = { ...msg, status: 'sending' as const, error: false }
                                  setMessages(prev => prev.map(m => m.id === msg.id ? retryMessage : m))
                                  // Re-send logic would need to be implemented
                                }}
                                className="w-3 h-3 text-red-400 hover:text-red-300"
                                title="Retry sending"
                              >
                                <svg fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            Array.isArray(users) && users.length > 0 && (
                              <span key={emoji} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs">
                                {emoji} {users.length}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Message actions */}
                    <div className={`flex gap-1 mt-1 ${isOwnMessage ? "justify-end" : "justify-start"} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <button
                        onClick={() => addReaction(msg.id, '👍')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Like"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => addReaction(msg.id, '❤️')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Love"
                      >
                        ❤️
                      </button>
                      <button
                        onClick={() => replyToMessage(msg)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Reply"
                      >
                        ↩️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Reply indicator */}
          {replyTo && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-primary-500">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Replying to {replyTo.user.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {replyTo.content}
                  </p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                  aria-label="Cancel reply"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 md:gap-3">
            {/* Emoji button - Hidden on very small screens to save space */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                title="Add emoji"
                aria-label="Add emoji"
              >
                😊
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10">
                  <div className="grid grid-cols-6 gap-2">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setNewMessage(prev => prev + emoji)
                          setShowEmojiPicker(false)
                        }}
                        className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors touch-manipulation"
                        aria-label={`Add ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  // Clear existing timeout
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current)
                  }
                  // Simulate typing indicator
                  if (!isTyping) {
                    setIsTyping(true)
                  }
                  // Set new timeout
                  typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000)
                }}
                placeholder="Type a message..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 resize-none min-h-[44px] max-h-32 touch-manipulation"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                rows={1}
                style={{ height: 'auto', minHeight: '44px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={() => sendMessage()}
              disabled={!newMessage.trim()}
              className="px-4 md:px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Send message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}