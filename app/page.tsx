"use client"

import { useState } from "react"
import { useLanguage } from "@/lib/language-context"

export default function Home() {
  const { t } = useLanguage()
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)

  const features = {
    encryption: {
      title: "End-to-End Encryption",
      description: "Your files are encrypted on your device before uploading. Only you control access to your data.",
      details: "End-to-end encryption means your files are encrypted on your device using AES-256 encryption before they ever leave your computer. The encryption keys are generated locally and never stored on our servers. This ensures that even if our servers were compromised, your files would remain secure and unreadable without your encryption key."
    },
    sharing: {
      title: "Secure File Sharing",
      description: "Share files with granular permissions. Set view-only access, download rights, or password protection.",
      details: "Our secure file sharing system allows you to control exactly who can access your files and what they can do with them. You can set permissions for individual users or create shareable links with specific access levels. Options include view-only access, download permissions, password protection, and expiration dates for shared links."
    },
    chat: {
      title: "Encrypted Chat",
      description: "Communicate securely with real-time encrypted messaging. Create private rooms or direct chats.",
      details: "CrypChat provides end-to-end encrypted messaging for secure communication. All messages are encrypted before transmission and can only be decrypted by the intended recipients. Create private chat rooms for team collaboration or direct message individuals. Messages are stored securely and can be deleted at any time."
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-blue-950 dark:via-gray-900 dark:to-green-950">
      <main className="container mx-auto px-4 py-16">
        <section className="text-center py-12 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent leading-tight">
              {t('home.title')}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl mb-8 text-gray-700 dark:text-gray-300 font-light max-w-3xl mx-auto">
              {t('home.subtitle')}
            </p>
            <p className="text-base sm:text-lg mb-8 md:mb-12 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed px-4">
              {t('home.description')}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 px-4">
              <a href="/register" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 text-center">
                Get Started Free
              </a>
              <a href="#features" className="bg-white dark:bg-gray-800 border-2 border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-gray-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold transition-all duration-300 text-center">
                Learn More
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="py-12 md:py-20 px-4">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-800 dark:text-white">Why Choose Privora12?</h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 px-4">Advanced security features for modern privacy needs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <div
              className="group bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 dark:border-gray-700 cursor-pointer"
              onClick={() => setSelectedFeature('encryption')}
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform mx-auto md:mx-0">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-gray-800 dark:text-white text-center md:text-left">End-to-End Encryption</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm md:text-base text-center md:text-left">
                Your files are encrypted on your device before uploading. Only you control access to your data.
              </p>
              <div className="mt-4 text-center md:text-left">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">Learn more →</span>
              </div>
            </div>

            <div
              className="group bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 dark:border-gray-700 cursor-pointer"
              onClick={() => setSelectedFeature('sharing')}
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-green-400 to-green-500 rounded-xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform mx-auto md:mx-0">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-gray-800 dark:text-white text-center md:text-left">Secure File Sharing</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm md:text-base text-center md:text-left">
                Share files with granular permissions. Set view-only access, download rights, or password protection.
              </p>
              <div className="mt-4 text-center md:text-left">
                <span className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline">Learn more →</span>
              </div>
            </div>

            <div
              className="group bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 dark:border-gray-700 cursor-pointer"
              onClick={() => setSelectedFeature('chat')}
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-blue-400 to-green-500 rounded-xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform mx-auto md:mx-0">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-gray-800 dark:text-white text-center md:text-left">Encrypted Chat</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm md:text-base text-center md:text-left">
                Communicate securely with real-time encrypted messaging. Create private rooms or direct chats.
              </p>
              <div className="mt-4 text-center md:text-left">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">Learn more →</span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-20 bg-gradient-to-r from-blue-600 to-green-600 rounded-3xl text-white text-center mx-4 md:mx-0">
          <div className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6">Ready to Secure Your Digital Life?</h2>
            <p className="text-lg sm:text-xl mb-8 opacity-90 px-4">
              Join thousands of users who trust Privora12 for their privacy needs.
            </p>
            <a href="/register" className="bg-white text-blue-600 hover:bg-gray-100 px-8 sm:px-10 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 inline-block">
              Start Your Free Account
            </a>
          </div>
        </section>

        {/* Feature Documentation Modal */}
        {selectedFeature && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedFeature(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedFeature === 'encryption' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                      selectedFeature === 'sharing' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                      'bg-gradient-to-r from-blue-400 to-green-500'
                    }`}>
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {selectedFeature === 'encryption' && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        )}
                        {selectedFeature === 'sharing' && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                        )}
                        {selectedFeature === 'chat' && (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        )}
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      {features[selectedFeature as keyof typeof features].title}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedFeature(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                    {features[selectedFeature as keyof typeof features].description}
                  </p>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">How It Works</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {features[selectedFeature as keyof typeof features].details}
                    </p>
                  </div>

                  {selectedFeature === 'encryption' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">Security Benefits</h3>
                      <ul className="space-y-2 text-blue-700 dark:text-blue-300">
                        <li>• AES-256 encryption standard</li>
                        <li>• Keys generated locally on your device</li>
                        <li>• Zero-knowledge architecture</li>
                        <li>• Files remain encrypted in transit and at rest</li>
                      </ul>
                    </div>
                  )}

                  {selectedFeature === 'sharing' && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">Sharing Options</h3>
                      <ul className="space-y-2 text-green-700 dark:text-green-300">
                        <li>• Granular permission controls</li>
                        <li>• Password-protected links</li>
                        <li>• Expiration dates for shared content</li>
                        <li>• View-only or download access</li>
                      </ul>
                    </div>
                  )}

                  {selectedFeature === 'chat' && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-3">Chat Features</h3>
                      <ul className="space-y-2 text-purple-700 dark:text-purple-300">
                        <li>• End-to-end encrypted messages</li>
                        <li>• Private and group chat rooms</li>
                        <li>• Real-time message delivery</li>
                        <li>• Message history and search</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setSelectedFeature(null)}
                    className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
