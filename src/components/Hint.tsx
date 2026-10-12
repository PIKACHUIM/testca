import React from 'react'
import { Popover } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'

interface Props {
  /** 提示正文（可含多段，用 \n 分段） */
  body: MessageKey
  /** 可选标题 */
  title?: MessageKey
  /** 图标颜色，默认继承 */
  tone?: string
}

/**
 * 行内「?」提示：把长说明从页面上收进轻量气泡里。
 *
 * 页面上只留一个图标，鼠标悬停 / 聚焦 / 点击即可查看细节，
 * 需要更完整的解释时再用页面右下角的悬浮帮助按钮。
 */
const Hint: React.FC<Props> = ({ body, title, tone }) => {
  const { t } = useI18n()
  return (
    <Popover
      trigger={['hover', 'click']}
      placement="top"
      overlayClassName="hint-pop"
      content={
        <div className="hint-body">
          {title ? <div className="hint-body__t">{t(title)}</div> : null}
          <div className="hint-body__b">
            {t(body)
              .split('\n')
              .map((line, i) => (
                <p key={i}>{line}</p>
              ))}
          </div>
        </div>
      }
    >
      <button
        type="button"
        className="hint"
        aria-label={title ? t(title) : 'info'}
        style={tone ? { color: tone } : undefined}
      >
        <InfoCircleOutlined />
      </button>
    </Popover>
  )
}

export default Hint
