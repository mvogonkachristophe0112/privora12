"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { usePresence } from '@/lib/presence-context'
import { Loading } from './Loading'

interface Recipient {
  email: string
  name?: string
  id?: string
  status: 'valid' | 'invalid' | 'pending' | 'not-registered'
  isOnline?: boolean
  lastSeen?: Date
  avatar?: string
}

interface RecipientSelectorProps {
  recipients: string[]
  onRecipientsChange: (recipients: string[]) => void
  maxRecipients?: number
  placeholder?: string
  className?: string
  showValidation?: boolean
  allowBulkImport?: boolean
}

export default function RecipientSelector({
  recipients,
  onRecipientsChange,
  maxRecipients = 50,
  placeholder = "Enter recipient email addresses...",
  className = "",
  showValidation = true,
  allowBulkImport = true
}: RecipientSelectorProps) {
  const { data: session } = useSession()
  const { userPresence } = usePresence()
  const [inputValue, setInputValue] = useState('')
  const [recipientList, setRecipientList] = useState<Recipient[]>([])
  const [suggestions, setSuggestions] = useState<Recipient[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkImportText, setBulkImportText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Convert recipients array to Recipient objects
  useEffect(() => {
    const updateRecipients = async () => {
      setIsValidating(true)
      try {
        const recipientObjects = await Promise.all(
          recipients.map(async (email) => {
            const validation = await validateRecipient(email)
            return {
              email,
              ...validation
            }
          })
        )
        setRecipientList(recipientObjects)
      } finally {
        setIsValidating(false)
      }
    }

    if (recipients.length > 0) {
      updateRecipients()
    } else {
      setRecipientList([])
    }
  }, [recipients])

  // Validate recipient email
  const validateRecipient = useCallback(async (email: string): Promise<Omit<Recipient, 'email'>> => {
    const normalizedEmail = email.trim().toLowerCase()

    // Basic email format validation
    if (!emailRegex.test(normalizedEmail)) {
      return { status: 'invalid' }
    }

    // Don't allow self-sharing
    if (session?.user?.email?.toLowerCase() === normalizedEmail) {
      return { status: 'invalid' }
    }

    try {
      // Check if user exists in the system
      const response = await fetch(`/api/users/validate?email=${encodeURIComponent(normalizedEmail)}`)
      const data = await response.json()

      if (data.exists) {
        const presence = userPresence[normalizedEmail]
        return {
          id: data.user.id,
          name: data.user.name,
          status: 'valid',
          isOnline: presence?.isOnline || false,
          lastSeen: presence?.lastSeen ? new Date(presence.lastSeen) : undefined,
          avatar: data.user.image
        }
      } else {
        return { status: 'not-registered' }
      }
    } catch (error) {
      console.warn('Failed to validate recipient:', error)
      return { status: 'pending' }
    }
  }, [session?.user?.email, userPresence])

  // Search for user suggestions
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`)
      const data = await response.json()

      const suggestionObjects: Recipient[] = data.users
        .filter((user: any) => !recipients.includes(user.email))
        .map((user: any) => ({
          email: user.email,
          name: user.name,
          id: user.id,
          status: 'valid' as const,
          isOnline: userPresence[user.email]?.isOnline || false,
          lastSeen: userPresence[user.email]?.lastSeen ? new Date(userPresence[user.email].lastSeen) : undefined,
          avatar: user.image
        }))

      setSuggestions(suggestionObjects)
      setShowSuggestions(true)
    } catch (error) {
      console.warn('Failed to search users:', error)
      setSuggestions([])
    }
  }, [recipients, userPresence])

  // Handle input change with debounced search
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)

    // Debounce search
    const timeoutId = setTimeout(() => {
      if (value.trim()) {
        searchUsers(value.trim())
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchUsers])

  // Add recipient
  const addRecipient = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) return
    if (recipients.includes(normalizedEmail)) return
    if (recipients.length >= maxRecipients) return

    // Add to recipients list immediately for UI responsiveness
    const newRecipients = [...recipients, normalizedEmail]
    onRecipientsChange(newRecipients)

    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)

    // Validate in background
    const validation = await validateRecipient(normalizedEmail)
    setRecipientList(prev => prev.map(recipient =>
      recipient.email === normalizedEmail
        ? { ...recipient, ...validation }
        : recipient
    ))
  }, [recipients, maxRecipients, onRecipientsChange, validateRecipient])

  // Remove recipient
  const removeRecipient = useCallback((email: string) => {
    const newRecipients = recipients.filter(r => r !== email)
    onRecipientsChange(newRecipients)
  }, [recipients, onRecipientsChange])

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (inputValue.trim()) {
        addRecipient(inputValue.trim())
      }
    } else if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      // Remove last recipient on backspace
      removeRecipient(recipients[recipients.length - 1])
    }
  }, [inputValue, recipients, addRecipient, removeRecipient])

  // Handle bulk import
  const handleBulkImport = useCallback(() => {
    const emails = bulkImportText
      .split(/[\n,;]/)
      .map(email => email.trim().toLowerCase())
      .filter(email => email && emailRegex.test(email))
      .filter(email => !recipients.includes(email))
      .slice(0, maxRecipients - recipients.length)

    if (emails.length > 0) {
      const newRecipients = [...recipients, ...emails]
      onRecipientsChange(newRecipients)
      setBulkImportText('')
      setShowBulkImport(false)
    }
  }, [bulkImportText, recipients, maxRecipients, onRecipientsChange])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: Recipient) => {
    addRecipient(suggestion.email)
  }, [addRecipient])

  // Get status color and icon
  const getStatusInfo = (recipient: Recipient) => {
    switch (recipient.status) {
      case 'valid':
        return {
          color: recipient.isOnline ? 'text-green-600 bg-green-100' : 'text-blue-600 bg-blue-100',
          icon: recipient.isOnline ? '🟢' : '👤',
          text: recipient.isOnline ? 'Online' : 'Registered'
        }
      case 'not-registered':
        return {
          color: 'text-orange-600 bg-orange-100',
          icon: '📧',
          text: 'Not registered (will receive email)'
        }
      case 'invalid':
        return {
          color: 'text-red-600 bg-red-100',
          icon: '❌',
          text: 'Invalid email'
        }
      case 'pending':
        return {
          color: 'text-gray-600 bg-gray-100',
          icon: '⏳',
          text: 'Validating...'
        }
      default:
        return {
          color: 'text-gray-600 bg-gray-100',
          icon: '❓',
          text: 'Unknown'
        }
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <div className="flex flex-wrap gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 min-h-[50px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
          {/* Existing Recipients */}
          {recipientList.map((recipient) => {
            const statusInfo = getStatusInfo(recipient)
            return (
              <span
                key={recipient.email}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${statusInfo.color} ${
                  showValidation ? '' : 'bg-gray-100 dark:bg-gray-700'
                }`}
                title={recipient.name ? `${recipient.name} (${recipient.email})` : recipient.email}
              >
                {recipient.avatar && (
                  <img
                    src={recipient.avatar}
                    alt=""
                    className="w-4 h-4 rounded-full"
                  />
                )}
                <span className="max-w-32 truncate">
                  {recipient.name || recipient.email}
                </span>
                {showValidation && (
                  <span className="text-xs" title={statusInfo.text}>
                    {statusInfo.icon}
                  </span>
                )}
                <button
                  onClick={() => removeRecipient(recipient.email)}
                  className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                  aria-label={`Remove ${recipient.email}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )
          })}

          {/* Input Field */}
          <input
            ref={inputRef}
            type="email"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={recipients.length === 0 ? placeholder : ""}
            className="flex-1 min-w-32 outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500"
            disabled={recipients.length >= maxRecipients}
          />

          {/* Loading indicator */}
          {isValidating && (
            <div className="flex items-center">
              <Loading size="sm" />
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.email}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3"
              >
                {suggestion.avatar ? (
                  <img
                    src={suggestion.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {(suggestion.name || suggestion.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {suggestion.name || suggestion.email}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {suggestion.email}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    suggestion.isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {suggestion.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {recipients.length} of {maxRecipients} recipients
          {isValidating && <span className="ml-2">Validating...</span>}
        </div>

        <div className="flex gap-2">
          {allowBulkImport && (
            <button
              onClick={() => setShowBulkImport(!showBulkImport)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              Bulk Import
            </button>
          )}

          {recipients.length > 0 && (
            <button
              onClick={() => onRecipientsChange([])}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
              Bulk Import Recipients
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Enter email addresses (one per line, or separated by commas)
                </label>
                <textarea
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 resize-none"
                  rows={6}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBulkImport}
                  disabled={!bulkImportText.trim()}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  Import Recipients
                </button>
                <button
                  onClick={() => {
                    setShowBulkImport(false)
                    setBulkImportText('')
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Summary */}
      {showValidation && recipientList.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="text-green-600">●</span>
              {recipientList.filter(r => r.status === 'valid').length} valid
            </span>
            <span className="flex items-center gap-1">
              <span className="text-orange-600">●</span>
              {recipientList.filter(r => r.status === 'not-registered').length} not registered
            </span>
            <span className="flex items-center gap-1">
              <span className="text-red-600">●</span>
              {recipientList.filter(r => r.status === 'invalid').length} invalid
            </span>
          </div>
        </div>
      )}
    </div>
  )
}