import React, { useEffect, useState } from 'react'
import type { PageKey } from '../hooks/useHashRoute'
import LangSwitcher from './LangSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'

const LABEL_KEYS: Record<PageKey, MessageKey> = {
  overview: 'rail.overview',
  root: 'rail.root',
  sub: 'rail.sub',
  apply: 'rail.apply',
  docs: 'rail.docs',
  cps: 'rail.cps',
  privacy: 'rail.privacy',
  license: 'rail.license',
}

const fmtTime = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(
    d.getUTCSeconds(),
  ).padStart(2, '0')} UTC`

interface Props {
  page: PageKey
}

const AppBar: React.FC<Props> = ({ page }) => {
  const { t } = useI18n()
  const [now, setNow] = useState(() => fmtTime(new Date()))

  useEffect(() => {
    const tm = window.setInterval(() => setNow(fmtTime(new Date())), 1000)
    return () => window.clearInterval(tm)
  }, [])

  return (
    <header className="appbar">
      <div className="appbar__crumbs">
        <span>{t('bar.root')}</span>
        <span className="sep">/</span>
        <span className="current">{t(LABEL_KEYS[page])}</span>
      </div>

      <div className="appbar__tools">
        <span className="appbar__clk" aria-label="clock">
          <span className="dot" aria-hidden />
          {now}
        </span>
        <ThemeSwitcher />
        <LangSwitcher />
      </div>
    </header>
  )
}

export default AppBar
