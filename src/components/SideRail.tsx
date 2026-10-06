import React from 'react'
import {
  DashboardOutlined,
  SafetyCertificateFilled,
  ApartmentOutlined,
  ThunderboltFilled,
  StopOutlined,
  IdcardOutlined,
  ReadOutlined,
  FileProtectOutlined,
  LockOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import type { PageKey } from '../hooks/useHashRoute'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import { withBase } from '../data/constants'

interface Item {
  key: PageKey
  icon: React.ReactNode
  labelKey: MessageKey
  kbd?: string
}

interface Group {
  headerKey: MessageKey
  items: Item[]
}

const GROUPS: Group[] = [
  {
    headerKey: 'rail.group.primary',
    items: [
      { key: 'overview', icon: <DashboardOutlined />, labelKey: 'rail.overview', kbd: '1' },
      { key: 'root', icon: <SafetyCertificateFilled />, labelKey: 'rail.root', kbd: '2' },
      { key: 'sub', icon: <ApartmentOutlined />, labelKey: 'rail.sub', kbd: '3' },
      { key: 'apply', icon: <ThunderboltFilled />, labelKey: 'rail.apply', kbd: '4' },
      { key: 'revoke', icon: <StopOutlined />, labelKey: 'rail.revoke', kbd: '5' },
      { key: 'card', icon: <IdcardOutlined />, labelKey: 'rail.card', kbd: '6' },
      { key: 'docs', icon: <ReadOutlined />, labelKey: 'rail.docs', kbd: '7' },
    ],
  },
  {
    headerKey: 'rail.group.legal',
    items: [
      { key: 'cps', icon: <FileProtectOutlined />, labelKey: 'rail.cps', kbd: '8' },
      { key: 'privacy', icon: <LockOutlined />, labelKey: 'rail.privacy', kbd: '9' },
      { key: 'license', icon: <FileTextOutlined />, labelKey: 'rail.license', kbd: '0' },
    ],
  },
]

const FLAT: Item[] = GROUPS.flatMap((g) => g.items)

/**
 * 快捷键按「徽标数字」映射到页面，而不是数组下标 ——
 * 这样后续插入/调整菜单项不会让已标注的 1..9 错位。
 */
const KBD_MAP = new Map<string, PageKey>(
  FLAT.filter((it) => !!it.kbd).map((it) => [it.kbd as string, it.key]),
)

interface Props {
  active: PageKey
  onNav: (k: PageKey) => void
}

const SideRail: React.FC<Props> = ({ active, onNav }) => {
  const { t } = useI18n()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      }
      const target = KBD_MAP.get(e.key)
      if (target) onNav(target)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNav])

  return (
    <aside className="rail">
      <div className="rail__brand">
        <div className="rail__logo" aria-hidden>
          <img src={withBase('pikachu.svg')} alt="Pikachu" draggable={false} />
        </div>
        <div>
          <div className="rail__title">{t('brand.title')}</div>
          <div className="rail__sub">{t('brand.sub')}</div>
        </div>
      </div>

      {GROUPS.map((g) => (
        <React.Fragment key={g.headerKey}>
          <div className="rail__section">{t(g.headerKey)}</div>
          {g.items.map((it) => (
            <button
              key={it.key}
              type="button"
              className={`rail__item${active === it.key ? ' is-active' : ''}`}
              onClick={() => onNav(it.key)}
              aria-current={active === it.key ? 'page' : undefined}
            >
              <span className="icon" aria-hidden>{it.icon}</span>
              <span>{t(it.labelKey)}</span>
              {it.kbd && <span className="kbd" aria-hidden>{it.kbd}</span>}
            </button>
          ))}
        </React.Fragment>
      ))}

      <div className="rail__foot" aria-hidden>
        <div><span className="ok">●</span> OCSP {t('common.online')}</div>
        <div>© 2025</div>
      </div>
    </aside>
  )
}

export default SideRail
