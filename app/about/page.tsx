"use client"

import { useState } from "react"

export default function About() {
  const [activeTab, setActiveTab] = useState("features")

  const features = [
    {
      icon: "🔒",
      title: "End-to-End Encryption",
      description: "All files and messages are encrypted using AES-256 encryption before transmission and storage."
    },
    {
      icon: "📁",
      title: "Secure File Sharing",
      description: "Share files with granular permissions, password protection, and expiration dates."
    },
    {
      icon: "💬",
      title: "Encrypted Chat",
      description: "Real-time encrypted messaging with private rooms and secure communication."
    },
    {
      icon: "🗂️",
      title: "File Management",
      description: "Organize, upload, download, and manage your files with advanced filtering options."
    },
    {
      icon: "🌐",
      title: "Multi-Language Support",
      description: "Available in English, French, and Chinese with easy language switching."
    },
    {
      icon: "🎨",
      title: "Theme Customization",
      description: "Choose between light, dark, and auto themes for your preferred interface."
    },
    {
      icon: "📱",
      title: "Responsive Design",
      description: "Works perfectly on desktop, tablet, and mobile devices."
    },
    {
      icon: "👥",
      title: "User Management",
      description: "Secure authentication with profile management and privacy controls."
    }
  ]

  const advancedFeatures = [
    {
      icon: "🤝",
      title: "Real-time Collaboration",
      description: "Live document editing, commenting system, approval workflows, and version control for team collaboration."
    },
    {
      icon: "🔄",
      title: "Cross-Device Sync",
      description: "Seamless session continuity, file sync status, offline queue, and device management across all platforms."
    },
    {
      icon: "🔗",
      title: "Third-Party Integrations",
      description: "Connect with Google Drive, Dropbox, Microsoft 365, Slack, Teams, and Zapier for enhanced workflows."
    },
    {
      icon: "🏢",
      title: "Enterprise Features",
      description: "SSO authentication, comprehensive audit logging, admin panel, user management, and compliance tools."
    },
    {
      icon: "🤖",
      title: "AI-Powered Features",
      description: "Smart file tagging, intelligent search, personalized recommendations, and automated organization."
    },
    {
      icon: "🚀",
      title: "Deployment Stability",
      description: "Error boundaries, performance monitoring, CI/CD pipeline, Docker containerization, and production optimization."
    },
    {
      icon: "🛡️",
      title: "Advanced Security",
      description: "Two-factor authentication framework, hardware security keys, and comprehensive security audit trails."
    },
    {
      icon: "👥",
      title: "Team Collaboration",
      description: "Shared workspaces, role-based permissions, bulk operations, and advanced team management tools."
    }
  ]

  const securityFeatures = [
    {
      title: "AES-256 Encryption",
      description: "Military-grade encryption for all sensitive data"
    },
    {
      title: "Zero-Knowledge Architecture",
      description: "Server never sees unencrypted data or encryption keys"
    },
    {
      title: "Secure Authentication",
      description: "NextAuth.js with JWT tokens and secure session management"
    },
    {
      title: "File Integrity",
      description: "SHA-256 hashing ensures files aren't tampered with"
    },
    {
      title: "Access Control",
      description: "Role-based permissions and granular sharing controls"
    },
    {
      title: "Audit Logging",
      description: "Complete activity logs for security monitoring"
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              About Privora12
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              A secure, encrypted file-sharing and communication platform built with privacy and security as top priorities.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-1 shadow-lg overflow-x-auto">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("features")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === "features"
                      ? "bg-blue-500 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Core Features
                </button>
                <button
                  onClick={() => setActiveTab("advanced")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === "advanced"
                      ? "bg-green-500 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Advanced Features
                </button>
                <button
                  onClick={() => setActiveTab("security")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === "security"
                      ? "bg-purple-500 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Security
                </button>
                <button
                  onClick={() => setActiveTab("enterprise")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === "enterprise"
                      ? "bg-orange-500 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Enterprise
                </button>
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === "ai"
                      ? "bg-indigo-500 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  AI Features
                </button>
                <button
                  onClick={() => setActiveTab("author")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === "author"
                      ? "bg-pink-500 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  About Author
                </button>
              </div>
            </div>
          </div>

          {/* Core Features Tab */}
          {activeTab === "features" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Advanced Features Tab */}
          {activeTab === "advanced" && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  🚀 Advanced Features
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                  Cutting-edge features that enhance productivity, collaboration, and user experience.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {advancedFeatures.map((feature, index) => (
                  <div key={index} className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-blue-200 dark:border-blue-800">
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-12">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
                    🔄 Cross-Device Synchronization
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Seamless session continuity across devices</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Real-time file sync status indicators</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Offline upload queue with auto-resume</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Device management and remote logout</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">
                    🤝 Real-time Collaboration
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Live document editing with conflict resolution</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Commenting system on files and folders</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Multi-step approval workflows</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>Version control with change tracking</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">
                  🔐 Security First Approach
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                  Privora12 implements multiple layers of security to ensure your data remains private and secure at all times.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {securityFeatures.map((security, index) => (
                  <div key={index} className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                      {security.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {security.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                      Security Notice
                    </h3>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                      While Privora12 implements strong security measures, no system is 100% secure.
                      Always use strong passwords and be cautious when sharing sensitive information.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enterprise Tab */}
          {activeTab === "enterprise" && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  🏢 Enterprise Features
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                  Advanced enterprise-grade features for organizations requiring enhanced security, compliance, and management capabilities.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
                  <div className="text-3xl mb-4">🔍</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Audit Logging
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Comprehensive activity logging with severity levels, user tracking, and compliance reporting.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="text-3xl mb-4">👥</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Admin Panel
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Complete user management, role assignment, analytics dashboard, and system monitoring.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                  <div className="text-3xl mb-4">🔐</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    SSO Integration
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Single sign-on support with enterprise identity providers and SAML authentication.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                  <div className="text-3xl mb-4">📊</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Compliance Tools
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    GDPR compliance, data export/deletion tools, and enterprise security standards.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
                  <div className="text-3xl mb-4">🛡️</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Advanced Security
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Two-factor authentication, hardware security keys, and comprehensive security monitoring.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                  <div className="text-3xl mb-4">📈</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Business Intelligence
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Usage analytics, productivity reports, and compliance dashboards for enterprise insights.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Enterprise-Ready Architecture</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold mb-2">🔧 Technical Features</h4>
                    <ul className="space-y-1 text-sm opacity-90">
                      <li>• Docker containerization for easy deployment</li>
                      <li>• CI/CD pipeline with automated testing</li>
                      <li>• Performance monitoring and error tracking</li>
                      <li>• RESTful API ecosystem for integrations</li>
                      <li>• Database optimization and backup systems</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-2">📋 Compliance & Security</h4>
                    <ul className="space-y-1 text-sm opacity-90">
                      <li>• SOC 2 Type II compliance framework</li>
                      <li>• GDPR and CCPA data protection</li>
                      <li>• End-to-end encryption standards</li>
                      <li>• Regular security audits and penetration testing</li>
                      <li>• Multi-region data residency options</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Features Tab */}
          {activeTab === "ai" && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  🤖 AI-Powered Features
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                  Intelligent automation and smart features that enhance productivity and user experience through artificial intelligence.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                  <div className="text-3xl mb-4">🏷️</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Smart File Tagging
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Automatic categorization based on content analysis, metadata, and usage patterns.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="text-3xl mb-4">🔍</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Intelligent Search
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    AI-powered search with relevance ranking, content understanding, and smart suggestions.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                  <div className="text-3xl mb-4">💡</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Smart Recommendations
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Personalized file suggestions based on usage patterns and collaborative filtering.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
                  <div className="text-3xl mb-4">📁</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Auto Organization
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Automated folder structure suggestions and intelligent file organization.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl p-6 border border-pink-200 dark:border-pink-800">
                  <div className="text-3xl mb-4">📊</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Content Analysis
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Advanced content understanding for better search results and categorization.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl p-6 border border-teal-200 dark:border-teal-800">
                  <div className="text-3xl mb-4">🎯</div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Usage Insights
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    AI-driven analytics on file usage patterns and productivity optimization.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">AI Technology Stack</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold mb-2">🧠 Machine Learning</h4>
                    <ul className="space-y-1 text-sm opacity-90">
                      <li>• Natural language processing</li>
                      <li>• Content classification algorithms</li>
                      <li>• Pattern recognition systems</li>
                      <li>• Recommendation engines</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-2">⚡ Performance</h4>
                    <ul className="space-y-1 text-sm opacity-90">
                      <li>• Edge computing optimization</li>
                      <li>• Real-time processing</li>
                      <li>• Caching and pre-computation</li>
                      <li>• Scalable AI infrastructure</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-2">🔒 Privacy-First AI</h4>
                    <ul className="space-y-1 text-sm opacity-90">
                      <li>• On-device processing where possible</li>
                      <li>• Federated learning approaches</li>
                      <li>• Privacy-preserving algorithms</li>
                      <li>• User consent and control</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Author Tab */}
          {activeTab === "author" && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                  <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-green-500 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">
                    👨‍💻
                  </div>
                  <h2 className="text-3xl font-bold mb-2 text-gray-800 dark:text-white">
                    MvogoNka Christophe
                  </h2>
                  <p className="text-lg text-blue-600 dark:text-blue-400 font-medium">
                    Cyber Security Student & Self-Improvement Enthusiast
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
                      🎓 Education & Expertise
                    </h3>
                    <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>Cyber Security Student with focus on encryption and data protection</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>Specialized in web application security and secure coding practices</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>Knowledge of modern encryption algorithms and security protocols</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>Experience with secure authentication and authorization systems</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
                      🚀 Mission & Vision
                    </h3>
                    <div className="space-y-4 text-gray-600 dark:text-gray-400">
                      <p>
                        As a passionate cyber security student, I believe that privacy and security should be
                        accessible to everyone. Privora12 was created to demonstrate how modern web applications
                        can prioritize user privacy while providing powerful functionality.
                      </p>
                      <p>
                        My goal is to contribute to a safer digital world by developing tools that empower
                        users to protect their digital lives and communicate securely.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
                      💡 Why Privora12?
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                      This project combines my passion for cyber security with practical application development.
                      Every feature is designed with security in mind, from end-to-end encryption to secure
                      authentication, ensuring users have full control over their data.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Call to Action */}
          <div className="text-center mt-12">
            <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-4">Ready to Experience Secure File Sharing?</h2>
              <p className="mb-6 opacity-90">
                Join thousands of users who trust Privora12 for their privacy needs.
              </p>
              <a
                href="/register"
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl inline-block"
              >
                Get Started Free
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}