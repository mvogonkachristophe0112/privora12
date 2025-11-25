"use client"

import { useState } from "react"

export default function Help() {
  const [activeSection, setActiveSection] = useState("getting-started")
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [feedbackType, setFeedbackType] = useState("")

  const sections = [
    { id: "getting-started", title: "Getting Started", icon: "🚀" },
    { id: "uploading", title: "Uploading Files", icon: "📤" },
    { id: "sharing", title: "File Sharing", icon: "🔗" },
    { id: "chat", title: "Encrypted Chat", icon: "💬" },
    { id: "settings", title: "Settings & Preferences", icon: "⚙️" },
    { id: "security", title: "Security Features", icon: "🔒" },
    { id: "troubleshooting", title: "Troubleshooting", icon: "🔧" }
  ]

  const handleRating = (stars: number) => {
    setRating(stars)
  }

  const submitFeedback = () => {
    // In a real app, this would send to an API
    alert(`Thank you for your ${feedbackType} feedback! Rating: ${rating} stars\nFeedback: ${feedback}`)
    setRating(0)
    setFeedback("")
    setFeedbackType("")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Help Center
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Learn how to use Privora12 and get help when you need it
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sticky top-8">
                <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Help Topics</h2>
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                        activeSection === section.id
                          ? "bg-blue-500 text-white shadow-md"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="mr-3">{section.icon}</span>
                      {section.title}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                {/* Getting Started */}
                {activeSection === "getting-started" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">🚀 Getting Started with Privora12</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">1. Create Your Account</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Click "Sign Up" in the navigation bar and fill out the registration form with your email, name, and a secure password.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <p className="text-blue-800 dark:text-blue-200 text-sm">
                            💡 <strong>Tip:</strong> Use a strong password with at least 8 characters, including uppercase, lowercase, numbers, and symbols.
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">2. Verify Your Email</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Check your email for a verification link and click it to activate your account.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">3. Set Up Your Profile</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Go to Settings to customize your theme, language preferences, and security options.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">4. Start Using Privora12</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Upload your first file, explore the dashboard, or start a secure chat conversation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Uploading Files */}
                {activeSection === "uploading" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">📤 Uploading Files</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Choose File Type</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Select the type of file you want to upload from the available categories:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
                          <li><strong>Documents:</strong> PDF, Word, Excel, PowerPoint files</li>
                          <li><strong>Photos:</strong> Images and pictures (JPG, PNG, GIF, etc.)</li>
                          <li><strong>Videos:</strong> Video files and movies</li>
                          <li><strong>Audio:</strong> Music and sound files</li>
                          <li><strong>Archives:</strong> Compressed files (ZIP, RAR, etc.)</li>
                          <li><strong>Other:</strong> Any other file type</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Upload Process</h3>
                        <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
                          <li>Select your file type category</li>
                          <li>Click "Choose File" or drag and drop your file</li>
                          <li>Review file details and enable encryption (recommended)</li>
                          <li>Click "Upload File Securely" to complete</li>
                        </ol>
                      </div>

                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <p className="text-green-800 dark:text-green-200 text-sm">
                          ✅ <strong>Security Note:</strong> All files are automatically encrypted with AES-256 before upload. Your files remain secure even if our servers are compromised.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Sharing */}
                {activeSection === "sharing" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">🔗 File Sharing</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Share Options</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium mb-2">View Only</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Recipients can only view the file</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Download Allowed</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Recipients can download the file</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Password Protected</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Requires password to access</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Expiration Date</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Link expires after set time</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">How to Share</h3>
                        <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
                          <li>Go to your File Manager</li>
                          <li>Select the file you want to share</li>
                          <li>Click the "Share" button</li>
                          <li>Configure sharing permissions</li>
                          <li>Copy and send the secure link</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {/* Encrypted Chat */}
                {activeSection === "chat" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">💬 Encrypted Chat</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Chat Rooms</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Privora12 offers different types of chat rooms:
                        </p>
                        <ul className="space-y-2 text-gray-600 dark:text-gray-400 ml-4">
                          <li><strong>General:</strong> Public room for all users</li>
                          <li><strong>Private Rooms:</strong> Create custom rooms with specific users</li>
                          <li><strong>Direct Messages:</strong> One-on-one conversations</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Using Chat</h3>
                        <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
                          <li>Navigate to the Chat section</li>
                          <li>Select or create a chat room</li>
                          <li>Type your message in the input field</li>
                          <li>Press Enter or click Send</li>
                          <li>All messages are automatically encrypted</li>
                        </ol>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <p className="text-blue-800 dark:text-blue-200 text-sm">
                          🔒 <strong>Privacy:</strong> All chat messages are end-to-end encrypted and can only be read by intended recipients.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings */}
                {activeSection === "settings" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">⚙️ Settings & Preferences</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Theme Settings</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Customize your interface appearance:
                        </p>
                        <ul className="space-y-2 text-gray-600 dark:text-gray-400 ml-4">
                          <li><strong>Light:</strong> Clean, bright interface</li>
                          <li><strong>Dark:</strong> Easy on the eyes in low light</li>
                          <li><strong>Auto:</strong> Automatically switches based on system preference</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Language Options</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Privora12 supports multiple languages. Change your language preference in Settings to see the interface in your preferred language.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Account Settings</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Update your profile information, change password, and manage security settings from the Settings page.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Security */}
                {activeSection === "security" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">🔒 Security Features</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">File Encryption</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          All uploaded files are automatically encrypted using AES-256 encryption. Encryption happens on your device before files are sent to our servers.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Secure Authentication</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          We use industry-standard authentication with secure password hashing and JWT tokens for session management.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Access Control</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Granular permissions allow you to control exactly who can access your files and what they can do with them.
                        </p>
                      </div>

                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                          🛡️ <strong>Best Practices:</strong> Always use strong passwords, enable 2FA when available, and be cautious when sharing sensitive files.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Troubleshooting */}
                {activeSection === "troubleshooting" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">🔧 Troubleshooting</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Common Issues</h3>
                        <div className="space-y-4">
                          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Upload Fails</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Check file size (max 100MB) and ensure stable internet connection.</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Can't Access Shared File</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Verify the link hasn't expired and you have the correct permissions.</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Chat Messages Not Sending</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Check your internet connection and try refreshing the page.</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Contact Support</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          If you can't resolve an issue using this help guide, please use the feedback form below to contact our support team.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback Section */}
              <div className="mt-8 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">💬 Share Your Feedback</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Rate Your Experience</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRating(star)}
                          className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Feedback Type</label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    >
                      <option value="">Select feedback type</option>
                      <option value="bug">Report a Bug</option>
                      <option value="feature">Feature Request</option>
                      <option value="improvement">Suggest Improvement</option>
                      <option value="general">General Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Your Message</label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Tell us about your experience or report an issue..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 resize-none"
                    />
                  </div>

                  <button
                    onClick={submitFeedback}
                    disabled={!rating || !feedbackType || !feedback.trim()}
                    className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none shadow-lg hover:shadow-xl disabled:shadow-none"
                  >
                    Submit Feedback
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}