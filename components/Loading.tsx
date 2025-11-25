"use client"

import { useLanguage } from '@/lib/language-context'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export function Loading({ size = 'md', text, fullScreen = false }: LoadingProps) {
  const { t } = useLanguage()

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const spinner = (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
      {text && (
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-80 dark:bg-opacity-80 flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-4">
      {spinner}
    </div>
  )
}

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}></div>
  )
}

export function LoadingCard() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse">
      <div className="flex items-center space-x-4">
        <LoadingSkeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <LoadingSkeleton className="w-32 h-4" />
          <LoadingSkeleton className="w-24 h-3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <LoadingSkeleton className="w-full h-3" />
        <LoadingSkeleton className="w-3/4 h-3" />
      </div>
    </div>
  )
}