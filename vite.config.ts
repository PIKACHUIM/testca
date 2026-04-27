import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { buildAll } from './build/buildPdfs'
import { CPS_ZH, CPS_EN } from './src/docs/cps'
import { PRIVACY_ZH, PRIVACY_EN } from './src/docs/privacy'
import { LICENSE_ZH, LICENSE_EN } from './src/docs/license'

/** 仅保留证书二进制 / 安装包等必须资源；老 HTML / legacy 页全部移除 */
const STATIC_ASSETS = ['certs', 'Setupca.zip', 'UPDATE.bat', 'LICENSE', 'CNAME']

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

      // ------------------------------------------------------------------
      // Cloudflare Pages / 通用静态托管兼容：
      //   1) _redirects —— SPA 路由回退，避免子路径刷新后请求 hash 资源
      //      被 404 页拦截从而返回 application/octet-stream 的 MIME。
      //   2) _headers   —— 强制 JS / MJS / CSS / WASM 的 Content-Type，
      //      彻底修复浏览器严格 MIME 校验下的
      //      "Expected a JavaScript-or-Wasm module script but the server
      //      responded with a MIME type of application/octet-stream" 报错。
      //   3) 404.html   —— GitHub Pages / 其它静态托管下刷新子路径的兜底。
      // ------------------------------------------------------------------
      const redirects = [
        '# Cloudflare Pages SPA fallback',
        '/*    /index.html   200',
        '',
      ].join('\n')
      fs.writeFileSync(path.join(dist, '_redirects'), redirects)

      const headers = [
        '# 静态资源默认强缓存（Vite 产物带内容 hash）',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
        '# 显式声明 JS / MJS 的 MIME，避免 Cloudflare Pages 返回 octet-stream',
        '/*.js',
        '  Content-Type: application/javascript; charset=utf-8',
        '/*.mjs',
        '  Content-Type: application/javascript; charset=utf-8',
        '/*.css',
        '  Content-Type: text/css; charset=utf-8',
        '/*.wasm',
        '  Content-Type: application/wasm',
        '/*.map',
        '  Content-Type: application/json; charset=utf-8',
        '',
      ].join('\n')
      fs.writeFileSync(path.join(dist, '_headers'), headers)

      const indexHtml = path.join(dist, 'index.html')
      if (fs.existsSync(indexHtml)) {
        fs.copyFileSync(indexHtml, path.join(dist, '404.html'))
      }
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
// 使用自定义域名（CNAME：gh-tca.opkg.cn）部署到站点根目录，base 固定为 '/'
export default defineConfig(({ command }) => ({
  base: '/',
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
