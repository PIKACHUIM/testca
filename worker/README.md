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
| 智能卡证书分发 | `GET/POST /card/get/cert` | 取回加密后的 PFX（`pubkey` 传输密钥 / `code` 取件码） |
| 智能卡证书上传 | `POST /card/put/cert` | 上传 PFX，Worker 侧加密后存入 KV（`mode=code` 生成取件码） |
| 智能卡取件码下发 | `GET/POST /card/get/code` | 取件码（自协商）模式下发，无需事先协商密钥 |
| 智能卡取件码状态 | `GET/POST /card/code/status` | 查询取件码剩余次数 / 有效期（不核销） |
| 智能卡上传页面 | `GET /card/web/cert` | 浏览器上传界面（服务端渲染，无外部依赖） |
| 智能卡管理员登录 | `POST /card/admin/login` | 口令换取会话令牌（管理缓存、关闭匿名下发时使用） |
| 智能卡会话状态 | `GET/POST /card/admin/session` | 登录状态 + 站点策略（是否允许未登录下发） |
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
（Flask + 本地 pickle 文件）的能力迁移到 Worker：**传输层仍是 X25519 /
AES-256-CBC，存储层改为 Cloudflare KV**，协议逐字段兼容，现网智能卡工具无需改动。

在此之上新增**取件码（自协商）模式**：上传时由平台生成带有效期与下发次数的口令，
客户端**无需事先与平台交换任何密钥**，只要填写取件码即可取回并解密。

两种模式对比：

| | 传输密钥模式（v1） | 取件码模式（v2，自协商） |
| --- | --- | --- |
| 前置动作 | 工具先生成 X25519 密钥对并把公钥交给平台 | 无，平台上传后直接生成口令 |
| 客户端凭据 | 临时私钥（进程内） | 取件码（人可抄写，可跨设备输入） |
| 密钥 | X25519 协商出的共享密钥 | `PBKDF2-SHA256(取件码, salt, iterations)` |
| 有效期 | `CARD_TTL_SECONDS`（默认 7 天，全局） | 单次上传可选（默认 24 小时，上限 90 天） |
| 下发次数 | 不限（或人工删除） | 1 ~ 100，用尽即销毁 |
| KV key | `card:v1:<SHA-256(公钥)>` | `card:v2:code:<SHA-256(pepper\|取件码)>` |

工作流（A：传输密钥）：

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

工作流（B：取件码 / 自协商，工具端无需预先生成任何密钥）：

```
┌─ 平台（网页/脚本） ──┐          ┌──────────── Worker ────────────┐
│ 1. 上传 PFX + 密码    │ ───────► │ POST /card/put/cert (mode=code)│
│    可选：有效期/次数   │          │  · 生成取件码 → PBKDF2 派生 K  │
│ ◄── 取件码（仅一次）──│          │  · 加密 PFX+口令 → KV (v2)     │
└──────────────────────┘          │                               │
┌─ Windows 智能卡工具 ─┐          │                               │
│ 2. 云端下发 → 取件码  │ ───────► │ GET /card/get/cert?code=…     │
│    填写取件码         │          │  · 校验有效期/次数 → used+1    │
│ 3. 本地 PBKDF2 派生   │ ◄─────── │  · 返回 vaults/salt/iterations│
│    解密 → 写入卡片    │          │                               │
└───────────────────────┘          └───────────────────────────────┘
```

| 路由 | 说明 |
| --- | --- |
| `GET`/`POST /card/get/cert` | 下发。`pubkey`（传输密钥）或 `code`（取件码）可放 query / urlencoded body / JSON / `x-pubkey` 头；传 `code` 时自动走取件码模式。命中：`{flag:true,data:{…}}`；未命中：`{flag:false,data:null}`（与原 Flask 一致） |
| `POST /card/put/cert` | 上传。`multipart/form-data`：`pubkey` 或 `mode=code`、`pfxkey`（PFX 密码）、`vaults`（.pfx/.p12 文件）、可选 `label`；取件码模式另支持 `ttl`（秒，0=永久）、`max_uses`、`code`（自定义取件码，≥8 个不同字符；留空则平台自动生成）。也支持 `vaults_b64`（base64 文本，便于脚本调用） |
| `GET`/`POST /card/status` | 查询缓存：传 `pubkey` 查传输密钥，传 `code` 查取件码（只返回元信息） |
| `GET`/`POST /card/get/code` | 取件码模式下发（显式入口，等同 `/card/get/cert?code=`） |
| `POST /card/put/code` | 取件码模式上传（显式入口，等同 `mode=code`） |
| `GET`/`POST /card/code/status` | 查询取件码剩余次数 / 有效期（**不核销**） |
| `GET /card/web/cert` | 浏览器上传页面（支持 `?pubkey=` 预填、`?mode=code\|key` 指定默认模式） |
| `POST /card/admin/login` | 管理员登录：`password` 换取会话令牌（`CARD_ADMIN_PASSWORD`） |
| `GET`/`POST /card/admin/session` | 查询登录状态 + 站点策略（匿名开关、是否启用口令登录） |
| `GET /card/admin/list` | 缓存列表（两种模式，需登录会话或 `CARD_ADMIN_TOKEN`） |
| `POST /card/admin/delete` | 删除缓存（同样需鉴权，字段 `fingerprint` / `code` / `pubkey`） |
| `GET /get/cert`、`POST /put/cert`、`GET /web/cert` | 旧 Flask 路径别名，便于反向代理把 `/card` 前缀重写掉的历史部署继续可用 |

