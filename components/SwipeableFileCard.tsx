"use client"

import React, { useState, useRef, useCallback } from 'react'

interface ReceivedFile {
  id: string
  fileId: string
  name: string
  originalName: string
  size: number
  type: string
  url: string
  encrypted: boolean
  fileType: string
  senderEmail: string
  senderName?: string
  sharedAt: string
  permissions: string
  expiresAt?: string
}

interface SwipeableFileCardProps {
  file: ReceivedFile
  isSelected: boolean
  onSelect: (fileId: string) => void
  onAccept: (file: ReceivedFile) => void
  onReject: (file: ReceivedFile) => void
  onDownload: (file: ReceivedFile) => void
  onPreview: (file: ReceivedFile) => void
  onDelete: (file: ReceivedFile) => void
  actionLoading: string | null
  children: React.ReactNode
}

export default function SwipeableFileCard({
  file,
  isSelected,
  onSelect,
  onAccept,
  onReject,
  onDownload,
  onPreview,
  onDelete,
  actionLoading,
  children
}: SwipeableFileCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const currentX = useRef(0)

  const SWIPE_THRESHOLD = 80
  const MAX_SWIPE = 120

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    currentX.current = e.touches[0].clientX
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return

    currentX.current = e.touches[0].clientX
    const deltaX = currentX.current - startX.current

    // Only allow left swipe (negative delta)
    if (deltaX < 0) {
      const clampedOffset = Math.max(deltaX, -MAX_SWIPE)
      setSwipeOffset(clampedOffset)
    }
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return

    setIsDragging(false)

    const deltaX = currentX.current - startX.current

    if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaX < 0) {
      // Swipe left - show actions
      setSwipeOffset(-MAX_SWIPE)
      setShowActions(true)
    } else {
      // Reset position
      setSwipeOffset(0)
      setShowActions(false)
    }
  }, [isDragging])

  const handleCloseActions = useCallback(() => {
    setSwipeOffset(0)
    setShowActions(false)
  }, [])

  const handleActionClick = useCallback((action: () => void) => {
    action()
    handleCloseActions()
  }, [handleCloseActions])

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action buttons (revealed on swipe) */}
      <div
        className={`absolute right-0 top-0 h-full bg-red-500 flex items-center justify-end px-4 transition-transform duration-200 ${
          showActions ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: MAX_SWIPE }}
      >
        <button
          onClick={() => handleActionClick(() => onDelete(file))}
          disabled={actionLoading === file.id}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white p-3 rounded-full transition-colors touch-manipulation"
          aria-label="Delete file"
        >
          {actionLoading === file.id ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Main card content */}
      <div
        ref={cardRef}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg transition-transform duration-200 touch-pan-x ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            {/* File Selection Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(file.id)}
              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 touch-manipulation"
            />

            {/* File content passed as children */}
            {children}
          </div>

          {/* Action buttons for desktop or when not swiping */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 hidden md:flex">
            {file.encrypted && (
              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium self-start sm:self-center">
                🔒 Encrypted
              </span>
            )}

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => onAccept(file)}
                disabled={actionLoading === file.id}
                className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
              >
                {actionLoading === file.id ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  "✅ Accept"
                )}
              </button>
              <button
                onClick={() => onReject(file)}
                disabled={actionLoading === file.id}
                className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
              >
                {actionLoading === file.id ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  "❌ Reject"
                )}
              </button>

              {file.type.startsWith('image/') && (
                <button
                  onClick={() => onPreview(file)}
                  disabled={actionLoading === file.id}
                  className="flex-1 sm:flex-none bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
                >
                  {actionLoading === file.id ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      <span>Loading...</span>
                    </div>
                  ) : (
                    "👁️ Preview"
                  )}
                </button>
              )}
              <button
                onClick={() => onDownload(file)}
                disabled={actionLoading === file.id}
                className="flex-1 sm:flex-none bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
              >
                {actionLoading === file.id ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                    <span>Downloading...</span>
                  </div>
                ) : (
                  "⬇️ Download"
                )}
              </button>
              <button
                onClick={() => onDelete(file)}
                disabled={actionLoading === file.id}
                className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm disabled:cursor-not-allowed touch-manipulation active:scale-95"
              >
                {actionLoading === file.id ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  "🗑️ Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Swipe hint overlay for first-time users */}
      {!showActions && !isDragging && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs opacity-50">
            ← Swipe for actions
          </div>
        </div>
      )}
    </div>
  )
}
