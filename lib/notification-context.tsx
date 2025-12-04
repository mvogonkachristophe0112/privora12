"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface NotificationContextType {
  newFileCount: number
  setNewFileCount: (count: number) => void
  incrementNewFiles: (count?: number) => void
  clearNewFiles: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [newFileCount, setNewFileCount] = useState(0)

  const incrementNewFiles = (count: number = 1) => {
    setNewFileCount(prev => prev + count)
  }

  const clearNewFiles = () => {
    setNewFileCount(0)
  }

  const value: NotificationContextType = {
    newFileCount,
    setNewFileCount,
    incrementNewFiles,
    clearNewFiles,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}