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
   */
  CARD_MASTER_KEY?: string;
  /** 可选：`/card/admin/*` 管理接口令牌（未配置则管理接口禁用） */
  CARD_ADMIN_TOKEN?: string;

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
