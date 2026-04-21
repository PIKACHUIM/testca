import React from 'react'
import {
  FileProtectOutlined,
  LockOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
  GithubOutlined,
  FilePdfOutlined,
  FileMarkdownOutlined,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import type { PageKey } from '../hooks/useHashRoute'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import { withBase } from '../data/constants'

interface Doc {
  target: Extract<PageKey, 'cps' | 'privacy' | 'license'>
  slug: 'cps' | 'privacy' | 'license'
  titleKey: MessageKey
  descKey: MessageKey
  icon: React.ReactNode
  tone: string
}

const DOCS: Doc[] = [
  {
    target: 'cps',
    slug: 'cps',
    titleKey: 'docs.cps.title',
    descKey: 'docs.cps.desc',
    icon: <FileProtectOutlined />,
    tone: 'var(--pika)',
  },
  {
    target: 'privacy',
    slug: 'privacy',
    titleKey: 'docs.privacy.title',
    descKey: 'docs.privacy.desc',
    icon: <LockOutlined />,
    tone: 'var(--accent)',
  },
  {
    target: 'license',
    slug: 'license',
    titleKey: 'docs.license.title',
    descKey: 'docs.license.desc',
    icon: <FileTextOutlined />,
    tone: 'var(--violet)',
  },
]

interface Props {
  onNav: (k: PageKey) => void
}

const DocsPage: React.FC<Props> = ({ onNav }) => {
  const { t, lang } = useI18n()

  return (
    <div className="page">
      <PageHead
        num={t('docs.num')}
        title={
          <>
            {t('docs.title.a')}
            <em>{t('docs.title.em')}</em>
          </>
        }
        desc={t('docs.desc')}
        actions={
          <a
            className="btn"
            href="https://github.com/PIKACHUIM/testca"
            target="_blank"
            rel="noreferrer"
          >
            <GithubOutlined /> {t('docs.github')}
          </a>
        }
      />

      <div className="grid grid--3">
        {DOCS.map((d) => (
          <button
            key={d.target}
            type="button"
            onClick={() => onNav(d.target)}
            className="card"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `color-mix(in srgb, ${d.tone} 14%, transparent)`,
                color: d.tone,
                display: 'grid',
                placeItems: 'center',
                fontSize: 16,
                border: `1px solid color-mix(in srgb, ${d.tone} 30%, transparent)`,
                marginBottom: 16,
              }}
            >
              {d.icon}
            </span>

            <h3 className="card__title">{t(d.titleKey)}</h3>
            <p className="card__desc">{t(d.descKey)}</p>

            <div className="card__actions" style={{ marginTop: 'auto' }}>
              <a
                className="chip chip--accent"
                href={withBase(`docs/${d.slug}-${lang}.pdf`)}
                download
                onClick={(e) => e.stopPropagation()}
              >
                <FilePdfOutlined />PDF
              </a>
              <a
                className="chip chip--ghost"
                href={withBase(`docs/${d.slug}-${lang}.md`)}
                download
                onClick={(e) => e.stopPropagation()}
              >
                <FileMarkdownOutlined />MD
              </a>
              <span
                className="chip"
                style={{ marginLeft: 'auto', border: 0, background: 'transparent' }}
              >
                {t('docs.open')} <ArrowRightOutlined />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default DocsPage
