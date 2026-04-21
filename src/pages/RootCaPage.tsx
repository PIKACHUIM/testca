import React from 'react'
import {
  DownloadOutlined,
  LinkOutlined,
  FilePdfOutlined,
  FileZipOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import { ROOT_CA, withBase } from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'

const RootCaPage: React.FC = () => {
  const { t, lang } = useI18n()
  const rootTitle = lang === 'zh' ? ROOT_CA.cn : ROOT_CA.cnEn
  const rootSub = lang === 'zh' ? ROOT_CA.cnEn : ROOT_CA.cn

  return (
    <div className="page">
      <PageHead
        num={t('root.num')}
        title={
          <>
            {t('root.title.a')}
            <em>{t('root.title.em')}</em>
          </>
        }
        desc={t('root.desc')}
      />

      <div className="notice notice--info" style={{ marginBottom: 24 }}>
        <div className="notice__icon" aria-hidden><InfoCircleOutlined /></div>
        <div>
          <h3 className="notice__title">{t('root.how.title')}</h3>
          <p className="notice__body">{t('root.how.body')}</p>
        </div>
      </div>

      <div className="grid grid--2">
        <article className="card card--accent">
          <span className="card__tag">ROOT · RSA-4096</span>
          <div className="card__sub" style={{ marginTop: 18 }}>{rootSub}</div>
          <h3 className="card__title" style={{ fontSize: 22 }}>{rootTitle}</h3>

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '8px 18px',
              margin: '18px 0',
              fontFamily: 'var(--ff-mono)',
              fontSize: 12,
            }}
          >
            <Dt label={t('root.f.subject')} />
            <dd style={{ margin: 0 }}>CN=Pikachu Public Test Root RSA</dd>

            <Dt label={t('root.f.org')} />
            <dd style={{ margin: 0 }}>Pikachu Trust Network CA</dd>

            <Dt label={t('root.f.key')} />
            <dd style={{ margin: 0, color: 'var(--pika)' }}>RSA 4096 · PKCS#1 v1.5</dd>

            <Dt label={t('root.f.valid')} />
            <dd style={{ margin: 0, color: 'var(--accent)' }}>2000-01-01 → 2100-01-01</dd>

            <Dt label={t('root.f.serial')} />
            <dd style={{ margin: 0 }}>0x7B5296CF…EF12A340</dd>

            <Dt label={t('root.f.ocsp')} />
            <dd style={{ margin: 0 }}>
              <a href={ROOT_CA.ocsp} target="_blank" rel="noreferrer" className="bare">
                test.ocsps.us.kg
              </a>
            </dd>
          </dl>

          <div className="card__actions">
            {ROOT_CA.formats.map((f) => (
              <a
                key={f}
                className={`chip${f === 'cer' ? ' chip--accent' : ''}`}
                href={withBase(`${ROOT_CA.dir}/${ROOT_CA.id}.${f}`)}
                download
              >
                <DownloadOutlined />.{f}
              </a>
            ))}
            {ROOT_CA.crlFile && (
              <a
                className="chip chip--ghost"
                href={withBase(ROOT_CA.crlFile)}
                target="_blank"
                rel="noreferrer"
              >
                <LinkOutlined />CRL
              </a>
            )}
          </div>
        </article>

        <div className="vstack" style={{ gap: 14 }}>
          <article className="card">
            <span className="card__tag">CPS</span>
            <h3 className="card__title" style={{ marginTop: 14 }}>{t('root.cps.title')}</h3>
            <p className="card__desc">{t('root.cps.desc')}</p>
            <div className="card__actions">
              <a className="chip chip--accent" href={withBase('docs/cps-zh.pdf')} download>
                <FilePdfOutlined />中文 PDF
              </a>
              <a className="chip" href={withBase('docs/cps-en.pdf')} download>
                <FilePdfOutlined />EN PDF
              </a>
              <a className="chip chip--ghost" href="#/cps">
                <LinkOutlined />Web
              </a>
            </div>
          </article>

          <article className="card">
            <span className="card__tag">SETUP</span>
            <h3 className="card__title" style={{ marginTop: 14 }}>{t('root.setup.title')}</h3>
            <p className="card__desc">{t('root.setup.desc')}</p>
            <div className="card__actions">
              <a className="chip chip--accent" href={withBase('Setupca.zip')} download>
                <FileZipOutlined />Setupca.zip
              </a>
              <a className="chip chip--ghost" href={withBase('UPDATE.bat')} download>
                <DownloadOutlined />UPDATE.bat
              </a>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}

const Dt: React.FC<{ label: string }> = ({ label }) => (
  <dt
    style={{
      color: 'var(--ink-3)',
      fontSize: 10,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      alignSelf: 'center',
    }}
  >
    {label}
  </dt>
)

export default RootCaPage
