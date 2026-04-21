import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { buildAll } from './build/buildPdfs'
import { CPS_ZH, CPS_EN } from './src/docs/cps'
import { PRIVACY_ZH, PRIVACY_EN } from './src/docs/privacy'
import { LICENSE_ZH, LICENSE_EN } from './src/docs/license'

/** 仅保留证书二进制 / 安装包等必须资源；老 HTML / legacy 页全部移除 */
const STATIC_ASSETS = ['certs', 'Setupca.zip', 'UPDATE.bat', 'LICENSE']

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

/** 从 Markdown 源在构建时生成 CPS / Privacy / License 的 PDF + MD */
function buildDocsPdfs(): Plugin {
  return {
    name: 'build-docs-pdfs',
    apply: 'build',
    closeBundle() {
      const outDir = path.join(process.cwd(), 'dist', 'docs')
      buildAll(
        [
          { slug: 'cps-zh', source: CPS_ZH, subtitle: '证书策略声明 · CPS', cjk: true },
          { slug: 'cps-en', source: CPS_EN, subtitle: 'Certification Practice Statement' },
          { slug: 'privacy-zh', source: PRIVACY_ZH, subtitle: '隐私声明', cjk: true },
          { slug: 'privacy-en', source: PRIVACY_EN, subtitle: 'Privacy Notice' },
          { slug: 'license-zh', source: LICENSE_ZH, subtitle: '协议许可', cjk: true },
          { slug: 'license-en', source: LICENSE_EN, subtitle: 'License' },
        ],
        outDir,
      )
    },
  }
}

// https://vitejs.dev/config/
// GitHub Pages 部署：仓库名 testca（参见 user rule），若自定义域名或 user-site 请改为 '/'
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/testca/' : '/',
  plugins: [react(), copyOriginalAssets(), buildDocsPdfs()],
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
