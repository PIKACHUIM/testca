import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: '#ffd83d',
          colorInfo: '#5ef7ff',
          colorSuccess: '#b5ff4d',
          colorError: '#ff4d57',
          colorBgContainer: 'rgba(22, 25, 40, 0.7)',
          colorBgElevated: '#1a1d2e',
          colorBorder: 'rgba(255, 255, 255, 0.1)',
          colorText: '#e8ecf4',
          colorTextSecondary: '#a5aabb',
          fontFamily:
            "'Inter Tight', 'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
          borderRadius: 10,
          borderRadiusLG: 14,
          controlHeight: 40,
        },
        components: {
          Button: {
            fontWeight: 600,
            primaryColor: '#1a1200',
          },
          Input: {
            colorBgContainer: 'rgba(255, 255, 255, 0.04)',
            activeBorderColor: '#ffd83d',
            hoverBorderColor: 'rgba(255, 216, 61, 0.5)',
          },
          Select: {
            colorBgContainer: 'rgba(255, 255, 255, 0.04)',
          },
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
)