取件码格式：16 位，按 4 位分组（`XXXX-XXXX-XXXX-XXXX`），字母表为
`0-9 + A-Z` 去掉 `I/L/O`（这三个字符在输入时分别按 `1/1/0` 归一，因此大小写、
`-` / 空格等分隔符、易混字符都不影响取回），约 80.7 bit 熵。

取件码两种来源（上传页与 API 都支持）：

| 来源 | 表单 | 说明 |
| --- | --- | --- |
| **平台自动生成**（默认） | 取件码留空 | 上传成功后由 Worker 随机生成，响应里**只返回一次**，请及时复制 |
| **自定义 / 一键随机** | 填 `code=…`（或页面上点「一键随机」） | 页面即时预览（分组形式）与复制；格式与强度在提交前本地校验，服务端再校验一次 |

> 自定义取件码是唯一保护 PFX 的密钥，因此服务端强制**至少 8 个不同字符**
> （`CODE_MIN_DISTINCT`）：`1111111111111111`、`ABABABABABABABAB` 这类会被
> `400` 拒绝并提示「太弱」；不满足时改用「一键随机」即可（本地生成的是 80 bit 熵的随机码）。

#### 管理员登录与「是否允许未登录下发」

配置 `CARD_ADMIN_PASSWORD`（推荐 Secret）后，`POST /card/admin/login` 用口令换取
一个**无状态会话令牌**（`cardadm.v1.<payload>.<HMAC>`，默认 12 小时有效），
浏览器页面（React 与管理页）与脚本都可以拿它访问：

- 缓存管理：`/card/admin/list`、`/card/admin/delete`（可管理传输密钥与取件码两种记录）
- 受保护的下发操作（当 `CARD_ALLOW_ANONYMOUS=false` 时）

| 行为 | `CARD_ALLOW_ANONYMOUS=true`（默认） | `CARD_ALLOW_ANONYMOUS=false` |
| --- | --- | --- |
| `POST /card/put/cert`、`/card/put/code` | 任何人可上传并生成取件码 | 必须管理员登录 |
| `/card/status`、`/card/code/status` | 任何人可查询 | 必须管理员登录 |
| `/card/admin/list`、`/card/admin/delete` | 必须管理员登录 | 必须管理员登录 |
| `/card/get/cert`、`/card/get/code`（取回） | 凭取件码 / 传输密钥 | **同样凭取件码 / 传输密钥**（凭证即授权，否则目标机器无法自助取回） |

安全要点：

- 签名密钥由口令派生，**改口令即让所有旧会话立即失效**；令牌不可被离线伪造。
- 口令比较、令牌签名比较均为定长比较；登录失败按来源 IP 计入 KV
  （默认 5 次 / 10 分钟，`CARD_LOGIN_MAX_FAILURES` 可调），超限直接 429。
- 兼容旧的静态令牌 `CARD_ADMIN_TOKEN`（脚本友好）：它可直接作为
  `x-admin-token` / `Authorization: Bearer` / `?token=` 使用，无需先登录。
- 会话令牌只保存在浏览器 `sessionStorage`（关闭标签页即失效），管理页也支持
  「记住令牌」写入本机 `localStorage`。

```bash
# 登录换取会话令牌（返回 data.token）
curl -X POST https://<your-worker>/card/admin/login -d "password=<管理员口令>"

# 用会话令牌查询 / 删除
curl -H "x-admin-token: cardadm.v1.xxx.yyy" https://<your-worker>/card/admin/list
curl -X POST -H "x-admin-token: cardadm.v1.xxx.yyy" \
  -d "code=XXXX-XXXX-XXXX-XXXX" https://<your-worker>/card/admin/delete

# 查询当前登录状态与站点策略（无需凭证也可调用）
curl https://<your-worker>/card/admin/session
```

