"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/lib/theme-context"
import { LanguageProvider } from "@/lib/language-context"
import { PresenceProvider } from "@/lib/presence-context"
import { DownloadProvider } from "@/components/DownloadManager"
import { ToastProvider } from "@/components/Toast"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LanguageProvider>
          <PresenceProvider>
            <DownloadProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </DownloadProvider>
          </PresenceProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}