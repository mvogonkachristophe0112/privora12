"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'

interface ShareButtonProps {
  fileId?: string
  fileName?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onShare?: () => void
}

export default function ShareButton({
  fileId,
  fileName,
  className = "",
  variant = 'primary',
  size = 'md',
  disabled = false,
  onShare
}: ShareButtonProps) {
  const router = useRouter()
  const { addToast } = useToast()
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    if (disabled || isSharing) return

    try {
      setIsSharing(true)

      if (onShare) {
        await onShare()
      } else {
        // Default behavior: navigate to upload page for file selection
        addToast({
          type: 'info',
          title: 'Share Files',
          message: 'Redirecting to file selection...',
          duration: 2000
        })

        // Small delay for user feedback
        setTimeout(() => {
          router.push('/upload')
        }, 500)
      }
    } catch (error) {
      console.error('Share error:', error)
      addToast({
        type: 'error',
        title: 'Share Failed',
        message: 'Failed to initiate file sharing. Please try again.',
        duration: 4000
      })
    } finally {
      setIsSharing(false)
    }
  }

  const getButtonStyles = () => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"

    const variantStyles = {
      primary: "bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500 shadow-lg hover:shadow-xl",
      secondary: "bg-green-500 hover:bg-green-600 text-white focus:ring-green-500 shadow-lg hover:shadow-xl",
      outline: "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-blue-500"
    }

    const sizeStyles = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg"
    }

    return `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`
  }

  return (
    <button
      onClick={handleShare}
      disabled={disabled || isSharing}
      className={getButtonStyles()}
      aria-label={fileName ? `Share ${fileName}` : "Share files"}
    >
      {isSharing ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Sharing...
        </>
      ) : (
        <>
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          {fileName ? `Share ${fileName}` : "Share Files"}
        </>
      )}
    </button>
  )
}