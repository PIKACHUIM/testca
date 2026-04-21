import React from 'react'
import {
  DownloadOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { withBase, type CaItem } from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  item: CaItem
  accent?: boolean
}

const CaCard: React.FC<Props> = ({ item, accent }) => {
  const { lang } = useI18n()
  const isRoot = accent ?? item.tone === 'root'

  const title = lang === 'zh' ? item.cn : item.cnEn
  const sub = lang === 'zh' ? item.cnEn : item.cn

  return (
    <article className={`card${isRoot ? ' card--accent' : ''}`}>
      <span className="card__tag">
        {isRoot ? 'ROOT · RSA-4096' : `INTERMEDIATE · ${item.id.toUpperCase()}`}
      </span>
      <div className="card__sub" style={{ marginTop: 12 }}>{sub}</div>
      <h3 className="card__title" style={{ fontSize: 17, marginBottom: 4 }}>{title}</h3>

      <div className="card__actions" style={{ marginTop: 14 }}>
        {item.formats.map((f) => (
          <a
            key={f}
            className={`chip${f === 'cer' ? ' chip--accent' : ''}`}
            href={withBase(`${item.dir}/${item.id}.${f}`)}
            download
          >
            <DownloadOutlined />.{f}
          </a>
        ))}
        {item.crlFile && (
          <a
            className="chip chip--ghost"
            href={withBase(item.crlFile)}
            target="_blank"
            rel="noreferrer"
          >
            <LinkOutlined />CRL
          </a>
        )}
        {item.ocsp && (
          <a
            className="chip chip--ghost"
            href={item.ocsp}
            target="_blank"
            rel="noreferrer"
          >
            <LinkOutlined />OCSP
          </a>
        )}
      </div>
    </article>
  )
}

export default CaCard
