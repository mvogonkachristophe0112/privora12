"use client"

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { DownloadQueueManager } from '@/lib/downloadQueue'

// Types
export interface DownloadItem {
  id: string
  fileId: string
  name: string
  originalName?: string
  size: number
  type: string
  url: string
  encrypted: boolean
  senderEmail: string
  senderName?: string
  sharedAt: string
  permissions: string
  expiresAt?: string
  priority: 'high' | 'normal' | 'low'
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled'
  progress: number
  speed: number // bytes per second
  eta: number // estimated time remaining in seconds
  downloadedBytes: number
  totalBytes: number
  error?: string
  retryCount: number
  maxRetries: number
  startedAt?: Date
  completedAt?: Date
  decryptionKey?: string
}

export interface DownloadState {
  queue: DownloadItem[]
  activeDownloads: DownloadItem[]
  completedDownloads: DownloadItem[]
  failedDownloads: DownloadItem[]
  maxConcurrent: number
  isPaused: boolean
}

export interface DownloadHistory {
  id: string
  fileId: string
  name: string
  size: number
  type: string
  downloadedAt: Date
  status: 'completed' | 'failed'
  speed: number
  duration: number // in seconds
  error?: string
}

type DownloadAction =
  | { type: 'ADD_TO_QUEUE'; payload: Omit<DownloadItem, 'status' | 'progress' | 'speed' | 'eta' | 'downloadedBytes' | 'retryCount'> }
  | { type: 'START_DOWNLOAD'; payload: { id: string } }
  | { type: 'UPDATE_PROGRESS'; payload: { id: string; progress: number; speed: number; eta: number; downloadedBytes: number } }
  | { type: 'PAUSE_DOWNLOAD'; payload: { id: string } }
  | { type: 'RESUME_DOWNLOAD'; payload: { id: string } }
  | { type: 'COMPLETE_DOWNLOAD'; payload: { id: string } }
  | { type: 'FAIL_DOWNLOAD'; payload: { id: string; error: string } }
  | { type: 'RETRY_DOWNLOAD'; payload: { id: string } }
  | { type: 'CANCEL_DOWNLOAD'; payload: { id: string } }
  | { type: 'REMOVE_FROM_QUEUE'; payload: { id: string } }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'CLEAR_FAILED' }
  | { type: 'SET_MAX_CONCURRENT'; payload: { max: number } }
  | { type: 'PAUSE_ALL' }
  | { type: 'RESUME_ALL' }
  | { type: 'LOAD_STATE'; payload: DownloadState }

interface DownloadContextType {
  state: DownloadState
  addToQueue: (item: Omit<DownloadItem, 'status' | 'progress' | 'speed' | 'eta' | 'downloadedBytes' | 'retryCount'>) => void
  pauseDownload: (id: string) => void
  resumeDownload: (id: string) => void
  cancelDownload: (id: string) => void
  retryDownload: (id: string) => void
  removeFromQueue: (id: string) => void
  clearCompleted: () => void
  clearFailed: () => void
  setMaxConcurrent: (max: number) => void
  pauseAll: () => void
  resumeAll: () => void
  getQueueProgress: () => { completed: number; total: number; percentage: number }
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined)

const STORAGE_KEY = 'download-manager-state'

