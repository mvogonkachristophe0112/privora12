"use client"

import React, { useState, useEffect } from 'react'
import { Loading } from './Loading'

interface FilePreview {
  name: string
  size: number
  type: string
  encrypted: boolean
}

interface Recipient {
  email: string
  name?: string
  status: 'valid' | 'invalid' | 'pending' | 'not-registered'
  isOnline?: boolean
}

interface FilePreview {
  name: string
  size: number
  type: string
  encrypted: boolean
}

interface Recipient {
  email: string
  name?: string
  status: 'valid' | 'invalid' | 'pending' | 'not-registered'
  isOnline?: boolean
}

interface ShareConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (options: ShareOptions) => Promise<void>
  files: FilePreview[]
  recipients: string[]
  recipientDetails: Recipient[]
  isLoading?: boolean
}

interface ShareOptions {
  sendNotifications: boolean
  notificationChannels: ('email' | 'push' | 'sms')[]
  requireConfirmation: boolean
  expirationHours?: number
  maxDownloads?: number
  password?: string
}

export default function ShareConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  files,
  recipients,
  recipientDetails,
  isLoading = false
}: ShareConfirmationDialogProps) {
  const [shareOptions, setShareOptions] = useState<ShareOptions>({
    sendNotifications: true,
    notificationChannels: ['email'],
    requireConfirmation: false,
    expirationHours: 168, // 7 days
    maxDownloads: undefined,
    password: ''
  })

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  // Reset options when dialog opens
  useEffect(() => {
    if (isOpen) {
      setShareOptions({
        sendNotifications: true,
        notificationChannels: ['email'],
        requireConfirmation: false,
        expirationHours: 168,
        maxDownloads: undefined,
        password: ''
      })
      setShowAdvanced(false)
      setIsConfirming(false)
    }
  }, [isOpen])

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm(shareOptions)
      onClose()
    } catch (error) {
      console.error('Share confirmation failed:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getTotalSize = () => {
    return files.reduce((total, file) => total + file.size, 0)
  }

  const getValidRecipients = () => {
    return recipientDetails.filter(r => r.status === 'valid' || r.status === 'not-registered').length
  }

  const getInvalidRecipients = () => {
    return recipientDetails.filter(r => r.status === 'invalid').length
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Confirm File Sharing
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Review details before sending {files.length} file{files.length !== 1 ? 's' : ''} to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {/* Files Summary */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 dark:text-white mb-3">Files to Share</h3>
            <div className="space-y-2">
              {files.slice(0, 3).map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {file.type.includes('pdf') ? '📄' :
                       file.type.includes('image') ? '🖼️' :
                       file.type.includes('video') ? '🎥' :
                       file.type.includes('audio') ? '🎵' :
                       file.encrypted ? '🔒' : '📄'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white truncate max-w-48">
                        {file.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatFileSize(file.size)} • {file.encrypted ? 'Encrypted' : 'Plain'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {files.length > 3 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-2">
                  +{files.length - 3} more file{files.length - 3 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Total size: {formatFileSize(getTotalSize())}
            </div>
          </div>

          {/* Recipients Summary */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 dark:text-white mb-3">Recipients</h3>
            <div className="grid grid-cols-1 gap-2">
              {recipientDetails.slice(0, 5).map((recipient) => (
                <div key={recipient.email} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      recipient.status === 'valid' ? 'bg-green-500' :
                      recipient.status === 'not-registered' ? 'bg-orange-500' :
                      'bg-red-500'
                    }`} />
                    <span className="text-sm text-gray-800 dark:text-white truncate max-w-48">
                      {recipient.name || recipient.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {recipient.isOnline && (
                      <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                        Online
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${
                      recipient.status === 'valid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      recipient.status === 'not-registered' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {recipient.status === 'valid' ? 'Registered' :
                       recipient.status === 'not-registered' ? 'Email Only' :
                       'Invalid'}
                    </span>
                  </div>
                </div>
              ))}
              {recipientDetails.length > 5 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-2">
                  +{recipientDetails.length - 5} more recipient{recipientDetails.length - 5 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-green-600">
                {getValidRecipients()} valid
              </span>
              {getInvalidRecipients() > 0 && (
                <span className="text-red-600">
                  {getInvalidRecipients()} invalid
                </span>
              )}
            </div>
          </div>

          {/* Notification Options */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 dark:text-white mb-3">Notification Settings</h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={shareOptions.sendNotifications}
                  onChange={(e) => setShareOptions(prev => ({
                    ...prev,
                    sendNotifications: e.target.checked
                  }))}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Send notifications to recipients
                </span>
              </label>

              {shareOptions.sendNotifications && (
                <div className="ml-7 space-y-2">
                  <div className="flex gap-4">
                    {[
                      { key: 'email', label: '📧 Email', description: 'Reliable delivery' },
                      { key: 'push', label: '📱 Push', description: 'Instant notification' },
                      { key: 'sms', label: '💬 SMS', description: 'SMS fallback' }
                    ].map(({ key, label, description }) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={shareOptions.notificationChannels.includes(key as 'email' | 'push' | 'sms')}
                          onChange={(e) => {
                            const channel = key as 'email' | 'push' | 'sms'
                            setShareOptions(prev => ({
                              ...prev,
                              notificationChannels: e.target.checked
                                ? [...prev.notificationChannels, channel]
                                : prev.notificationChannels.filter(c => c !== channel)
                            }))
                          }}
                          className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div className="text-xs">
                          <div className="font-medium">{label}</div>
                          <div className="text-gray-500">{description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Link Expiration
                  </label>
                  <select
                    value={shareOptions.expirationHours || ''}
                    onChange={(e) => setShareOptions(prev => ({
                      ...prev,
                      expirationHours: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Never expires</option>
                    <option value="1">1 hour</option>
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                    <option value="720">30 days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Max Downloads
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={shareOptions.maxDownloads || ''}
                    onChange={(e) => setShareOptions(prev => ({
                      ...prev,
                      maxDownloads: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Password Protection (Optional)
                </label>
                <input
                  type="password"
                  value={shareOptions.password || ''}
                  onChange={(e) => setShareOptions(prev => ({
                    ...prev,
                    password: e.target.value || undefined
                  }))}
                  placeholder="Leave empty for no password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={shareOptions.requireConfirmation}
                  onChange={(e) => setShareOptions(prev => ({
                    ...prev,
                    requireConfirmation: e.target.checked
                  }))}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Require recipient confirmation before download
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getInvalidRecipients() > 0 && (
              <span className="text-red-600 font-medium">
                ⚠️ {getInvalidRecipients()} invalid recipient{getInvalidRecipients() !== 1 ? 's' : ''} will be skipped
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming || getValidRecipients() === 0 || isLoading}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isConfirming ? (
                <>
                  <Loading size="sm" />
                  Sending...
                </>
              ) : (
                <>
                  📤 Send Files
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}