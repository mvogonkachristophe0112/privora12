"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"
import { useNotifications } from "@/lib/notification-context"

export function Navbar() {
  const { data: session } = useSession()
  const { t } = useLanguage()
  const { newFileCount, clearNewFiles } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)

  const NavLink = ({ href, children, badge, onClick }: { href: string, children: React.ReactNode, badge?: number, onClick?: () => void }) => (
    <Link
      href={href}
      className="hover:text-primary-200 transition-colors text-sm lg:text-base relative"
      onClick={onClick}
    >
      {children}
      {badge && badge > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-xl md:text-2xl font-bold text-white hover:text-blue-100 transition-colors">
            Privora12
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link href="/" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
              {t('nav.home')}
            </Link>

            {session ? (
              <>
                <Link href="/dashboard" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  {t('nav.dashboard')}
                </Link>
                <Link href="/upload" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  {t('nav.upload')}
                </Link>
                <Link href="/connections" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  👥 Connections
                </Link>
                <NavLink
                  href="/receive"
                  badge={newFileCount}
                  onClick={clearNewFiles}
                >
                  {t('common.download')}
                </NavLink>
                <Link href="/manager" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  {t('nav.manager')}
                </Link>
                <Link href="/crychat" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  {t('nav.crychat')}
                </Link>
                <Link href="/settings" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  {t('nav.settings')}
                </Link>
                <Link href="/about" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  {t('nav.about')}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="bg-secondary-500 hover:bg-secondary-600 px-3 py-2 rounded transition-colors text-sm lg:text-base"
                >
                  {t('common.logout')}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-primary-200 transition-colors text-sm lg:text-base">
                  {t('nav.login')}
                </Link>
                <Link href="/register" className="bg-secondary-500 hover:bg-secondary-600 px-3 py-2 rounded transition-colors text-sm lg:text-base">
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white hover:text-primary-200 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t border-blue-500 mt-4 pt-4">
            <div className="flex flex-col space-y-3">
              <Link
                href="/"
                className="hover:text-primary-200 transition-colors py-2"
                onClick={() => setIsOpen(false)}
              >
                {t('nav.home')}
              </Link>

              {session ? (
                <>
                  <Link href="/dashboard" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    {t('nav.dashboard')}
                  </Link>
                  <Link href="/upload" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    {t('nav.upload')}
                  </Link>
                  <Link href="/connections" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    👥 Connections
                  </Link>
                  <Link
                    href="/receive"
                    className="hover:text-primary-200 transition-colors py-2 relative"
                    onClick={() => {
                      clearNewFiles()
                      setIsOpen(false)
                    }}
                  >
                    {t('common.download')}
                    {newFileCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 animate-pulse">
                        {newFileCount > 99 ? '99+' : newFileCount}
                      </span>
                    )}
                  </Link>
                  <Link href="/manager" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    {t('nav.manager')}
                  </Link>
                  <Link href="/crychat" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    {t('nav.crychat')}
                  </Link>
                  <Link href="/settings" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    {t('nav.settings')}
                  </Link>
                  <Link href="/about" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    {t('nav.about')}
                  </Link>
                  <button
                    onClick={() => {
                      signOut()
                      setIsOpen(false)
                    }}
                    className="bg-secondary-500 hover:bg-secondary-600 px-4 py-2 rounded transition-colors text-left"
                  >
                    {t('common.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-primary-200 transition-colors py-2" onClick={() => setIsOpen(false)}>
                    {t('nav.login')}
                  </Link>
                  <Link href="/register" className="bg-secondary-500 hover:bg-secondary-600 px-4 py-2 rounded transition-colors text-center" onClick={() => setIsOpen(false)}>
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}