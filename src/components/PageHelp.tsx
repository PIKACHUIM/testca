import React, { useState } from 'react'
import { Drawer } from 'antd'
import { CloseOutlined, QuestionOutlined } from '@ant-design/icons'
import { PAGE_HELP } from '../data/help'
import { useI18n } from '../i18n/I18nProvider'
import type { PageKey } from '../hooks/useHashRoute'

interface Props {
  page: PageKey
}

/**
 * 悬浮帮助按钮 + 帮助抽屉。
 *
 * 页面上只保留「必要信息」，背景、原理、注意事项等长文本统一收进这里：
 * 右下角一个常驻的圆角按钮，点开是当前页面的分节说明（抽屉）。
 */
const PageHelp: React.FC<Props> = ({ page }) => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const help = PAGE_HELP[page]

  if (!help) return null

  return (
    <>
      <button
        type="button"
        className="help-fab"
        onClick={() => setOpen(true)}
        aria-label={t('help.open')}
        title={t('help.open')}
      >
        <QuestionOutlined />
        <span className="help-fab__label">{t('help.label')}</span>
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        width={Math.min(460, typeof window === 'undefined' ? 460 : window.innerWidth - 32)}
        className="help-drawer"
        closeIcon={<CloseOutlined />}
        title={
          <span className="help-head">
            <span className="help-head__kicker">{t('help.kicker')}</span>
            <span className="help-head__title">{t(help.title)}</span>
          </span>
        }
      >
        <div className="help-body">
          {help.sections.map((s, i) => (
            <section className="help-sec" key={s.title}>
              <span className="help-sec__n">{String(i + 1).padStart(2, '0')}</span>
              <h4 className="help-sec__t">{t(s.title)}</h4>
              {t(s.body)
                .split('\n')
                .map((line, k) => (
                  <p className="help-sec__b" key={k}>
                    {line}
                  </p>
                ))}
            </section>
          ))}
          <p className="help-foot">{t('help.foot')}</p>
        </div>
      </Drawer>
    </>
  )
}

export default PageHelp
