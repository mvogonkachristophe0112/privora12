"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"

export function Navbar() {
  const { data: session } = useSession()
  const { t } = useLanguage()

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold text-white hover:text-blue-100 transition-colors">
            Privora12
          </Link>

          <div className="flex items-center space-x-6">
            <Link href="/" className="hover:text-primary-200 transition-colors">
              {t('nav.home')}
            </Link>

            {session ? (
              <>
                <Link href="/dashboard" className="hover:text-primary-200 transition-colors">
                  {t('nav.dashboard')}
                </Link>
                <Link href="/upload" className="hover:text-primary-200 transition-colors">
                  {t('nav.upload')}
                </Link>
                <Link href="/receive" className="hover:text-primary-200 transition-colors">
                  {t('common.download')}
                </Link>
                <Link href="/manager" className="hover:text-primary-200 transition-colors">
                  {t('nav.manager')}
                </Link>
                <Link href="/crychat" className="hover:text-primary-200 transition-colors">
                  {t('nav.crychat')}
                </Link>
                <Link href="/settings" className="hover:text-primary-200 transition-colors">
                  {t('nav.settings')}
                </Link>
                <Link href="/about" className="hover:text-primary-200 transition-colors">
                  {t('nav.about')}
                </Link>
                <Link href="/help" className="hover:text-primary-200 transition-colors">
                  {t('nav.help')}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="bg-secondary-500 hover:bg-secondary-600 px-4 py-2 rounded transition-colors"
                >
                  {t('common.logout')}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-primary-200 transition-colors">
                  {t('nav.login')}
                </Link>
                <Link href="/register" className="bg-secondary-500 hover:bg-secondary-600 px-4 py-2 rounded transition-colors">
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}