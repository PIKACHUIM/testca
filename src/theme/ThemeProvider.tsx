import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type Theme = 'dark' | 'light'
export type ThemePref = Theme | 'system'

const STORAGE_KEY = 'pika_theme'

const systemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const readPref = (): ThemePref => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

const resolve = (p: ThemePref): Theme => (p === 'system' ? systemTheme() : p)

interface ThemeCtx {
  pref: ThemePref
  theme: Theme
  setPref: (p: ThemePref) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref())
  const [theme, setTheme] = useState<Theme>(() => resolve(readPref()))

  useEffect(() => {
    setTheme(resolve(pref))
    try {
      window.localStorage.setItem(STORAGE_KEY, pref)
    } catch {
      /* ignore */
    }
  }, [pref])

  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setTheme(systemTheme())
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [pref])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setPref = useCallback((p: ThemePref) => setPrefState(p), [])

  const value = useMemo(() => ({ pref, theme, setPref }), [pref, theme, setPref])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = (): ThemeCtx => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be inside <ThemeProvider>')
  return ctx
}
