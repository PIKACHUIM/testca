# pika-ca-worker

基于 **Hono + Cloudflare Workers** 的在线 CA 证书服务，等价于 [../issue/CAServer.py](../issue/CAServer.py) 的 Serverless 迁移版。

> 🆕 **同站部署模式**：同一个 Worker 同时承载前端 SPA（Vite + React）与后端 API。
> 前端经过 `npm run build` 产出到仓库根 `dist/`，Worker 通过 `[assets]` 绑定直接托管；
> API 路由（/cert/、/ocsp、/crl/*、/revoke、/api/*）仍由 Hono 处理，
> 其余请求回退为前端 SPA。无需再部署到 GitHub Pages 或单独域名。

| 能力 | 路由 | 说明 |
| --- | --- | --- |
| 前端 SPA | `/`、`/apply`、`/overview` 等 | 由 Workers Static Assets 托管 |
| 签发证书 | `GET/POST /cert/` | 输出 ZIP（`.crt/.pem/.pfx/chain`），支持 time/uefi/code/auth/file/mail/mtls/sign 八类 CA |
| OCSP (RFC 6960) | `POST /ocsp`、`GET /ocsp/:b64` | 返回 DER 编码 OCSP Response |
| CRL  (RFC 5280) | `GET /crl/<caName>.crl`（也兼容 `<caName>ca.crl`） | 实时聚合 KV 中已吊销项 |
| 基于私钥吊销 | `POST /revoke` | JSON 或 multipart：`{serial, privateKeyPem, reason?}` |
| 智能卡证书分发 | `GET/POST /card/get/cert` | 取回 X25519 加密后的 PFX（TPM 虚拟智能卡） |
| 智能卡证书上传 | `POST /card/put/cert` | 上传 PFX，Worker 侧加密后存入 KV |
| 智能卡上传页面 | `GET /card/web/cert` | 浏览器上传界面（服务端渲染，无外部依赖） |
| 健康检查 | `GET /api/health` | 返回 ts 与路由清单 |

---

## 1. 环境依赖

- Node.js ≥ 18
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) ≥ 3.x

```bash
cd worker
npm install
```

## 2. 创建 KV

```bash
npx wrangler kv:namespace create CERT_KV
npx wrangler kv:namespace create CERT_KV --preview
```

将返回的 `id` 与 `preview_id` 填入 [wrangler.toml](./wrangler.toml) 中的 `[[kv_namespaces]]` 项。

## 3. 配置 Secret

各级 CA 私钥通过 Wrangler Secret 持久化，不会写入代码仓。需要配置的 Secret：

```
ROOT_CA_KEY  TIME_CA_KEY  UEFI_CA_KEY  CODE_CA_KEY
AUTH_CA_KEY  FILE_CA_KEY  MAIL_CA_KEY  MTLS_CA_KEY
SIGN_CA_KEY  OCSP_CA_KEY
```

依次执行（粘贴 PEM 全文）：

```bash
npx wrangler secret put TIME_CA_KEY
npx wrangler secret put UEFI_CA_KEY
# ... 其余同上
npx wrangler secret put OCSP_CA_KEY
```

可选（Cloudflare Turnstile 人机验证）：

```bash
# 未配置时后端会使用 Cloudflare 官方测试 secret 「1x0000000000000000000000000000000AA」及
# 测试 site key「1x00000000000000000000AA」（总是通过，仅供开发/演示）。
# 生产环境请配置自己的 key：
npx wrangler secret put TURNSTILE_SECRET
# 同时在 wrangler.toml 设置 TURNSTILE_SITE_KEY，前端通过 VITE_TURNSTILE_SITE_KEY 同步配置。
```

> 若 `TURNSTILE_SECRET` 未配置，Worker 自动回退到 Cloudflare 测试 secret，方便本地开发。

> CA **证书（公钥）** 不通过 Secret 传递，而是在运行时 `fetch(<CERTS_ORIGIN>/certs/<xxxca>/<xxxca>.der)`。
> 同站部署下 `CERTS_ORIGIN` 留空即可，Worker 会自动使用请求自身的 origin（前端构建产物里已经带了 `/certs/*`）。
> 若要从外部 origin 取公钥（例如 GitHub Pages），设置 `CERTS_ORIGIN=https://pikachuim.github.io/PikaTestCert` 即可。

## 4. 构建前端 & 本地开发（同站模式）

```bash
# 仓库根先构建前端产物到 dist/
cd ..
npm install
npm run build

# 回到 worker/ 启动本地 Worker（Static Assets + API）
cd worker
npm run dev
# => http://localhost:8786
#    - /           -> 前端 SPA
#    - /cert/      -> 在线签发 API
#    - /api/health -> 健康检查
```

> 便捷命令：仓库根执行 `npm run worker:dev` 可一键完成 `build + wrangler dev`；
> 或 `cd worker && npm run dev:all` 等效。

## 5. 一键部署

```bash
# 仓库根一条命令：构建前端 + 部署 Worker（含 Assets）
npm run worker:deploy
```

或显式分步：

```bash
npm run build               # 仓库根：产出 dist/
cd worker && npm run deploy # 推送 Worker + dist/ 至 Cloudflare
```

---

## 接口示例

### 5.1 签发

```bash
curl -OJ "http://localhost:8786/cert/?ca_name=code&va_time=2\
&in_mail=foo@bar.com&in_code=CN&in_main=Beijing&in_subs=Beijing\
&in_orgs=Demo&in_part=R%26D&in_data=test"
# -> 得到 <serial>.zip
```

ZIP 内含：

```
certificate.crt / private_key.pem / certificate.pfx / certificate.txt / cert_chains.crt
# ca_name=time 时额外：tsa.crt, tsa.key
```

### 5.2 OCSP

```bash
# OpenSSL 发起 OCSP 查询
openssl ocsp -issuer codeca.pem -cert cert.crt \
  -url https://<your-worker>/ocsp -resp_text
```

### 5.3 CRL

```bash
curl -OJ https://<your-worker>/crl/codeca.crl
openssl crl -in codeca.crl -inform DER -noout -text
```

### 5.4 吊销

```bash
curl -X POST https://<your-worker>/revoke \
  -H 'Content-Type: application/json' \
  --data-binary @- <<EOF
{
  "serial": "abcdef...",
  "privateKeyPem": "-----BEGIN PRIVATE KEY-----\n...",
  "reason": "keyCompromise"
}
EOF
```

校验不通过返回 401 `{done:false,text:"Invalid private key"}`；成功返回 `{done:true, serial, revokedAt}`。

### 5.5 TPM 虚拟智能卡证书分发（/card/\*）

把 TPMSmartCard 项目（Windows TPM 虚拟智能卡管理工具）中 `SmartCardWEB.py`
（Flask + 本地 pickle 文件）的能力迁移到 Worker：**传输层仍是 X25519 +
AES-256-CBC，存储层改为 Cloudflare KV**，协议逐字段兼容，现网智能卡工具无需改动。

工作流：

```
┌─ Windows 智能卡工具 ─┐          ┌──────────── Worker ────────────┐
│ 1. 生成临时 X25519    │          │                               │
│    密钥对 → 传输密钥   │          │                               │
│ 2. 打开上传页粘贴密钥  │ ───────► │ POST /card/put/cert           │
│    并上传 PFX + 密码   │          │  · 与客户端公钥协商共享密钥     │
│                       │          │  · AES-256-CBC 加密 PFX       │
│                       │          │  · 密文 + 服务端公钥写入 KV    │
│ 3. 点击导入           │ ◄─────── │ GET  /card/get/cert           │
│    · 协商同一共享密钥  │          │  · 返回 vaults/pubkey/pfxkey  │
│    · 解密 PFX → 写入   │          │                               │
│      TPM 虚拟智能卡    │          │                               │
└───────────────────────┘          └───────────────────────────────┘
```

| 路由 | 说明 |
| --- | --- |
| `GET`/`POST /card/get/cert` | 下发。`pubkey` 可放 query / urlencoded body / JSON / `x-pubkey` 头。命中：`{flag:true,data:{vaults,pubkey,pfxkey}}`；未命中：`{flag:false,data:null}`（与原 Flask 一致） |
| `POST /card/put/cert` | 上传。`multipart/form-data`：`pubkey`（传输密钥）、`pfxkey`（PFX 密码）、`vaults`（.pfx/.p12 文件）、可选 `label`。也支持 `vaults_b64`（base64 文本，便于脚本调用） |
| `GET`/`POST /card/status` | 仅查询某传输密钥是否已有缓存（只返回大小/时间/备注等元信息） |
| `GET /card/web/cert` | 浏览器上传页面（支持 `?pubkey=` 预填） |
| `GET /card/admin/list` | 缓存列表（需 `CARD_ADMIN_TOKEN`） |
| `POST /card/admin/delete` | 删除缓存（需令牌，字段 `fingerprint` 或 `pubkey`） |
| `GET /get/cert`、`POST /put/cert`、`GET /web/cert` | 旧 Flask 路径别名，便于反向代理把 `/card` 前缀重写掉的历史部署继续可用 |

安全模型：

- **端到端加密**：Worker 只用「客户端公钥 + 自己临时生成的私钥」协商共享密钥，
  加密后立即丢弃私钥，**不落盘共享密钥**。KV 中只有密文，即使 KV 被读取，
  没有客户端的临时私钥也无法解出 PFX。
- **传输密钥即凭证**：KV key = `card:v1:<SHA-256(客户端公钥)>`，公钥本身是
  一次性能力令牌（客户端每次「云端下发」都会重新生成）。
- **口令保护**：`pfxkey` 需要回传给客户端，默认明文落盘；配置 Secret
  `CARD_MASTER_KEY` 后改为 AES-256-GCM 包裹后再落盘（防 KV 快照泄露口令）。
- **时效**：默认 7 天自动过期（`CARD_TTL_SECONDS`，0 = 永不过期）；
  相同传输密钥重复上传视为覆盖。
- **校验**：拒绝非 PKCS#12 内容（DER 首字节非 `0x30`，如误传 `.crt/.pem`）、
  超过 `CARD_MAX_BYTES` 的文件、长度非 32 字节的传输密钥；下发响应带
  `Cache-Control: no-store`，页带 CSP。

> **关于「GET 带 body」**：智能卡工具旧版用
> `requests.get(url, data={"pubkey": pub})` 把传输密钥放在请求体里（这是 Flask
> 时代的写法）。已在真实 workerd 运行时验证该请求体会被完整保留、解析正常
> （见 `test/card-vault.test.ts` 的协议用例）。
> 若部署在中间还有会丢弃 GET body 的反向代理/CDN 之后，可让用户在工具的
> 「云端下发」地址里改成 query 形式：`https://<your-worker>/card/get/cert?pubkey=<传输密钥>`，
> 该形式在任何链路上都可用。

命令行快速验证（`pubkey` 换成工具里复制的传输密钥）：

```bash
curl -X POST https://<your-worker>/card/put/cert \
  -F "pubkey=<base64 传输密钥>" \
  -F "pfxkey=<PFX 密码>" \
  -F "vaults=@card.pfx" \
  -F "label=张三-笔记本"

# 取回（浏览器/工具即可；vaults 为密文，需客户端私钥解密）
curl "https://<your-worker>/card/get/cert?pubkey=<base64 传输密钥>"
```

可选配置（均非必需）：

```bash
# 独立 KV 命名空间（不配置则复用 CERT_KV，以 card:v1: 前缀隔离）
npx wrangler kv:namespace create CARD_KV

# 口令静态加密 + 管理接口
npx wrangler secret put CARD_MASTER_KEY
npx wrangler secret put CARD_ADMIN_TOKEN
```

---

## 目录结构

```
worker/
├─ src/
│  ├─ index.ts               # Hono 入口
│  ├─ env.ts                 # 环境变量类型
│  ├─ lib/
│  │  ├─ ca-registry.ts      # CA 元数据 + 公/私钥加载
│  │  ├─ bytes.ts            # 二进制/hex/base64 辅助
│  │  ├─ issuer.ts           # 证书签发核心
│  │  ├─ pfx.ts              # PKCS#12 打包
│  │  ├─ zipper.ts           # ZIP 组装
│  │  ├─ kv.ts               # KV 存储层（证书状态）
│  │  ├─ card-vault.ts       # 智能卡分发：X25519 + AES-256-CBC + KV
│  │  ├─ card-page.ts        # 智能卡证书上传页面（服务端渲染 HTML）
│  │  ├─ captcha.ts          # Cloudflare Turnstile 校验
│  │  ├─ ocsp.ts             # OCSP 响应构造
│  │  └─ crl.ts              # CRL 响应构造
│  ├─ routes/
│  │  ├─ cert.ts             # /cert/
│  │  ├─ ocsp.ts             # /ocsp, /ocsp/:b64
│  │  ├─ crl.ts              # /crl/:file
│  │  ├─ revoke.ts           # /revoke
│  │  └─ card.ts             # /card/*（智能卡证书上传/下发）
│  └─ __tests__/
│     └─ kv.test.ts
├─ test/
│  └─ card-vault.test.ts     # 密码学互通 + KV + HTTP 协议测试
├─ wrangler.toml
├─ tsconfig.json
└─ package.json
```

---

## 设计摘要

- **私钥**：仅通过 Wrangler Secret 注入 Worker 运行时；`certs/` 目录只存公钥证书（`.der`）。
- **KV Schema**：`cert:<serial>` 存 JSON 主记录；`byca:<ca>:<serial>` 与 `revoked:<ca>:<serial>` 作为二级索引。
- **OCSP 响应者**：独立的 `certs/ocsprs/ocsprs.der` + `OCSP_CA_KEY`，与签发 CA 解耦（RFC 6960 §2.2）。
- **CRL**：`crlNumber = floor(unix_ts)` 单调递增；`thisUpdate=now, nextUpdate=now+1d`；`Cache-Control: public, max-age=3600` 缓解压力。
- **吊销鉴权**：无账号体系，改以"持有私钥即所有者"判定（对私钥派生 SPKI，再比对 KV 中签发时记录的 SHA-256 指纹）。
- **密码学栈**：`WebCrypto` + `@peculiar/x509` + `pkijs`，完全避开 Node.js `crypto`/OpenSSL，满足 Workers/EdgeOne Pages Functions 的运行时限制。

---

## 与原 Python 服务的差异

| 维度 | Python (CAServer.py) | Worker (本项目) |
| --- | --- | --- |
| 运行时 | Flask + OpenSSL/cryptography | Cloudflare Workers + WebCrypto |
| 持久化 | 本地文件 `cache/` `saves/` | Cloudflare KV |
| OCSP/CRL | 未内建（仅静态 crl 文件） | 实时动态生成 |
| 证书吊销 | 未实现 | `POST /revoke`（私钥证明） |
| 前端托管 | 独立静态站点 / GitHub Pages | 与 API 同站，由 Workers Static Assets 托管 |
| 部署 | `python CAServer.py` | `wrangler deploy`（含前端）|

### 与 SmartCardWEB.py 的差异

| 维度 | Python (SmartCardWEB.py) | Worker (本项目 `/card/*`) |
| --- | --- | --- |
| 运行时 | Flask + Flask-Classful | Hono + Cloudflare Workers |
| 持久化 | 本地 `Caches/PullCerts.pkl`（pickle） | Cloudflare KV（`card:v1:<公钥 SHA-256>`，默认 7 天过期） |
| 加密 | `cryptography` X25519 + AES-CBC(零 IV) | WebCrypto X25519 + AES-CBC(零 IV)，**协议逐字节兼容** |
| 并发 | 进程内 `threading.Lock` + 全量重写文件 | KV 原子写入，多实例天然安全 |
| 口令存储 | 明文写 pickle | 明文或 `CARD_MASTER_KEY` 下 AES-256-GCM 加密 |
| 上传页面 | 静态 `templates/CertUpload.html`（POST 到 127.0.0.1:1080） | `/card/web/cert` 服务端渲染，含拖拽/校验/状态/管理面板 |
| 管理能力 | 无 | `/card/admin/list`、`/card/admin/delete`（令牌鉴权） |
| 输入校验 | 仅判空 | 校验 PKCS#12 结构、大小、公钥长度，并给出可读错误 |