function downloadReducer(state: DownloadState, action: DownloadAction): DownloadState {
  switch (action.type) {
    case 'ADD_TO_QUEUE': {
      const newItem: DownloadItem = {
        ...action.payload,
        status: 'pending',
        progress: 0,
        speed: 0,
        eta: 0,
        downloadedBytes: 0,
        totalBytes: action.payload.size,
        retryCount: 0,
        maxRetries: 3
      }
      return {
        ...state,
        queue: [...state.queue, newItem]
      }
    }

    case 'START_DOWNLOAD': {
      const { id } = action.payload
      const item = state.queue.find(item => item.id === id)
      if (!item) return state

      const updatedItem = { ...item, status: 'downloading' as const, startedAt: new Date() }
      return {
        ...state,
        queue: state.queue.filter(item => item.id !== id),
        activeDownloads: [...state.activeDownloads, updatedItem]
      }
    }

    case 'UPDATE_PROGRESS': {
      const { id, progress, speed, eta, downloadedBytes } = action.payload
      const updateItem = (item: DownloadItem) => ({
        ...item,
        progress,
        speed,
        eta,
        downloadedBytes
      })

      return {
        ...state,
        activeDownloads: state.activeDownloads.map(item =>
          item.id === id ? updateItem(item) : item
        )
      }
    }

    case 'PAUSE_DOWNLOAD': {
      const { id } = action.payload
      const item = state.activeDownloads.find(item => item.id === id)
      if (!item) return state

      const updatedItem = { ...item, status: 'paused' as const }
      return {
        ...state,
        activeDownloads: state.activeDownloads.filter(item => item.id !== id),
        queue: [...state.queue, updatedItem]
      }
    }

    case 'RESUME_DOWNLOAD': {
      const { id } = action.payload
      const item = state.queue.find(item => item.id === id && item.status === 'paused')
      if (!item) return state

      const updatedItem = { ...item, status: 'downloading' as const }
      return {
        ...state,
        queue: state.queue.filter(item => item.id !== id),
        activeDownloads: [...state.activeDownloads, updatedItem]
      }
    }

    case 'COMPLETE_DOWNLOAD': {
      const { id } = action.payload
      const item = state.activeDownloads.find(item => item.id === id)
      if (!item) return state

      const completedItem = { ...item, status: 'completed' as const, completedAt: new Date() }
      return {
        ...state,
        activeDownloads: state.activeDownloads.filter(item => item.id !== id),
        completedDownloads: [...state.completedDownloads, completedItem]
      }
    }

    case 'FAIL_DOWNLOAD': {
      const { id } = action.payload
      const item = state.activeDownloads.find(item => item.id === id)
      if (!item) return state

      const failedItem = { ...item, status: 'failed' as const, error: action.payload.error }
      return {
        ...state,
        activeDownloads: state.activeDownloads.filter(item => item.id !== id),
        failedDownloads: [...state.failedDownloads, failedItem]
      }
    }

    case 'RETRY_DOWNLOAD': {
      const { id } = action.payload
      const item = [...state.failedDownloads, ...state.queue].find(item => item.id === id)
      if (!item) return state

      const retriedItem = {
        ...item,
        status: 'pending' as const,
        retryCount: item.retryCount + 1,
        error: undefined
      }

      return {
        ...state,
        failedDownloads: state.failedDownloads.filter(item => item.id !== id),
        queue: [...state.queue.filter(item => item.id !== id), retriedItem]
      }
    }

    case 'CANCEL_DOWNLOAD': {
      const { id } = action.payload
      return {
        ...state,
        queue: state.queue.filter(item => item.id !== id),
        activeDownloads: state.activeDownloads.filter(item => item.id !== id),
        failedDownloads: state.failedDownloads.filter(item => item.id !== id)
      }
    }

    case 'REMOVE_FROM_QUEUE': {
      const { id } = action.payload
      return {
        ...state,
        queue: state.queue.filter(item => item.id !== id)
      }
    }

    case 'CLEAR_COMPLETED': {
      return {
        ...state,
        completedDownloads: []
      }
    }

    case 'CLEAR_FAILED': {
      return {
        ...state,
        failedDownloads: []
      }
    }

    case 'SET_MAX_CONCURRENT': {
      return {
        ...state,
        maxConcurrent: action.payload.max
      }
    }

    case 'PAUSE_ALL': {
      const pausedItems = state.activeDownloads.map(item => ({ ...item, status: 'paused' as const }))
      return {
        ...state,
        activeDownloads: [],
        queue: [...state.queue, ...pausedItems],
        isPaused: true
      }
    }

    case 'RESUME_ALL': {
      return {
        ...state,
        isPaused: false
      }
    }

    case 'LOAD_STATE': {
      return action.payload
    }

    default:
      return state
  }
}

