import React from 'react'
import {
  FilePdfOutlined,
  FileMarkdownOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import PageHelp from '../components/PageHelp'
import MarkdownDoc from '../components/MarkdownDoc'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import { withBase } from '../data/constants'

interface Props {
  num: MessageKey
  titleA: MessageKey
  titleEm: MessageKey
  desc: MessageKey
  sourceZh: string
  sourceEn: string
  slug: 'cps' | 'privacy' | 'license'
}

const DocumentPage: React.FC<Props> = ({
  num,
  titleA,
  titleEm,
  desc,
  sourceZh,
  sourceEn,
  slug,
}) => {
  const { t, lang } = useI18n()
  const src = lang === 'zh' ? sourceZh : sourceEn
  const pdfHref = withBase(`docs/${slug}-${lang}.pdf`)
  const mdHref = withBase(`docs/${slug}-${lang}.md`)

  return (
    <div className="page">
      <PageHead
        num={num}
        titleA={titleA}
        titleEm={titleEm}
        desc={desc}
        actions={
          <>
            <a className="btn btn--primary" href={pdfHref} download>
              <FilePdfOutlined /> PDF
            </a>
            <a className="btn" href={mdHref} download>
              <FileMarkdownOutlined /> Markdown
            </a>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => window.print()}
            >
              <PrinterOutlined /> Print
            </button>
          </>
        }
      />

      <article className="card" style={{ padding: 'clamp(24px, 4vw, 48px)' }}>
        <MarkdownDoc source={src} />
      </article>

      <PageHelp page={slug} />
    </div>
  )
}

export default DocumentPage
