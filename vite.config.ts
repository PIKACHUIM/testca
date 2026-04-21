import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// 要在构建时一同拷贝到 dist 根下的原有静态资产（保持原链接结构）
const STATIC_ASSETS = [
  'certs',
  'CPS-CN.pdf',
  'CPS-EN.pdf',
  'CPS-CN.html',
  'CPS-EN.html',
  'CPS-CN.md',
  'CPS-EN.md',
  'Policy.html',
  'Setupca.zip',
  'LICENSE',
  'legacy.html',
]

function copyOriginalAssets(): Plugin {
  return {
    name: 'copy-original-static-assets',
    apply: 'build',
    closeBundle() {
      const root = process.cwd()
      const dist = path.join(root, 'dist')
      for (const asset of STATIC_ASSETS) {
        const from = path.join(root, asset)
        const to = path.join(dist, asset)
        if (!fs.existsSync(from)) continue
        fs.cpSync(from, to, { recursive: true })
      }
      // GitHub Pages: 防止 Jekyll 处理下划线/特殊路径
      fs.writeFileSync(path.join(dist, '.nojekyll'), '')
    },
  }
}

// https://vitejs.dev/config/
// GitHub Pages 部署：仓库名 testca（参见 user rule），若自定义域名或 user-site 请改为 '/'
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/testca/' : '/',
  plugins: [react(), copyOriginalAssets()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
        },
      },
    },
  },
}))