const initialState: DownloadState = {
  queue: [],
  activeDownloads: [],
  completedDownloads: [],
  failedDownloads: [],
  maxConcurrent: 3,
  isPaused: false
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [state, dispatch] = useReducer(downloadReducer, initialState)
  const queueManagerRef = useRef<DownloadQueueManager>(new DownloadQueueManager(state.maxConcurrent))

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      try {
        const saved = localStorage.getItem(`${STORAGE_KEY}-${session.user.id}`)
        if (saved) {
          const parsedState = JSON.parse(saved)
          // Convert date strings back to Date objects
          const convertDates = (items: DownloadItem[]) =>
            items.map(item => ({
              ...item,
              startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
              completedAt: item.completedAt ? new Date(item.completedAt) : undefined
            }))

          dispatch({
            type: 'LOAD_STATE',
            payload: {
              ...parsedState,
              queue: convertDates(parsedState.queue || []),
              activeDownloads: convertDates(parsedState.activeDownloads || []),
              completedDownloads: convertDates(parsedState.completedDownloads || []),
              failedDownloads: convertDates(parsedState.failedDownloads || [])
            }
          })
        }
      } catch (error) {
        console.error('Failed to load download state:', error)
      }
    }
  }, [session?.user?.id])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      try {
        localStorage.setItem(`${STORAGE_KEY}-${session.user.id}`, JSON.stringify(state))
      } catch (error) {
        console.error('Failed to save download state:', error)
      }
    }
  }, [state, session?.user?.id])

  // Update queue manager max concurrent when state changes
  useEffect(() => {
    queueManagerRef.current.setMaxConcurrent(state.maxConcurrent)
  }, [state.maxConcurrent])

  // Auto-start downloads when queue has items and we're not at max concurrent
  useEffect(() => {
    if (state.isPaused) return

    const availableSlots = state.maxConcurrent - state.activeDownloads.length
    if (availableSlots > 0 && state.queue.length > 0) {
      // Sort queue by priority
      const sortedQueue = [...state.queue].sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })

      const itemsToStart = sortedQueue.slice(0, availableSlots)

      itemsToStart.forEach(item => {
        dispatch({ type: 'START_DOWNLOAD', payload: { id: item.id } })

        // Start the actual download
        queueManagerRef.current.addDownload(
          item,
          (id, progress, speed, eta, downloadedBytes) => {
            dispatch({
              type: 'UPDATE_PROGRESS',
              payload: { id, progress, speed, eta, downloadedBytes }
            })
          },
          (id) => {
            dispatch({ type: 'COMPLETE_DOWNLOAD', payload: { id } })
          },
          (id, error) => {
            dispatch({ type: 'FAIL_DOWNLOAD', payload: { id, error } })
          }
        )
      })
    }
  }, [state.queue, state.activeDownloads.length, state.maxConcurrent, state.isPaused])

  const addToQueue = useCallback((item: Omit<DownloadItem, 'status' | 'progress' | 'speed' | 'eta' | 'downloadedBytes' | 'retryCount'>) => {
    dispatch({ type: 'ADD_TO_QUEUE', payload: item })
  }, [])

  const pauseDownload = useCallback((id: string) => {
    queueManagerRef.current.pauseDownload(id)
    dispatch({ type: 'PAUSE_DOWNLOAD', payload: { id } })
  }, [])

  const resumeDownload = useCallback((id: string) => {
    dispatch({ type: 'RESUME_DOWNLOAD', payload: { id } })
  }, [])

  const cancelDownload = useCallback((id: string) => {
    queueManagerRef.current.cancelDownload(id)
    dispatch({ type: 'CANCEL_DOWNLOAD', payload: { id } })
  }, [])

  const retryDownload = useCallback((id: string) => {
    dispatch({ type: 'RETRY_DOWNLOAD', payload: { id } })
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FROM_QUEUE', payload: { id } })
  }, [])

  const clearCompleted = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPLETED' })
  }, [])

  const clearFailed = useCallback(() => {
    dispatch({ type: 'CLEAR_FAILED' })
  }, [])

  const setMaxConcurrent = useCallback((max: number) => {
    dispatch({ type: 'SET_MAX_CONCURRENT', payload: { max } })
  }, [])

  const pauseAll = useCallback(() => {
    // Cancel all active downloads
    state.activeDownloads.forEach(item => {
      queueManagerRef.current.cancelDownload(item.id)
    })
    dispatch({ type: 'PAUSE_ALL' })
  }, [state.activeDownloads])

  const resumeAll = useCallback(() => {
    dispatch({ type: 'RESUME_ALL' })
  }, [])

  const getQueueProgress = useCallback(() => {
    const allItems = [...state.queue, ...state.activeDownloads, ...state.completedDownloads, ...state.failedDownloads]
    const completed = allItems.filter(item => item.status === 'completed').length
    const total = allItems.length
    const percentage = total > 0 ? (completed / total) * 100 : 0
    return { completed, total, percentage }
  }, [state])

  const value: DownloadContextType = {
    state,
    addToQueue,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    removeFromQueue,
    clearCompleted,
    clearFailed,
    setMaxConcurrent,
    pauseAll,
    resumeAll,
    getQueueProgress
  }

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  )
}

export function useDownloadManager() {
  const context = useContext(DownloadContext)
  if (context === undefined) {
    throw new Error('useDownloadManager must be used within a DownloadProvider')
  }
  return context
}