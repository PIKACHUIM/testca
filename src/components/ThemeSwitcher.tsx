import React from 'react'
import { SunOutlined, MoonFilled, DesktopOutlined } from '@ant-design/icons'
import { useTheme, type ThemePref } from '../theme/ThemeProvider'

const OPTIONS: { value: ThemePref; icon: React.ReactNode; label: string }[] = [
  { value: 'light', icon: <SunOutlined />, label: 'Light' },
  { value: 'dark', icon: <MoonFilled />, label: 'Dark' },
  { value: 'system', icon: <DesktopOutlined />, label: 'System' },
]

const ThemeSwitcher: React.FC = () => {
  const { pref, setPref } = useTheme()

  return (
    <div className="seg" role="group" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`seg__btn${pref === o.value ? ' is-active' : ''}`}
          onClick={() => setPref(o.value)}
          aria-pressed={pref === o.value}
          title={o.label}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
