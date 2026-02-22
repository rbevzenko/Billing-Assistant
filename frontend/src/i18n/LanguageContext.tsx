import { useEffect, useState } from 'react'
import { LanguageContext, TRANSLATIONS } from './translations'
import type { AppLanguage } from './translations'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    const stored = localStorage.getItem('billing_language')
    return stored === 'en' ? 'en' : 'ru'
  })

  const setLang = (l: AppLanguage) => {
    setLangState(l)
    localStorage.setItem('billing_language', l)
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}
