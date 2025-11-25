"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

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
  status?: 'sending' | 'sent' | 'delivered' | 'read'
}

interface User {
  id: string
  name: string
  email: string
  isOnline: boolean
  lastSeen: string
}

export default function CryChat() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [roomId, setRoomId] = useState("general")
  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()
    fetchOnlineUsers()
  }, [roomId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/messages?roomId=${roomId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (error) {
      console.error("Failed to fetch messages")
    }
  }

  const fetchOnlineUsers = async () => {
    // Mock online users - in real app, this would come from API
    const mockUsers: User[] = [
      { id: "1", name: "Alice Johnson", email: "alice@example.com", isOnline: true, lastSeen: new Date().toISOString() },
      { id: "2", name: "Bob Smith", email: "bob@example.com", isOnline: true, lastSeen: new Date().toISOString() },
      { id: "3", name: "Carol Davis", email: "carol@example.com", isOnline: false, lastSeen: new Date(Date.now() - 300000).toISOString() }
    ]
    setOnlineUsers(mockUsers)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !session) return

    // Add message to UI immediately with sending status
    const tempMessage: Message = {
      id: Date.now().toString(),
      content: newMessage,
      user: { name: session.user.name, email: session.user.email },
      createdAt: new Date().toISOString(),
      status: 'sending',
      replyTo: replyTo?.id
    }

    setMessages([...messages, tempMessage])
    setNewMessage("")
    setReplyTo(null)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage,
          roomId,
          replyTo: replyTo?.id
        })
      })

      if (res.ok) {
        const message = await res.json()
        // Update the temporary message with the real one
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id ? { ...message, status: 'sent' } : msg
        ))
      } else {
        // Mark as failed
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, status: 'sent' } : msg
        ))
      }
    } catch (error) {
      console.error("Failed to send message")
      setMessages(prev => prev.map(msg =>
        msg.id === tempMessage.id ? { ...msg, status: 'sent' } : msg
      ))
    }
  }

  const addReaction = (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {}
        const users = reactions[emoji] || []
        if (users.includes(session?.user?.email || '')) {
          // Remove reaction
          reactions[emoji] = users.filter(email => email !== session?.user?.email)
        } else {
          // Add reaction
          reactions[emoji] = [...users, session?.user?.email || '']
        }
        return { ...msg, reactions }
      }
      return msg
    }))
  }

  const replyToMessage = (message: Message) => {
    setReplyTo(message)
  }


  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡']

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">Please login to access chat</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">CryChat</h2>
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
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Online Users</h3>
            <div className="space-y-2">
              {onlineUsers.filter(user => user.isOnline).map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user.name.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-gray-500">Online</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold capitalize">{roomId} Room</h1>
              <p className="text-sm text-gray-500">
                {onlineUsers.filter(u => u.isOnline).length} online • {messages.length} messages
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTyping && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  Someone is typing...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            {filteredMessages.map((msg) => {
              const isOwnMessage = msg.user.email === session?.user?.email
              const replyMessage = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null

              return (
                <div key={msg.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} group`}>
                  <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? "order-2" : "order-1"}`}>
                    {/* Reply indicator */}
                    {replyMessage && (
                      <div className={`mb-2 p-2 rounded border-l-4 ${
                        isOwnMessage ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-300 bg-gray-50 dark:bg-gray-700"
                      }`}>
                        <p className="text-xs text-gray-500">Replying to {replyMessage.user.name}</p>
                        <p className="text-sm truncate">{replyMessage.content}</p>
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
                          {msg.user.name}
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
                        <p className={`text-xs ${isOwnMessage ? "text-primary-100" : "text-gray-500"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isOwnMessage && (
                          <div className="flex items-center gap-1">
                            {msg.status === 'sending' && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>}
                            {msg.status === 'sent' && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            {msg.status === 'delivered' && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            {msg.status === 'read' && <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                          </div>
                        )}
                      </div>

                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            users.length > 0 && (
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Reply indicator */}
          {replyTo && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-primary-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Replying to {replyTo.user.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {replyTo.content}
                  </p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
          )}


          <div className="flex items-end gap-2">

            {/* Emoji button */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Add emoji"
              >
                😊
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                  <div className="grid grid-cols-6 gap-2">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setNewMessage(prev => prev + emoji)
                          setShowEmojiPicker(false)
                        }}
                        className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
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
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  // Simulate typing indicator
                  if (!isTyping) {
                    setIsTyping(true)
                    setTimeout(() => setIsTyping(false), 2000)
                  }
                }}
                placeholder="Type a message..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 resize-none"
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              />
            </div>

            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
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