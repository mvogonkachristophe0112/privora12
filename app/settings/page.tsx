"use client"

import { useState, useEffect } from "react"

export default function Settings() {
  const [theme, setTheme] = useState("auto")
  const [language, setLanguage] = useState("en")
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    fileShares: true,
    security: true
  })

  // Email notification preferences
  const [emailPreferences, setEmailPreferences] = useState({
    emailNotifications: 'IMMEDIATE',
    emailNotificationTypes: ['NEW_SHARES'],
    emailUnsubscribed: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load email preferences on component mount
  useEffect(() => {
    const loadEmailPreferences = async () => {
      try {
        const response = await fetch('/api/notifications/preferences')
        if (response.ok) {
          const data = await response.json()
          setEmailPreferences(data)
        }
      } catch (error) {
        console.error('Failed to load email preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    loadEmailPreferences()
  }, [])

  // Save email preferences
  const saveEmailPreferences = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPreferences),
      })

      if (response.ok) {
        alert('Email preferences saved successfully!')
      } else {
        alert('Failed to save email preferences')
      }
    } catch (error) {
      console.error('Failed to save email preferences:', error)
      alert('Failed to save email preferences')
    } finally {
      setSaving(false)
    }
  }

  // Handle notification type toggle
  const toggleNotificationType = (type: string) => {
    setEmailPreferences(prev => ({
      ...prev,
      emailNotificationTypes: prev.emailNotificationTypes.includes(type)
        ? prev.emailNotificationTypes.filter(t => t !== type)
        : [...prev.emailNotificationTypes, type]
    }))
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Settings</h1>

          <div className="space-y-8">
            {/* Profile Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Display Name</label>
                  <input
                    type="text"
                    defaultValue="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    defaultValue="john.doe@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* Theme Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Theme</h2>
              <div className="flex gap-4">
                {["light", "dark", "auto"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setTheme(option)}
                    className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                      theme === option
                        ? "bg-primary-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Language</h2>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="zh">中文</option>
              </select>
            </div>

            {/* Email Notification Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Email Notifications</h2>

              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading preferences...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Email Frequency */}
                  <div>
                    <h3 className="font-medium mb-3">Email Notification Frequency</h3>
                    <div className="flex gap-4">
                      {[
                        { value: 'IMMEDIATE', label: 'Immediate', desc: 'Send emails right away' },
                        { value: 'DAILY', label: 'Daily Digest', desc: 'Send daily summary' },
                        { value: 'WEEKLY', label: 'Weekly Digest', desc: 'Send weekly summary' },
                        { value: 'DISABLED', label: 'Disabled', desc: 'No email notifications' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setEmailPreferences(prev => ({ ...prev, emailNotifications: option.value }))}
                          className={`px-4 py-3 rounded-lg border transition-colors ${
                            emailPreferences.emailNotifications === option.value
                              ? "bg-primary-500 text-white border-primary-500"
                              : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                          }`}
                        >
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs opacity-75">{option.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notification Types */}
                  <div>
                    <h3 className="font-medium mb-3">Notification Types</h3>
                    <div className="space-y-3">
                      {[
                        { value: 'NEW_SHARES', label: 'New File Shares', desc: 'When someone shares files with you' },
                        { value: 'SHARE_UPDATES', label: 'Share Updates', desc: 'When shared files are modified' },
                        { value: 'EXPIRATIONS', label: 'Expiration Warnings', desc: 'When shared files are about to expire' }
                      ].map((type) => (
                        <div key={type.value} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                          <div>
                            <h4 className="font-medium">{type.label}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{type.desc}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={emailPreferences.emailNotificationTypes.includes(type.value)}
                              onChange={() => toggleNotificationType(type.value)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Unsubscribe */}
                  <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div>
                      <h4 className="font-medium text-red-800 dark:text-red-200">Unsubscribe from All Emails</h4>
                      <p className="text-sm text-red-600 dark:text-red-300">
                        Stop receiving all email notifications from Privora12
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailPreferences.emailUnsubscribed}
                        onChange={(e) => setEmailPreferences(prev => ({ ...prev, emailUnsubscribed: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={saveEmailPreferences}
                      disabled={saving}
                      className="bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Email Preferences'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Privacy & Security</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <button className="bg-secondary-500 hover:bg-secondary-600 text-white px-4 py-2 rounded-lg text-sm">
                    Enable 2FA
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Download Data</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Download a copy of all your data
                    </p>
                  </div>
                  <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                    Download
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-red-600">Delete Account</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}