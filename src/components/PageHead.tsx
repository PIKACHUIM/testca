import React from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'

interface Props {
  num: MessageKey
  /** 标题前半（正体） */
  titleA: MessageKey
  /** 标题后半（黄色斜体）；缺省则只渲染 titleA */
  titleEm?: MessageKey
  /** 一句话描述：这里只放「一句」，详细说明请放 PageHelp 的帮助抽屉 */
  desc?: MessageKey
  actions?: React.ReactNode
}

/**
 * Editorial 风格页头：序号 + 大号 serif 标题 + 单行描述。
 *
 * 标题由「正体 + 黄色斜体」两段拼成；拉丁文之间必须留空格
 * （中文排版不需要），因此这里按语言统一插入分隔空格，
 * 避免出现 "PikachuPublic Test Root CA" 这类粘连。
 */
const PageHead: React.FC<Props> = ({ num, titleA, titleEm, desc, actions }) => {
  const { t, lang } = useI18n()

  return (
    <header className="phead">
      <div>
        <div className="phead__num">{t(num)}</div>
        <h1 className="phead__title">
          {t(titleA)}
          {titleEm ? (
            <>
              {lang === 'zh' ? '' : ' '}
              <em>{t(titleEm)}</em>
            </>
          ) : null}
        </h1>
        {desc ? <p className="phead__desc">{t(desc)}</p> : null}
      </div>
      {actions ? <div className="phead__actions">{actions}</div> : null}
    </header>
  )
}

export default PageHead
