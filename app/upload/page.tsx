"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { encryptFile, generateKey } from "@/lib/crypto"

export default function Upload() {
  const { data: session } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [encrypt, setEncrypt] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [message, setMessage] = useState("")
  const [selectedType, setSelectedType] = useState<string>("")
  const [encryptionKey, setEncryptionKey] = useState("")
  const [customKey, setCustomKey] = useState("")
  const [useCustomKey, setUseCustomKey] = useState(false)
  const [recipients, setRecipients] = useState<string[]>([])
  const [newRecipient, setNewRecipient] = useState("")
  const [shareMode, setShareMode] = useState<"upload" | "share">("upload")

  const fileTypes = [
    {
      id: "documents",
      name: "Documents",
      icon: "📄",
      accept: ".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx",
      color: "blue",
      description: "PDF, Word, Excel, PowerPoint files"
    },
    {
      id: "photos",
      name: "Photos",
      icon: "🖼️",
      accept: ".jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp,.svg",
      color: "green",
      description: "Images and photos"
    },
    {
      id: "videos",
      name: "Videos",
      icon: "🎥",
      accept: ".mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.3gp",
      color: "purple",
      description: "Video files and movies"
    },
    {
      id: "audio",
      name: "Audio",
      icon: "🎵",
      accept: ".mp3,.wav,.flac,.aac,.ogg,.wma,.m4a",
      color: "red",
      description: "Music and audio files"
    },
    {
      id: "archives",
      name: "Archives",
      icon: "📦",
      accept: ".zip,.rar,.7z,.tar,.gz,.bz2",
      color: "yellow",
      description: "Compressed files and archives"
    },
    {
      id: "other",
      name: "Other",
      icon: "📄",
      accept: "*",
      color: "gray",
      description: "Any other file type"
    }
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setMessage("")
    }
  }

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId)
    setFile(null)
    setMessage("")
    setEncryptionKey("")
    setCustomKey("")
    setUseCustomKey(false)
    setRecipients([])
    setNewRecipient("")
  }

  const generateEncryptionKey = () => {
    const key = generateKey()
    setEncryptionKey(key)
    setCustomKey("")
    setUseCustomKey(false)
  }

  const addRecipient = () => {
    if (newRecipient.trim() && !recipients.includes(newRecipient.trim())) {
      setRecipients([...recipients, newRecipient.trim()])
      setNewRecipient("")
    }
  }

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email))
  }

  const handleUpload = async () => {
    if (!file) return

    // Validation for share mode
    if (shareMode === "share" && recipients.length === 0) {
      setMessage("Please add at least one recipient for sharing")
      return
    }

    // Validation for encryption key
    if (encrypt && !encryptionKey && !customKey) {
      setMessage("Please generate or enter an encryption key")
      return
    }

    setUploading(true)
    setMessage("")
    setUploadProgress(0)

    try {
      let fileData = await file.arrayBuffer()
      let finalEncryptionKey = ""

      // Show encryption progress
      setMessage("Preparing file...")

      if (encrypt) {
        if (useCustomKey && customKey) {
          finalEncryptionKey = customKey
        } else if (encryptionKey) {
          finalEncryptionKey = encryptionKey
        } else {
          finalEncryptionKey = generateKey()
        }

        setMessage("Encrypting file...")
        const encrypted = encryptFile(fileData, finalEncryptionKey)
        fileData = new TextEncoder().encode(encrypted).buffer
      }

      setMessage("Uploading to secure storage...")

      const formData = new FormData()
      formData.append('file', new Blob([fileData]), file.name)
      formData.append('type', selectedType)
      formData.append('encrypt', encrypt.toString())
      formData.append('encryptionKey', finalEncryptionKey)
      formData.append('recipients', JSON.stringify(recipients))
      formData.append('shareMode', shareMode)

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        const successMessage = shareMode === "share"
          ? "File uploaded and shared successfully!"
          : "File uploaded successfully!"
        setMessage(successMessage)
        setUploadProgress(100)

        // Reset form
        setFile(null)
        setSelectedType("")
        setEncryptionKey("")
        setCustomKey("")
        setUseCustomKey(false)
        setRecipients([])
        setNewRecipient("")
      } else {
        const errorData = await res.json().catch(() => ({}))
        setMessage(errorData.error || "Upload failed")
      }
    } catch (error) {
      console.error('Upload error:', error)
      setMessage("Upload failed. Please try again.")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const getAcceptString = (typeId: string) => {
    const type = fileTypes.find(t => t.id === typeId)
    return type ? type.accept : "*"
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">Please login to upload files</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Upload Files</h1>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            {/* File Type Selection */}
            <div className="mb-8">
              <label className="block text-lg font-semibold mb-4">What type of file are you uploading?</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {fileTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    className={`p-4 border-2 rounded-lg transition-all hover:scale-105 ${
                      selectedType === type.id
                        ? `border-${type.color}-500 bg-${type.color}-50 dark:bg-${type.color}-900/20`
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">{type.icon}</div>
                      <span className="font-medium block">{type.name}</span>
                      <span className="text-xs text-gray-500 mt-1">{type.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* File Selection */}
            {selectedType && (
              <div className="mb-8">
                <label className="block text-lg font-semibold mb-4">
                  Choose Your {fileTypes.find(t => t.id === selectedType)?.name} File
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept={getAcceptString(selectedType)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-6xl mb-4">📁</div>
                    <p className="text-lg mb-2">Click to select a file or drag and drop</p>
                    <p className="text-sm text-gray-500">
                      Supported formats: {fileTypes.find(t => t.id === selectedType)?.accept.replace(/\./g, "").toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-500">Maximum file size: 100MB</p>
                  </label>
                </div>
                {file && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {fileTypes.find(t => t.id === selectedType)?.icon}
                      </span>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-600">
                          Size: {(file.size / 1024 / 1024).toFixed(2)} MB •
                          Type: {file.type || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upload Options */}
            {file && (
              <div className="mb-8 space-y-6">
                {/* Mode Selection */}
                <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <button
                    onClick={() => setShareMode("upload")}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      shareMode === "upload"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500"
                    }`}
                  >
                    📤 Just Upload
                  </button>
                  <button
                    onClick={() => setShareMode("share")}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      shareMode === "share"
                        ? "bg-green-500 text-white shadow-md"
                        : "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500"
                    }`}
                  >
                    🔗 Upload & Share
                  </button>
                </div>

                {/* Encryption Settings */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={encrypt}
                        onChange={(e) => setEncrypt(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div>
                        <span className="font-medium text-blue-800 dark:text-blue-200">Encrypt on Upload</span>
                        <p className="text-sm text-blue-600 dark:text-blue-300">Secure your file with AES-256 encryption</p>
                      </div>
                    </div>
                    <span className="text-green-600 font-medium">🔒 Recommended</span>
                  </div>

                  {encrypt && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                      <h4 className="font-medium mb-3 text-gray-800 dark:text-white">Encryption Key</h4>

                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <button
                            onClick={generateEncryptionKey}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                          >
                            🔑 Generate Secure Key
                          </button>
                          <button
                            onClick={() => setUseCustomKey(!useCustomKey)}
                            className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                              useCustomKey
                                ? "bg-blue-500 text-white"
                                : "bg-gray-500 hover:bg-gray-600 text-white"
                            }`}
                          >
                            ✏️ Custom Key
                          </button>
                        </div>

                        {encryptionKey && !useCustomKey && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Generated Key:</p>
                            <p className="text-xs font-mono bg-white dark:bg-gray-700 p-2 rounded border text-green-700 dark:text-green-300 break-all">
                              {encryptionKey}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              ⚠️ Save this key! You'll need it to decrypt the file later.
                            </p>
                          </div>
                        )}

                        {useCustomKey && (
                          <div>
                            <input
                              type="password"
                              value={customKey}
                              onChange={(e) => setCustomKey(e.target.value)}
                              placeholder="Enter your custom encryption key"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Minimum 8 characters recommended for security
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recipient Selection - Only show in share mode */}
                {shareMode === "share" && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium mb-3 text-green-800 dark:text-green-200">Select Recipients</h4>

                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newRecipient}
                          onChange={(e) => setNewRecipient(e.target.value)}
                          placeholder="Enter recipient email"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700"
                        />
                        <button
                          onClick={addRecipient}
                          disabled={!newRecipient.trim()}
                          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Add
                        </button>
                      </div>

                      {recipients.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Recipients:</p>
                          {recipients.map((email, index) => (
                            <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded border">
                              <span className="text-sm">{email}</span>
                              <button
                                onClick={() => removeRecipient(email)}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {recipients.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No recipients added yet</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Advanced Settings
                  </button>
                  <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Bulk Upload
                  </button>
                  <button className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    Share Settings
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div className={`mb-6 p-4 rounded-lg ${
                message.includes("successfully")
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}>
                <div className="flex items-center gap-2">
                  {message.includes("successfully") ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className={`font-medium ${
                    message.includes("successfully") ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
                  }`}>
                    {message}
                  </span>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {uploading && (
              <div className="mb-6">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  {uploadProgress}% complete
                </p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading || (shareMode === "share" && recipients.length === 0) || (encrypt && !encryptionKey && !customKey)}
              className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-xl font-semibold transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none shadow-lg hover:shadow-xl disabled:shadow-none text-lg"
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {shareMode === "share" ? "Uploading & Sharing..." : "Uploading..."}
                </div>
              ) : (
                shareMode === "share" ? "Upload & Share Securely" : "Upload File Securely"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}