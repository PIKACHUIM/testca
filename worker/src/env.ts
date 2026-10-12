/**
 * Cloudflare Worker 环境类型声明
 *
 * - CERT_KV: 存储证书状态
 * - CERTS_ORIGIN: CA 静态 DER 证书的来源 origin（可回退到请求自身 origin）
 * - *_CA_KEY / OCSP_CA_KEY: 各 CA / OCSP 响应者的私钥（PEM, PKCS#8）
 * - TURNSTILE_SECRET / TURNSTILE_SITE_KEY: Cloudflare Turnstile 凭据
 *   （唯一支持的人机验证供应商，未配置时 Worker 会使用 Cloudflare
 *   官方公开的"总是通过"测试 key，仅供本地/演示使用）
 */
export interface Env {
  CERT_KV: KVNamespace;

  // ===== TPM 智能卡证书分发（Card Vault） =====
  /**
   * 智能卡分发密文的专用 KV 命名空间（可选）。
   * 未配置时自动复用 `CERT_KV`（记录以 `card:v1:` 前缀隔离）。
   */
  CARD_KV?: KVNamespace;
  /** 分发记录保留秒数（默认 604800 = 7 天；0 表示永不过期） */
  CARD_TTL_SECONDS?: string;
  /** 单个 PFX 大小上限（字节，默认 8388608 = 8 MiB） */
  CARD_MAX_BYTES?: string;
  /**
   * 可选：用该口令派生 AES-256-GCM 密钥，对 KV 中的 PFX 密码做静态加密。
   * 建议用 `wrangler secret put CARD_MASTER_KEY` 配置；一旦启用/更换，
   * 旧的未加密记录仍可读取，但已加密记录必须用同一口令才能解开。
   * 取件码模式下它同时充当指纹 pepper 的兜底。
   */
  CARD_MASTER_KEY?: string;
  /**
   * 管理员登录口令（建议 `wrangler secret put CARD_ADMIN_PASSWORD`）。
   * 配置后可用 `POST /card/admin/login` 换取会话令牌，会话令牌与
   * `CARD_ADMIN_TOKEN` 都能访问 `/card/admin/*` 与受保护的下发接口。
   */
  CARD_ADMIN_PASSWORD?: string;
  /**
   * 旧版管理接口静态令牌（可选，兼容脚本 / 旧部署）。
   * 与 `CARD_ADMIN_PASSWORD` 至少配置一个，管理接口才可用。
   */
  CARD_ADMIN_TOKEN?: string;
  /** 管理员会话有效期（秒，默认 43200 = 12 小时，钳制 300 ~ 604800） */
  CARD_ADMIN_SESSION_SECONDS?: string;
  /**
   * 是否允许**未登录**使用上传 / 生成取件码 / 状态查询 / 管理接口。
   * 默认 `true`；设为 `false` 后上述操作必须管理员登录
   * （取回接口不受限制：取件码 / 传输密钥本身即凭证）。
   */
  CARD_ALLOW_ANONYMOUS?: string;
  /** 登录失败容忍次数（每个窗口 / 每个来源 IP，默认 5） */
  CARD_LOGIN_MAX_FAILURES?: string;

  // ---- 取件码（自协商）模式 ----
  /** 取件码默认有效期（秒，默认 86400 = 24 小时；0 = 永不过期，上限 90 天） */
  CARD_CODE_TTL_SECONDS?: string;
  /** PBKDF2-SHA256 迭代次数（默认 100000，钳制在 10000 ~ 1000000） */
  CARD_CODE_ITERATIONS?: string;
  /** 取件码默认下发次数（默认 1，上限 100） */
  CARD_CODE_USES?: string;
  /**
   * 可选：取件码指纹 pepper（`sha256(pepper|取件码)` 作为 KV key）。
   * 未配置时依次回退 `CARD_MASTER_KEY`、内置常量；建议用
   * `wrangler secret put CARD_CODE_PEPPER` 配置，避免 KV key 可被离线枚举。
   */
  CARD_CODE_PEPPER?: string;

  /**
   * Cloudflare Workers Static Assets 绑定，由 wrangler.toml 的 [assets] 自动生成。
   * 用于在同一个 Worker 内同时托管前端 SPA 与后端 API。
   */
  ASSETS: Fetcher;

  CERTS_ORIGIN?: string;

  ROOT_CA_KEY?: string;
  TIME_CA_KEY?: string;
  UEFI_CA_KEY?: string;
  CODE_CA_KEY?: string;
  AUTH_CA_KEY?: string;
  FILE_CA_KEY?: string;
  MAIL_CA_KEY?: string;
  MTLS_CA_KEY?: string;
  SIGN_CA_KEY?: string;
  OCSP_CA_KEY?: string;

  // ===== Cloudflare Turnstile（唯一的人机验证） =====
  /** Turnstile Secret Key（`wrangler secret put TURNSTILE_SECRET`） */
  TURNSTILE_SECRET?: string;
  /** Turnstile Site Key（公开值，前端渲染 widget 使用） */
  TURNSTILE_SITE_KEY?: string;
}

export type HonoBindings = {
  Bindings: Env;
};
