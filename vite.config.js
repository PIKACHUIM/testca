import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { buildAll } from './build/buildPdfs';
import { CPS_ZH, CPS_EN } from './src/docs/cps';
import { PRIVACY_ZH, PRIVACY_EN } from './src/docs/privacy';
import { LICENSE_ZH, LICENSE_EN } from './src/docs/license';
/** 仅保留证书二进制 / 安装包等必须资源；老 HTML / legacy 页全部移除 */
var STATIC_ASSETS = ['certs', 'Setupca.zip', 'UPDATE.bat', 'LICENSE'];
function copyOriginalAssets() {
    return {
        name: 'copy-original-static-assets',
        apply: 'build',
        closeBundle: function () {
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
        },
    };
}
/** 从 Markdown 源在构建时生成 CPS / Privacy / License 的 PDF + MD */
function buildDocsPdfs() {
    return {
        name: 'build-docs-pdfs',
        apply: 'build',
        closeBundle: function () {
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
    });
});
