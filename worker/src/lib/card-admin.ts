/**
 * TPM 智能卡证书分发 · 管理员认证
 *
 * 统一裁决「管理接口」与「是否允许未登录下发」：
 *
 * 1. **口令登录**：配置 `CARD_ADMIN_PASSWORD` 后可用 `POST /card/admin/login`
 *    换取**无状态会话令牌**（HMAC-SHA256 签名 + 过期时间），客户端以
 *    `Authorization: Bearer <token>` 或 `x-admin-token: <token>` 带回。
 *    签名密钥由口令派生，因此改口令即让所有旧会话失效。
 * 2. **静态令牌（兼容旧部署）**：配置 `CARD_ADMIN_TOKEN` 时，该值本身也可直接当凭证。
 * 3. **匿名开关**：`CARD_ALLOW_ANONYMOUS`（默认 `true`）。设为 `false` 后，
 *    上传 / 生成取件码 / 状态查询 / 管理接口都必须管理员登录；
 *    **取回（get）不受影响** —— 取件码或传输密钥本身就是取回凭证，
 *    否则目标机器将无法自助取回证书。
 *
 * 登录失败按来源 IP 在 KV 计数（默认 5 次 / 10 分钟），超限直接拒绝，
 * 用于缓解口令爆破。
 */
import type { Env } from "../env";
import { asBufferSource, fromBase64Url, randAscii, toBase64Url, toHex } from "./bytes";
import { resolveCardKv, timingSafeEqual } from "./card-vault";

/** 会话令牌前缀（同时用于区分「会话」与「静态令牌」） */
const SESSION_PREFIX = "cardadm.v1";
const DEFAULT_SESSION_SECONDS = 12 * 60 * 60;
const MAX_SESSION_SECONDS = 7 * 24 * 60 * 60;
/** 登录失败容忍次数（每个窗口 / 每个来源 IP） */
export const LOGIN_MAX_FAILURES = 5;
/** 失败计数的窗口（秒），同时作为 KV TTL */
export const LOGIN_WINDOW_SECONDS = 600;
const FAIL_PREFIX = "card:v2:admin:fail:";

export interface AdminPolicy {
  /** 已配置 CARD_ADMIN_PASSWORD → 可口令登录 */
  passwordLogin: boolean;
  /** 已配置 CARD_ADMIN_TOKEN → 可用静态令牌 */
  tokenLogin: boolean;
  /** 任一可用即启用管理接口 */
  adminEnabled: boolean;
  /** 是否允许未登录使用上传 / 状态查询 / 管理接口 */
  allowAnonymous: boolean;
  /** 会话有效期（秒） */
  sessionSeconds: number;
}

export interface AdminAuth {
  ok: boolean;
  /** 认证方式：session = 登录会话；token = 静态令牌 */
  via?: "session" | "token";
  expiresAt?: string;
  reason?: string;
}

