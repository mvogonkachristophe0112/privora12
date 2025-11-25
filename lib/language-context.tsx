"use client"

import { createContext, useContext, useEffect, useState } from 'react'

type Language = 'en' | 'fr' | 'zh'

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Import translations
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'
import zh from '@/locales/zh.json'

const translations = { en, fr, zh }

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    // Load language from localStorage
    const savedLanguage = localStorage.getItem('privora12-language') as Language
    if (savedLanguage && ['en', 'fr', 'zh'].includes(savedLanguage)) {
      setLanguageState(savedLanguage)
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0]
      if (browserLang === 'fr') {
        setLanguageState('fr')
      } else if (browserLang === 'zh') {
        setLanguageState('zh')
      } else {
        setLanguageState('en')
      }
    }
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem('privora12-language', newLanguage)
  }

  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = translations[language]

    for (const k of keys) {
      value = value?.[k]
    }

    return value || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}