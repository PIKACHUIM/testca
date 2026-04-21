import { useEffect, useState, useCallback } from 'react'

export type PageKey =
  | 'overview'
  | 'root'
  | 'sub'
  | 'apply'
  | 'docs'
  | 'cps'
  | 'privacy'
  | 'license'

const VALID: PageKey[] = [
  'overview',
  'root',
  'sub',
  'apply',
  'docs',
  'cps',
  'privacy',
  'license',
]

const parseHash = (): PageKey => {
  const raw = window.location.hash.replace(/^#\/?/, '').trim()
  if (VALID.includes(raw as PageKey)) return raw as PageKey
  return 'overview'
}

export const useHashRoute = (): [PageKey, (k: PageKey) => void] => {
  const [page, setPage] = useState<PageKey>(() => parseHash())

  useEffect(() => {
    const onChange = () => setPage(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const nav = useCallback((k: PageKey) => {
    window.location.hash = `/${k}`
  }, [])

  return [page, nav]
}