安全模型：

- **传输密钥模式**：Worker 只用「客户端公钥 + 自己临时生成的私钥」协商共享密钥，
  加密后立即丢弃私钥，**不落盘共享密钥**。KV 中只有密文，即使 KV 被读取，
  没有客户端的临时私钥也无法解出 PFX。
- **取件码模式**：取件码本身即密钥。服务端只保存
  `SHA-256(pepper | 取件码)` 指纹与随机盐，**不保存明文取件码**；密文用
  `PBKDF2-SHA256(取件码, salt, iterations)` 派生出的 AES-256 密钥加密，
  没有取件码即使拿到 KV 快照也只能靠离线爆破（需支付 PBKDF2 迭代成本）。
  建议用 `wrangler secret put CARD_CODE_PEPPER` 配置 pepper（未配置时回退
  `CARD_MASTER_KEY`，再回退内置常量），使 KV key 不可被直接枚举。
- **口令保护**：v1 的 `pfxkey` 需要回传给客户端，默认明文落盘；配置 Secret
  `CARD_MASTER_KEY` 后改为 AES-256-GCM 包裹后再落盘。v2 的 `pfxkey` 直接
  作为加密载荷的一部分（随取件码一起加密），**从不单独落盘**。
- **时效**：v1 默认 7 天自动过期（`CARD_TTL_SECONDS`，0 = 永不过期）；
  v2 默认 24 小时（`CARD_CODE_TTL_SECONDS`，单次上传可用 `ttl` 覆盖，上限 90 天），
  KV TTL 与记录内的 `expiresAt` 双保险。
- **下发次数**：v2 每次成功取回 `used + 1`，用尽立即删除记录；
  注意 KV 为最终一致存储，并发取回可能「超发」，
  需要严格一次性的场景请保持默认 `max_uses = 1`。
- **校验**：拒绝非 PKCS#12 内容（DER 首字节非 `0x30`，如误传 `.crt/.pem`）、
  超过 `CARD_MAX_BYTES` 的文件、长度非 32 字节的传输密钥、格式非法的取件码；
  下发响应带 `Cache-Control: no-store`，页带 CSP。

> **关于「GET 带 body」**：智能卡工具旧版用
> `requests.get(url, data={"pubkey": pub})` 把传输密钥放在请求体里（这是 Flask
> 时代的写法）；取件码模式同样是 `requests.get(url, data={"code": code})`。
> 已在真实 workerd 运行时验证该请求体会被完整保留、解析正常
> （见 `test/card-vault.test.ts`、`test/card-code.test.ts` 的协议用例）。
> 若部署在中间还有会丢弃 GET body 的反向代理/CDN 之后，可让用户在工具的
> 「云端下发」地址里改成 query 形式：`https://<your-worker>/card/get/cert?code=<取件码>`，
> 该形式在任何链路上都可用。

命令行快速验证：

```bash
# ---- 传输密钥模式（pubkey 换成工具里复制的传输密钥）----
curl -X POST https://<your-worker>/card/put/cert \
  -F "pubkey=<base64 传输密钥>" \
  -F "pfxkey=<PFX 密码>" \
  -F "vaults=@card.pfx" \
  -F "label=张三-笔记本"

# 取回（浏览器/工具即可；vaults 为密文，需客户端私钥解密）
curl "https://<your-worker>/card/get/cert?pubkey=<base64 传输密钥>"

# ---- 取件码（自协商）模式 ----
# 上传并由平台生成取件码（响应 data.code）；ttl 秒、max_uses 下发次数
curl -X POST https://<your-worker>/card/put/code \
  -F "pfxkey=<PFX 密码>" \
  -F "vaults=@card.pfx" \
  -F "ttl=86400" \
  -F "max_uses=1" \
  -F "label=张三-笔记本"

# 自定义取件码（至少 8 个不同字符；留空/不传则平台自动生成）
curl -X POST https://<your-worker>/card/put/code \
  -F "code=ABCD-EFGH-JKMN-PQRS" \
  -F "pfxkey=<PFX 密码>" \
  -F "vaults=@card.pfx" \
  -F "ttl=86400" \
  -F "max_uses=1"

# 查询剩余次数 / 有效期（不消耗）
curl "https://<your-worker>/card/code/status?code=XXXX-XXXX-XXXX-XXXX"

# 取回（返回 vaults/salt/iterations/kdf，工具端本地 PBKDF2 + AES-CBC 解密）
curl -X POST https://<your-worker>/card/get/code \
  -d "code=XXXX-XXXX-XXXX-XXXX"
```

