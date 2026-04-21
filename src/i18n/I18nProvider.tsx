import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  detectDefaultLang,
  persistLang,
  translate,
  type Lang,
  type MessageKey,
} from './messages'

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  toggle: () => void
  t: (key: MessageKey) => string
}

const Ctx = createContext<I18nCtx | null>(null)

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => detectDefaultLang())

  // 初次渲染时同步 html lang
  useEffect(() => {
    persistLang(lang)
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
  }, [])

  const toggle = useCallback(() => {
    setLangState((prev) => (prev === 'zh' ? 'en' : 'zh'))
  }, [])

  const t = useCallback((key: MessageKey) => translate(lang, key), [lang])

  const value = useMemo(() => ({ lang, setLang, toggle, t }), [lang, setLang, toggle, t])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = (): I18nCtx => {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>')
  }
  return ctx
}
