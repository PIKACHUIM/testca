import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
// 要在构建时一同拷贝到 dist 根下的原有静态资产（保持原链接结构）
var STATIC_ASSETS = [
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
];
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
// https://vitejs.dev/config/
// GitHub Pages 部署：仓库名 testca（参见 user rule），若自定义域名或 user-site 请改为 '/'
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
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
    });
});