> 客户端侧解密（与 TPMSmartCard 的 `Module/Cryptography.py` + `hashlib` 等价）：
> `key = pbkdf2_hmac("sha256", 规范化取件码, salt, iterations, 32)` →
> `AES-256-CBC(key, 零 IV, PKCS#7)` 解出载荷
> `{"v":1,"pfx":"<base64>","pfxkey":"…","label":"…"}`。

可选配置（均非必需）：

```bash
# 独立 KV 命名空间（不配置则复用 CERT_KV，以 card:v1: / card:v2:code: 前缀隔离）
npx wrangler kv:namespace create CARD_KV

# 管理员登录口令（管理接口 / 关闭匿名下发时的凭据）
npx wrangler secret put CARD_ADMIN_PASSWORD

# 口令静态加密 + 取件码指纹 pepper
npx wrangler secret put CARD_MASTER_KEY
npx wrangler secret put CARD_CODE_PEPPER

# 旧版静态管理令牌（可选，脚本 / 兼容旧部署）
npx wrangler secret put CARD_ADMIN_TOKEN
```

取件码模式相关变量（见 `wrangler.toml`）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `CARD_CODE_TTL_SECONDS` | `86400` | 取件码默认有效期（秒，0 = 永不过期，上限 90 天） |
| `CARD_CODE_USES` | `1` | 取件码默认下发次数（上限 100） |
| `CARD_CODE_ITERATIONS` | `100000` | PBKDF2-SHA256 迭代次数（钳制 10000 ~ 1000000） |
| `CARD_CODE_PEPPER`（Secret） | 回退 `CARD_MASTER_KEY` | 取件码指纹 pepper |
| `CARD_ALLOW_ANONYMOUS` | `true` | 是否允许未登录上传 / 生成取件码 / 查询缓存；`false` = 需管理员登录 |
| `CARD_ADMIN_PASSWORD`（Secret） | — | 管理员登录口令（配合 `/card/admin/login`） |
| `CARD_ADMIN_SESSION_SECONDS` | `43200` | 管理员会话有效期（秒，钳制 300 ~ 604800） |
| `CARD_LOGIN_MAX_FAILURES` | `5` | 登录失败容忍次数（每个窗口 / 每个来源 IP） |
| `CARD_ADMIN_TOKEN`（Secret） | — | 旧版静态管理令牌（可选） |

> 免费套餐的 Worker CPU 时间预算较小，如取件码上传/取回超时，可把
> `CARD_CODE_ITERATIONS` 下调到 `10000 ~ 20000`（客户端会收到响应里的
> `iterations` 并自适应，无需改客户端）。

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
│  │  ├─ card-code.ts        # 取件码（自协商）：PBKDF2 + 有效期 / 下发次数
│  │  ├─ card-admin.ts       # 管理员登录（会话令牌）+ 匿名开关 + 登录限流
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
│  ├─ card-vault.test.ts     # 密码学互通 + KV + HTTP 协议测试
│  ├─ card-code.test.ts      # 取件码模式：规范化 / PBKDF2 互通 / 时效与次数
│  └─ card-admin.test.ts     # 管理员登录 / 会话令牌 / 匿名开关 / 登录限流
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
| 持久化 | 本地 `Caches/PullCerts.pkl`（pickle） | Cloudflare KV（`card:v1:<公钥 SHA-256>` / `card:v2:code:<指纹>`，默认 7 天 / 24 小时过期） |
| 加密 | `cryptography` X25519 + AES-CBC(零 IV) | WebCrypto X25519 + AES-CBC(零 IV)，**协议逐字节兼容** |
| 并发 | 进程内 `threading.Lock` + 全量重写文件 | KV 原子写入，多实例天然安全 |
| 口令存储 | 明文写 pickle | 明文或 `CARD_MASTER_KEY` 下 AES-256-GCM 加密；取件码模式随载荷整体加密 |
| 下发方式 | 交换密钥（X25519）后按传输密钥取回 | 传输密钥模式 + **取件码（自协商）模式**（有效期 / 下发次数） |
| 上传页面 | 静态 `templates/CertUpload.html`（POST 到 127.0.0.1:1080） | `/card/web/cert` 服务端渲染，含模式切换/拖拽/校验/状态/管理面板 |
| 管理能力 | 无 | `/card/admin/list`、`/card/admin/delete`（口令登录会话 / 静态令牌鉴权），支持关闭匿名下发 |
| 输入校验 | 仅判空 | 校验 PKCS#12 结构、大小、公钥长度、取件码格式，并给出可读错误 |
