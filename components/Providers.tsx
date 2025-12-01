"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/lib/theme-context"
import { LanguageProvider } from "@/lib/language-context"
import { PresenceProvider } from "@/lib/presence-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LanguageProvider>
          <PresenceProvider>
            {children}
          </PresenceProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}