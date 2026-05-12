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
  SSH2_CA_KEY?: string;
  ACME_CA_KEY?: string;
  SSL3_CA_KEY?: string;
  IOTS_CA_KEY?: string;
  NETS_CA_KEY?: string;
  CARD_CA_KEY?: string;
  FIDO_CA_KEY?: string;
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
