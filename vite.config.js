import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { buildAll } from './build/buildPdfs';
import { CPS_ZH, CPS_EN } from './src/docs/cps';
import { PRIVACY_ZH, PRIVACY_EN } from './src/docs/privacy';
import { LICENSE_ZH, LICENSE_EN } from './src/docs/license';
/** 仅保留证书二进制 / 安装包等必须资源；老 HTML / legacy 页全部移除 */
var STATIC_ASSETS = ['certs', 'Setupca.zip', 'UPDATE.bat', 'LICENSE', 'CNAME'];
function copyOriginalAssets() {
    var done = false;
    return {
        name: 'copy-original-static-assets',
        apply: 'build',
        closeBundle: function () {
            // watch 模式下仅执行一次；重复复制既无意义又会触发磁盘抖动
            if (process.env.VITE_WATCH && done)
                return;
            done = true;
            var root = process.cwd();
            var dist = path.join(root, 'dist');
            for (var _i = 0, STATIC_ASSETS_1 = STATIC_ASSETS; _i < STATIC_ASSETS_1.length; _i++) {
                var asset = STATIC_ASSETS_1[_i];
                var from = path.join(root, asset);
                var to = path.join(dist, asset);
                if (!fs.existsSync(from))
                    continue;
                fs.cpSync(from, to, { recursive: true });
            }
            // GitHub Pages: 防止 Jekyll 处理下划线/特殊路径
            fs.writeFileSync(path.join(dist, '.nojekyll'), '');
            // ------------------------------------------------------------------
            // Cloudflare Pages / 通用静态托管兼容：
            //   _headers / _redirects 由 public/_headers、public/_redirects 提供，
            //   Vite 会在构建时自动拷贝到 dist/ 根目录；此处不再重复写入，避免
            //   出现两份定义不一致的维护问题。
            //
            //   404.html 用于 GitHub Pages / Cloudflare Pages 以外的静态托管
            //   刷新子路径时的兜底（SPA fallback）。
            // ------------------------------------------------------------------
            var indexHtml = path.join(dist, 'index.html');
            if (fs.existsSync(indexHtml)) {
                fs.copyFileSync(indexHtml, path.join(dist, '404.html'));
            }
        },
    };
}
/** 从 Markdown 源在构建时生成 CPS / Privacy / License 的 PDF + MD */
function buildDocsPdfs() {
    var done = false;
    return {
        name: 'build-docs-pdfs',
        apply: 'build',
        closeBundle: function () {
            // PDF 生成比较耗时，watch 模式下只在首次构建跑一遍
            if (process.env.VITE_WATCH && done)
                return;
            done = true;
            var outDir = path.join(process.cwd(), 'dist', 'docs');
            buildAll([
                { slug: 'cps-zh', source: CPS_ZH, subtitle: '证书策略声明 · CPS', cjk: true },
                { slug: 'cps-en', source: CPS_EN, subtitle: 'Certification Practice Statement' },
                { slug: 'privacy-zh', source: PRIVACY_ZH, subtitle: '隐私声明', cjk: true },
                { slug: 'privacy-en', source: PRIVACY_EN, subtitle: 'Privacy Notice' },
                { slug: 'license-zh', source: LICENSE_ZH, subtitle: '协议许可', cjk: true },
                { slug: 'license-en', source: LICENSE_EN, subtitle: 'License' },
            ], outDir);
        },
    };
}
// https://vitejs.dev/config/
// 使用自定义域名（CNAME：gh-tca.opkg.cn）部署到站点根目录，base 固定为 '/'
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        base: '/',
        plugins: [react(), copyOriginalAssets(), buildDocsPdfs()],
        server: {
            port: 5172,
            // 端口被占用时不报错，自动递增寻找下一个可用端口
            strictPort: false,
            host: true,
            // ---------------------------------------------------------------
            // dev 代理：把 Worker 路径全部转发到本地 wrangler dev (默认 8786)
            // 这样前端 http://localhost:5172 发起的 /api/*、/cert/、/ocsp、
            // /crl/*、/revoke、/card/* 都能打到后端，避免被 SPA fallback 返回
            // index.html（智能卡证书上传页 /card/web/cert 也在这里）
            //
            // 说明：Vite 底层用的是 http-proxy，默认在 target 不可达时会把错误
            //      传给下一个中间件，Vite 随后会用 SPA fallback 返回 index.html。
            //      这里用 `configure` 主动捕获 error，显式返回 502，避免前端拿到 HTML。
            // ---------------------------------------------------------------
            proxy: (function () {
                var target = 'http://127.0.0.1:8786';
                var onError = function (err, _req, res) {
                    console.error("[vite proxy] ".concat(target, " unreachable:"), (err === null || err === void 0 ? void 0 : err.message) || err);
                    if (res && !res.headersSent) {
                        res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
                    }
                    try {
                        res === null || res === void 0 ? void 0 : res.end(JSON.stringify({
                            done: false,
                            text: "Backend (".concat(target, ") unreachable. Is wrangler dev running on 8786?"),
                        }));
                    }
                    catch (_a) {
                        /* noop */
                    }
                };
                var make = function () { return ({
                    target: target,
                    changeOrigin: true,
                    ws: false,
                    configure: function (proxy) {
                        proxy.on('error', onError);
                    },
                }); };
                return {
                    '/api': make(),
                    '/cert': make(),
                    '/ocsp': make(),
                    '/crl': make(),
                    '/revoke': make(),
                    // 智能卡证书分发：页面上传 + 下发 API（见 worker/src/routes/card.ts）
                    '/card': make(),
                    // 兼容 SmartCardWEB.py 的旧根路径别名
                    '/get/cert': make(),
                    '/put/cert': make(),
                    '/web/cert': make(),
                };
            })(),
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
    });
});
