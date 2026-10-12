import React from 'react'
import {
  SafetyCertificateFilled,
  ApartmentOutlined,
  ThunderboltFilled,
  ReadOutlined,
  ArrowRightOutlined,
  WarningOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudServerOutlined,
  FileProtectOutlined,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import PageHelp from '../components/PageHelp'
import Hint from '../components/Hint'
import type { PageKey } from '../hooks/useHashRoute'
import { SUB_CAS } from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'

const FP: { text: string; c?: 'hl' | 'cy' | 'vi' | 'li' | 'dim' }[] = [
  { text: '┌── ROOT CA ──────────────────────────────┐', c: 'dim' },
  { text: '│ CN       Pikachu Public Test Root RSA    │' },
  { text: '│ O        Pikachu Trust Network CA        │' },
  { text: '│ VALID    2000-01-01 → 2100-01-01         │', c: 'cy' },
  { text: '│ KEY      RSA-4096                        │' },
  { text: '│ SHA-256  bc:ff:15:86:01:01:ad:ae:05…     │', c: 'hl' },
  { text: '│ OCSP     https://test.ocsps.us.kg        │', c: 'vi' },
  { text: '│ STATUS   ● verified                      │', c: 'li' },
  { text: '└──────────────────────────────────────────┘', c: 'dim' },
]

interface Props {
  onNav: (k: PageKey) => void
}

const OverviewPage: React.FC<Props> = ({ onNav }) => {
  const { t } = useI18n()

  return (
    <div className="page">
      <PageHead
        num="ov.num"
        titleA="ov.title.a"
        titleEm="ov.title.em"
        desc="ov.desc"
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={() => onNav('apply')}>
              <ThunderboltFilled /> {t('common.apply')}
            </button>
            <button type="button" className="btn" onClick={() => onNav('root')}>
              <SafetyCertificateFilled /> {t('common.get_root')}
            </button>
          </>
        }
      />

      <div className="notice notice--danger" style={{ marginBottom: 28 }}>
        <div className="notice__icon" aria-hidden><WarningOutlined /></div>
        <div>
          <h3 className="notice__title">
            {t('ov.notice.title')}
            <Hint title="help.ov.2.t" body="ov.notice.body" />
          </h3>
          <p className="notice__body">{t('ov.notice.short')}</p>
        </div>
      </div>

      <div className="grid grid--4" style={{ marginBottom: 24 }}>
        <StatTile
          k={t('ov.stat.key')}
          icon={<SafetyCertificateFilled style={{ color: 'var(--pika)' }} />}
          v="4096"
          unit={`${t('common.bits')} · RSA`}
          d="PKCS #1 v1.5"
        />
        <StatTile
          k={t('ov.stat.sub')}
          icon={<ApartmentOutlined style={{ color: 'var(--accent)' }} />}
          v={String(SUB_CAS.length)}
          unit=""
          d="time · uefi · code · auth · mail · mtls"
        />
        <StatTile
          k={t('ov.stat.until')}
          icon={<ClockCircleOutlined style={{ color: 'var(--violet)' }} />}
          v="2100"
          unit="— 100y"
          d="2000-01 → 2100-01"
        />
        <StatTile
          k={t('ov.stat.issuer')}
          icon={<CloudServerOutlined style={{ color: 'var(--ok)' }} />}
          v={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: 'var(--ok)', fontSize: 24 }} />
              {t('common.online')}
            </span>
          }
          unit=""
          d={t('ov.stat.issuer')}
        />
      </div>

      <div className="grid grid--2">
        <div className="card card--accent">
          <span className="card__tag">{t('ov.fp.tag')}</span>
          <div className="fp" style={{ marginTop: 16 }}>
            {FP.map((l, i) => (
              <div key={i} className={l.c ?? ''}>
                {l.text}
              </div>
            ))}
          </div>
        </div>

        <div className="vstack" style={{ gap: 12 }}>
          <QuickTile icon={<SafetyCertificateFilled />} label={t('ov.quick.root')} onClick={() => onNav('root')} />
          <QuickTile icon={<ApartmentOutlined />} label={t('ov.quick.sub')} onClick={() => onNav('sub')} />
          <QuickTile icon={<ThunderboltFilled />} label={t('ov.quick.apply')} onClick={() => onNav('apply')} accent />
          <QuickTile icon={<ReadOutlined />} label={t('ov.quick.docs')} onClick={() => onNav('docs')} />
        </div>
      </div>

      <article className="card" style={{ marginTop: 28, borderLeft: '3px solid var(--warn)' }}>
        <span className="card__tag" style={{ color: 'var(--warn)' }}>
          <FileProtectOutlined /> LEGAL
        </span>
        <h3 className="card__title" style={{ marginTop: 12, fontSize: 20 }}>
          {t('ov.legal.title')}
          <Hint title="help.ov.4.t" body="ov.legal.body" />
        </h3>
        <p className="card__desc" style={{ marginTop: 10, fontSize: 13 }}>
          {t('ov.legal.short')}
        </p>
      </article>

      <PageHelp page="overview" />
    </div>
  )
}

const StatTile: React.FC<{
  k: string
  icon: React.ReactNode
  v: React.ReactNode
  unit: string
  d: string
}> = ({ k, icon, v, unit, d }) => (
  <div className="stat">
    <div className="stat__k">
      {k}
      {icon}
    </div>
    <div className="stat__v">
      {v}
      {unit && <span className="unit">{unit}</span>}
    </div>
    <div className="stat__d">{d}</div>
  </div>
)

const QuickTile: React.FC<{
  icon: React.ReactNode
  label: string
  onClick: () => void
  accent?: boolean
}> = ({ icon, label, onClick, accent }) => (
  <button
    type="button"
    onClick={onClick}
    className={`card${accent ? ' card--accent' : ''}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '18px 22px',
      cursor: 'pointer',
      color: 'inherit',
      font: 'inherit',
      textAlign: 'left',
    }}
  >
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: accent ? 'var(--pika)' : 'var(--panel-2)',
        color: accent ? 'var(--pika-ink)' : 'var(--ink-2)',
        display: 'grid',
        placeItems: 'center',
        fontSize: 16,
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
    <span
      style={{
        flex: 1,
        fontFamily: 'var(--ff-display)',
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: '-0.01em',
      }}
    >
      {label}
    </span>
    <ArrowRightOutlined style={{ color: 'var(--ink-3)', fontSize: 13 }} />
  </button>
)

export default OverviewPage
