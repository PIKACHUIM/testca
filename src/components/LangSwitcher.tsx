import React from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { LANGS } from '../i18n/messages'

const LangSwitcher: React.FC = () => {
  const { lang, setLang } = useI18n()
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          className={`seg__btn${lang === l.value ? ' is-active' : ''}`}
          onClick={() => setLang(l.value)}
          aria-pressed={lang === l.value}
        >
          {l.short}
        </button>
      ))}
    </div>
  )
}

export default LangSwitcher