export interface AdminSession {
  token: string;
  expiresAt: string;
  seconds: number;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return fallback;
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function adminPolicy(env: Env): AdminPolicy {
  const password = (env.CARD_ADMIN_PASSWORD ?? "").trim();
  const token = (env.CARD_ADMIN_TOKEN ?? "").trim();
  const sessionSeconds = Math.min(
    Math.max(
      positiveInt(env.CARD_ADMIN_SESSION_SECONDS, DEFAULT_SESSION_SECONDS),
      300,
    ),
    MAX_SESSION_SECONDS,
  );
  return {
    passwordLogin: password.length > 0,
    tokenLogin: token.length > 0,
    adminEnabled: password.length > 0 || token.length > 0,
    allowAnonymous: flag(env.CARD_ALLOW_ANONYMOUS, true),
    sessionSeconds,
  };
}

// ---------------------------------------------------------------------------
// 会话令牌：cardadm.v1.<payloadB64Url>.<sigB64Url>
// ---------------------------------------------------------------------------

async function sessionKey(env: Env): Promise<CryptoKey | null> {
  const password = (env.CARD_ADMIN_PASSWORD ?? "").trim();
  if (!password) return null;
  const material = new TextEncoder().encode(`${SESSION_PREFIX}|${password}`);
  const digest = await crypto.subtle.digest("SHA-256", asBufferSource(material));
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signSession(env: Env, data: string): Promise<string | null> {
  const key = await sessionKey(env);
  if (!key) return null;
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    asBufferSource(new TextEncoder().encode(data)),
  );
  return toBase64Url(sig);
}

/**
 * 校验管理员口令并签发会话令牌。
 * 未配置 `CARD_ADMIN_PASSWORD` 或口令不匹配时返回 null。
 */
export async function createAdminSession(
  env: Env,
  password: string,
): Promise<AdminSession | null> {
  const expect = (env.CARD_ADMIN_PASSWORD ?? "").trim();
  if (!expect) return null;
  if (!timingSafeEqual((password ?? "").trim(), expect)) return null;

  const seconds = adminPolicy(env).sessionSeconds;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    iat: now,
    exp: now + seconds,
    n: randAscii(16),
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const head = `${SESSION_PREFIX}.${body}`;
  const sig = await signSession(env, head);
  if (!sig) return null;
  return {
    token: `${head}.${sig}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    seconds,
  };
}

/** 校验任意管理员凭证（登录会话或静态令牌） */
export async function verifyAdminCredential(
  env: Env,
  credential: string | undefined,
): Promise<AdminAuth> {
  const policy = adminPolicy(env);
  if (!policy.adminEnabled) return { ok: false, reason: "admin_disabled" };
  const cred = (credential ?? "").trim();
  if (!cred) return { ok: false, reason: "missing" };

  if (cred.startsWith(`${SESSION_PREFIX}.`)) {
    const parts = cred.split(".");
    if (parts.length !== 4) return { ok: false, reason: "malformed" };
    // 签名覆盖「前缀 + payload」，签名本身是 base64url（不含 "."）
    const expect = await signSession(env, `${parts[0]}.${parts[1]}.${parts[2]}`);
    if (!expect || !timingSafeEqual(parts[3], expect)) {
      return { ok: false, reason: "bad_signature" };
    }
    let payload: { exp?: unknown } | null = null;
    try {
      payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[2])));
    } catch {
      return { ok: false, reason: "malformed" };
    }
    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: "malformed" };
    if (Math.floor(Date.now() / 1000) >= exp) return { ok: false, reason: "expired" };
    return {
      ok: true,
      via: "session",
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  const token = (env.CARD_ADMIN_TOKEN ?? "").trim();
  if (token && timingSafeEqual(cred, token)) return { ok: true, via: "token" };
  return { ok: false, reason: "invalid" };
}

// ---------------------------------------------------------------------------
// 登录失败限流（按来源 IP，KV 计数）
// ---------------------------------------------------------------------------

async function failKey(env: Env, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    asBufferSource(new TextEncoder().encode(`card-admin-ip|${ip}`)),
  );
  return FAIL_PREFIX + toHex(digest).slice(0, 24);
}

export async function loginThrottle(
  env: Env,
  ip: string,
): Promise<{ blocked: boolean; failures: number; max: number }> {
  const max = positiveInt(env.CARD_LOGIN_MAX_FAILURES, LOGIN_MAX_FAILURES);
  try {
    const kv = resolveCardKv(env);
    const raw = await kv.get(await failKey(env, ip));
    const failures = raw ? Number.parseInt(raw, 10) || 0 : 0;
    return { blocked: failures >= max, failures, max };
  } catch {
    // KV 不可用时不做限流，避免把登录整体拖垮
    return { blocked: false, failures: 0, max };
  }
}

/** 记录一次失败，返回累计失败次数 */
export async function recordLoginFailure(env: Env, ip: string): Promise<number> {
  try {
    const kv = resolveCardKv(env);
    const key = await failKey(env, ip);
    const raw = await kv.get(key);
    const failures = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    await kv.put(key, String(failures), { expirationTtl: LOGIN_WINDOW_SECONDS });
    return failures;
  } catch {
    return 0;
  }
}

export async function clearLoginFailures(env: Env, ip: string): Promise<void> {
  try {
    await resolveCardKv(env).delete(await failKey(env, ip));
  } catch {
    /* 忽略：清理失败不影响登录结果 */
  }
}
