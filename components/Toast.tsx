"use client"

import React, { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps {
  toast: ToastMessage
  onClose: (id: string) => void
}

function Toast({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    setIsVisible(true)

    // Auto-dismiss after duration
    const duration = toast.duration || 5000
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onClose(toast.id)
    }, 300) // Match animation duration
  }

  const getToastStyles = () => {
    const baseStyles = "flex items-start gap-3 p-4 rounded-lg shadow-lg border transition-all duration-300 max-w-md w-full"

    const typeStyles = {
      success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200",
      error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200",
      warning: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200",
      info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200"
    }

    const animationStyles = isLeaving
      ? "opacity-0 transform translate-x-full"
      : isVisible
        ? "opacity-100 transform translate-x-0"
        : "opacity-0 transform translate-x-full"

    return `${baseStyles} ${typeStyles[toast.type]} ${animationStyles}`
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return '📢'
    }
  }

  return (
    <div className={getToastStyles()}>
      <div className="flex-shrink-0 text-xl">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm leading-tight">
          {toast.title}
        </h4>
        {toast.message && (
          <p className="text-sm opacity-90 mt-1 leading-relaxed">
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick()
              handleClose()
            }}
            className="mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors touch-manipulation"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
}

export function ToastContainer({
  toasts,
  onRemove,
  position = 'top-right'
}: ToastContainerProps) {
  const getPositionStyles = () => {
    const baseStyles = "fixed z-50 pointer-events-none"

    switch (position) {
      case 'top-right':
        return `${baseStyles} top-4 right-4 space-y-2`
      case 'top-left':
        return `${baseStyles} top-4 left-4 space-y-2`
      case 'bottom-right':
        return `${baseStyles} bottom-4 right-4 space-y-2`
      case 'bottom-left':
        return `${baseStyles} bottom-4 left-4 space-y-2`
      case 'top-center':
        return `${baseStyles} top-4 left-1/2 transform -translate-x-1/2 space-y-2`
      default:
        return `${baseStyles} top-4 right-4 space-y-2`
    }
  }

  return (
    <div className={getPositionStyles()}>
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={onRemove} />
        </div>
      ))}
    </div>
  )
}

// Toast context and hook for global toast management
interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newToast: ToastMessage = { ...toast, id }

    setToasts(prev => [...prev, newToast])

    // Auto-remove after duration (with some buffer for animation)
    if (newToast.duration !== 0) {
      setTimeout(() => {
        removeToast(id)
      }, (newToast.duration || 5000) + 300)
    }
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const clearToasts = () => {
    setToasts([])
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default Toast