# 🟡 皮卡丘公共测试根证书服务 · Pikachu Public Test Root CA (RSA)

> A React + Ant Design + Vite portal for the Pikachu Public Test Root CA.
> 皮卡丘公共服务测试根证书 RSA · 提供公共自签名代码签名、时间戳服务、UEFI 固件认证签名、Windows 驱动签名及驱动签名策略自定义服务。

🔗 **在线访问 · Live site**: <https://pikachuim.github.io/testca/>

---

## ✨ 特性 · Features

- ⚡ **Vite 6 + React 18 + TypeScript**：现代化前端工程
- 🎨 **Ant Design 5（深色主题 + 定制设计系统）**：赛博 · 编辑风 × 皮卡丘配色
- 🔐 **完整证书门户功能**：
  - 根 CA / 中间 CA 展示与 `.cer/.crt/.der/.p7b/.crl` 下载
  - 证书策略 (CPS) 下载（中英）
  - 实时测试证书申请（对接 `https://issuer.524228.xyz/cert/`）
  - DingXiang 人机验证码集成
- 🚀 **GitHub Actions 自动化部署** 到 GitHub Pages
- 📁 **保留全部原证书静态资源**：构建时自动拷贝 `certs/`, `CPS-*`, `Setupca.zip`, `legacy.html` 等到产物目录

---

## ⚠️ 重要声明 · Significant Notices

- **此 CA 机构签出的时间戳和证书不会校验真实性和申请来源身份，任何人均可以随意生成任意时间戳和未经验证的证书！！！**
- **此 CA 机构签出的时间戳和证书仅用于测试用途，不应用于重要场合或者生产环境，未经验证的证书不应在实践中使用！！！**
- **The timestamps and certificates signed by this CA will NOT be verified. Anyone can generate any timestamp / unverified certificate at will.**
- **Certificates issued here are for testing only and MUST NOT be used in production.**

---

## 🧰 本地开发 · Local Development

### 环境要求

- Node.js **≥ 20**
- npm **≥ 9**（或 pnpm / yarn）

### 运行

```bash
# 安装依赖
npm install

# 启动开发服务器 (http://localhost:5173)
npm run dev

# 类型检查 + 构建生产版本 (dist/)
npm run build

# 本地预览构建产物
npm run preview
```

开发时通过 `base: '/'` 挂载，生产构建 `base: '/testca/'`（匹配 GitHub Pages 的仓库路径，通过 `vite.config.ts` 自动切换）。

---

## 📂 项目结构 · Project Structure

```
.
├── index.html                 # Vite 入口
├── vite.config.ts             # Vite 配置 + 静态资源拷贝插件
├── tsconfig.json
├── package.json
├── public/
│   └── pikachu.svg            # Favicon
├── src/
│   ├── main.tsx               # React 入口 + AntD 主题
│   ├── App.tsx
│   ├── vite-env.d.ts
│   ├── styles/
│   │   └── global.css         # 设计系统 / 变量 / 组件样式
│   ├── data/
│   │   └── constants.ts       # 证书与表单数据
│   └── components/
│       ├── Header.tsx
│       ├── Hero.tsx
│       ├── NoticeBanner.tsx
│       ├── CaSection.tsx      # 根/中间 CA 展示与下载
│       ├── ApplyForm.tsx      # 证书申请表单
│       └── Footer.tsx
├── certs/                     # 证书静态资源（构建时自动拷贝到 dist/）
├── CPS-CN.pdf / CPS-EN.pdf    # 证书策略声明
├── legacy.html                # 旧版静态页面（归档，可访问）
├── Setupca.zip
└── .github/workflows/deploy.yml   # GitHub Pages 自动部署
```

---

## 🚀 部署到 GitHub Pages · Deploy to GitHub Pages

### 方案一：GitHub Actions（推荐）

项目已附带 `.github/workflows/deploy.yml`，你只需要：

1. **启用 GitHub Pages**：在仓库 `Settings → Pages` 中，**Source** 选择 **GitHub Actions**。
2. **推送代码**到 `main` 或 `master` 分支 —— Actions 将自动构建并部署。
3. 页面地址：`https://<username>.github.io/testca/`

如需自定义仓库名，请同步修改 `vite.config.ts` 中的 `base` 字段：

```ts
base: command === 'build' ? '/<your-repo-name>/' : '/',
```

绑定自定义域名时，在 `public/` 下创建 `CNAME` 文件并将 `base` 改为 `'/'`。

### 方案二：手动部署（gh-pages 分支）

```bash
npm run deploy
# 会执行 build 并把 dist/ 发布到 gh-pages 分支
```

然后在 `Settings → Pages` 中选择 **gh-pages** 分支作为 Source。

---

## 🔧 自定义配置 · Customization

### 证书数据

所有证书条目集中管理在 [`src/data/constants.ts`](./src/data/constants.ts)：

- `ROOT_CA`：根证书
- `SUB_CAS`：中间 CA 列表
- `CERT_PRODUCTS` / `VALID_RANGES`：申请表单下拉选项
- `ISSUER_ENDPOINT`：后端签发接口
- `CAPTCHA_APP_ID` / `CAPTCHA_API_SERVER`：DingXiang 验证码配置

### 主题色

深色主题定义于 [`src/styles/global.css`](./src/styles/global.css) 的 `:root` CSS 变量；Ant Design token 在 [`src/main.tsx`](./src/main.tsx) 中调整。

---

## 📜 证书策略 · CPS

- [📄 CPS 中文 PDF](./CPS-CN.pdf) · [📄 CPS English PDF](./CPS-EN.pdf)
- [🌐 CPS 中文 HTML](./CPS-CN.html) · [🌐 CPS English HTML](./CPS-EN.html)

---

## 📘 License

MIT License · See [LICENSE](./LICENSE).

> **备注**：证书主体名称（Common Name）无法自定义，将会使用描述信息（Description）区分和替代主体名称。证书一旦创建就无法吊销或撤回，私钥泄漏也没有办法禁用，请妥善保管您的证书私钥。
>
> **Note**: Certificate Common Name can NOT be customized. Once a cert is created, it cannot be revoked. **PLEASE KEEP YOUR PRIVATE KEY SAFE!**
