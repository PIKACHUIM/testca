import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import App from './App'
import { I18nProvider, useI18n } from './i18n/I18nProvider'
import { ThemeProvider, useTheme } from './theme/ThemeProvider'
import './styles/global.css'

const ThemedApp: React.FC = () => {
  const { lang } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <ConfigProvider
      locale={lang === 'zh' ? zhCN : enUS}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#fbbf24' : '#eab308',
          colorInfo: isDark ? '#06b6d4' : '#0891b2',
          colorSuccess: isDark ? '#84cc16' : '#65a30d',
          colorError: isDark ? '#ef4444' : '#dc2626',
          colorBgContainer: isDark ? '#15171f' : '#ffffff',
          colorBgElevated: isDark ? '#1b1e27' : '#ffffff',
          colorBorder: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.16)',
          colorText: isDark ? '#ececef' : '#1a1a1a',
          colorTextSecondary: isDark ? '#b5b8c0' : '#3f3f46',
          fontFamily:
            "'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif",
          borderRadius: 8,
          borderRadiusLG: 12,
          controlHeight: 40,
        },
        components: {
          Button: {
            fontWeight: 600,
            primaryColor: isDark ? '#1a1200' : '#2d1d00',
          },
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <ThemedApp />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
