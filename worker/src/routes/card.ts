/**
 * /card/*  —— TPM 虚拟智能卡证书分发路由
 * ============================================================================
 * 对应 TPMSmartCard 项目的 SmartCardWEB.py（Flask），协议保持逐字段兼容，
 * 因此现网的智能卡工具无需改动即可指向本 Worker。同时保留旧版的根路径
 * 别名（/get/cert、/put/cert、/web/cert），以便反向代理把 /card 前缀重写掉
 * 的历史部署继续可用。
 *
 * 支持两种下发改方式：
 *   A) 传输密钥模式（默认，v1）：客户端先生成 X25519 临时密钥并把公钥交给平台，
 *      平台用该公钥协商后加密，客户端凭私钥解密（`card-vault.ts`）。
 *   B) 取件码模式（自协商，v2）：上传时由平台生成随机口令（含有效期与下发次数），
 *      客户端只需填写该口令即可取回并解密（`card-code.ts`）。
 *   两者共用同一组入口，按请求字段自动分派：带 `code`（或 `mode=code`）走 B。
 *
 * 路由清单（prefix = /card）：
 *   GET|POST /card/get/cert   —— 下发（pubkey=传输密钥 或 code=取件码）
 *   POST     /card/put/cert   —— 上传（multipart：pubkey|mode=code + pfxkey + vaults）
 *   GET|POST /card/status     —— 仅查询该传输密钥是否已有缓存
 *   GET|POST /card/get/code   —— 取件码模式下发（显式入口）
 *   POST     /card/put/code   —— 取件码模式上传（显式入口，等同 mode=code）
 *   GET|POST /card/code/status—— 查询取件码剩余次数 / 有效期（不核销）
 *   GET      /card/web/cert   —— 浏览器上传页面
 *   POST     /card/admin/login —— 管理员登录，换取会话令牌
 *   GET|POST /card/admin/session —— 查询登录状态与站点策略（匿名开关等）
 *   GET      /card/admin/list —— 缓存列表（需登录或 CARD_ADMIN_TOKEN）
 *   POST     /card/admin/delete —— 删除某条缓存（需登录或 CARD_ADMIN_TOKEN）
 *   GET      /card            —— 跳转到上传页面
 *
 * 鉴权：`CARD_ADMIN_PASSWORD` 登录会话 / `CARD_ADMIN_TOKEN` 静态令牌，
 * 见 `card-admin.ts`；`CARD_ALLOW_ANONYMOUS=false` 时上传 / 查询 / 管理均需登录。
 */
import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { Env, HonoBindings } from "../env";
import {
  CardVaultError,
  deleteVaultByFingerprint,
  deleteVaultByPubkey,
  listVaults,
  openVault,
  parseClientPubkey,
  sealVault,
  vaultStatus,
} from "../lib/card-vault";
import {
  codeVaultStatus,
  deleteCodeVault,
  redeemCodeVault,
  resolveCodeTtlSeconds,
  resolveDefaultMaxUses,
  sealCodeVault,
} from "../lib/card-code";
import {
  adminPolicy,
  clearLoginFailures,
  createAdminSession,
  loginThrottle,
  recordLoginFailure,
  verifyAdminCredential,
} from "../lib/card-admin";
import { renderCardUploadPage } from "../lib/card-page";
import { fromBase64 } from "../lib/bytes";

/** 下发内容与口令一律禁止缓存 */
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// ---------------------------------------------------------------------------
// 参数解析
// ---------------------------------------------------------------------------

interface Incoming {
  fields: Record<string, string>;
  files: Record<string, File>;
}

/**
 * 同时兼容多种提交方式，优先顺序：query → body（后者覆盖前者）：
 *   - query string（GET /status?pubkey=…）
 *   - multipart/form-data（浏览器页面上传 PFX）
 *   - application/x-www-form-urlencoded（Python requests.get(url, data={...})，
 *     Fetch 规范本不允许 GET 带 body，但 workerd 会保留线上真实请求的 body，
 *     因此旧客户端 `requests.get(url, data={"pubkey": pub})` 依然可用）
 *   - application/json
 */
async function parseIncoming(c: Context<HonoBindings>): Promise<Incoming> {
  const fields: Record<string, string> = {};
  const files: Record<string, File> = {};

  for (const [k, v] of new URL(c.req.url).searchParams) fields[k] = v;

  const ct = (c.req.header("content-type") || "").toLowerCase();
  const declared =
    c.req.header("content-length") || c.req.header("transfer-encoding");
  if (!ct && !declared) return { fields, files };

  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await c.req.formData();
      fd.forEach((v, k) => {
        if (typeof v === "string") fields[k] = v;
        else files[k] = v as File;
      });
    } else if (ct.includes("application/json")) {
      const j = (await c.req.json()) as Record<string, unknown> | null;
      if (j && typeof j === "object") {
        for (const [k, v] of Object.entries(j)) {
          if (v !== null && v !== undefined) fields[k] = String(v);
        }
      }
    } else {
      const text = await c.req.text();
      if (text) {
        const body = text.trim();
        if (body.startsWith("{")) {
          const j = JSON.parse(body) as Record<string, unknown>;
          for (const [k, v] of Object.entries(j)) {
            if (v !== null && v !== undefined) fields[k] = String(v);
          }
        } else if (body.includes("=")) {
          for (const [k, v] of new URLSearchParams(body)) fields[k] = v;
        }
      }
    }
  } catch (e) {
    console.warn("[card] 请求体解析失败（已忽略）", e);
  }
  return { fields, files };
}

function firstField(fields: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    const v = fields[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
}

/** 解析可选数字字段（缺省/非法 → undefined，交由默认值逻辑处理） */
function optionalNumber(fields: Record<string, string>, ...names: string[]): number | undefined {
  const raw = firstField(fields, ...names);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * 读取请求中的 PFX 二进制：
 *   - multipart 文件字段 `vaults`（兼容 file / pfx / p12 / 首个文件）
 *   - 或 base64 文本字段 `vaults_b64` / `pfx_b64`（便于脚本 / curl 调用）
 */
async function extractPfx(
  files: Record<string, File>,
  fields: Record<string, string>,
): Promise<Uint8Array> {
  const file =
    files.vaults ||
    files.file ||
    files.pfx ||
    files.p12 ||
    Object.values(files)[0];
  if (file) return new Uint8Array(await file.arrayBuffer());
  const b64 = firstField(fields, "vaults_b64", "pfx_b64", "vaults");
  if (!b64) throw new CardVaultError("缺少 PFX 文件（multipart 字段名 vaults）");
  try {
    return fromBase64(b64.trim());
  } catch {
    throw new CardVaultError("vaults/vaults_b64 不是合法的 Base64 内容");
  }
}

function cardError(
  c: Context<HonoBindings>,
  e: unknown,
  status: ContentfulStatusCode = 400,
) {
  const err = e as Error;
  const msg = err?.message || String(e);
  if (!(e instanceof CardVaultError)) {
    console.error("[card] 内部错误", err?.stack || err);
  }
  return c.json({ flag: false, data: null, text: msg }, status, NO_STORE);
}

// ---------------------------------------------------------------------------
// 下发：GET|POST <prefix>/get/cert （pubkey = 传输密钥 / code = 取件码）
// ---------------------------------------------------------------------------

/** 取件码失败时统一的响应（200 + flag:false，便于旧客户端与工具直接展示 text） */
function codeFailure(
  c: Context<HonoBindings>,
  reason: string,
  text: string,
) {
  const status: ContentfulStatusCode = reason === "bad_format" ? 400 : 200;
  return c.json({ flag: false, data: null, reason, text }, status, NO_STORE);
}

async function getCert(c: Context<HonoBindings>, forceCode: boolean) {
  const env = c.env as Env;
  try {
    const { fields } = await parseIncoming(c);
    const code = firstField(fields, "code", "pickup_code", "pickup", "pickupcode");
    const pubkey =
      firstField(fields, "pubkey", "pub", "x-pubkey") ||
      c.req.header("x-pubkey") ||
      "";

    // 取件码模式：显式入口，或未提供传输密钥但提供了取件码
    if (forceCode || (!pubkey.trim() && code.trim())) {
      if (!code.trim()) {
        throw new CardVaultError("缺少 code（取件码）");
      }
      const res = await redeemCodeVault(env, code.trim());
      if (!res.ok) return codeFailure(c, res.reason, res.text);
      return c.json({ flag: true, data: res.data, meta: res.meta }, 200, NO_STORE);
    }

    if (!pubkey.trim()) {
      return c.json(
        { flag: false, data: null, text: "缺少 pubkey（传输密钥）或 code（取件码）" },
        400,
        NO_STORE,
      );
    }
    const vault = await openVault(env, pubkey.trim());
    if (!vault) {
      // 与 SmartCardWEB.py 完全一致：未命中返回 200 + flag:false
      return c.json({ flag: false, data: null }, 200, NO_STORE);
    }
    return c.json(
      {
        flag: true,
        data: {
          mode: "key",
          vaults: vault.vaults,
          pubkey: vault.pubkey,
          pfxkey: vault.pfxkey,
        },
        meta: vault.meta,
      },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

async function handleGetCert(c: Context<HonoBindings>) {
  return getCert(c, false);
}

/** 显式取件码入口：GET|POST <prefix>/get/code */
async function handleGetCodeCert(c: Context<HonoBindings>) {
  return getCert(c, true);
}

// ---------------------------------------------------------------------------
// 取件码状态：GET|POST <prefix>/code/status （不核销）
// ---------------------------------------------------------------------------

async function handleCodeStatus(c: Context<HonoBindings>) {
  const env = c.env as Env;
  try {
    const { fields } = await parseIncoming(c);
    const deny = await requireAnonymousOrAdmin(c, fields);
    if (deny) return deny;
    const code = firstField(fields, "code", "pickup_code", "pickup", "pickupcode");
    if (!code.trim()) throw new CardVaultError("缺少 code（取件码）");
    const meta = await codeVaultStatus(env, code.trim());
    return c.json(
      { flag: !!meta, exists: !!meta, meta: meta ?? null },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

// ---------------------------------------------------------------------------
// 上传：POST <prefix>/put/cert
// ---------------------------------------------------------------------------

async function putCert(c: Context<HonoBindings>, forceCode: boolean) {
  const env = c.env as Env;
  try {
    const { fields, files } = await parseIncoming(c);
    const deny = await requireAnonymousOrAdmin(c, fields);
    if (deny) return deny;

    // 传输密钥：兼容旧版字段名 pubkey
    const rawPub = firstField(fields, "pubkey", "pub", "transfer_key");
    const code = firstField(fields, "code", "pickup_code", "pickup", "pickupcode");
    const mode = firstField(fields, "mode", "type").toLowerCase();
    const useCode =
      forceCode ||
      mode === "code" ||
      mode === "pickup" ||
      (!rawPub.trim() && !!code.trim());

    // PFX 密码（允许空口令的 PFX）
    const pfxKey = firstField(fields, "pfxkey", "password", "passphrase");
    const label = firstField(fields, "label", "remark");

    if (useCode) {
      const pfx = await extractPfx(files, fields);
      const res = await sealCodeVault({
        env,
        pfx,
        pfxKey,
        label,
        code: code.trim() || undefined,
        ttlSeconds: optionalNumber(fields, "ttl", "ttl_seconds", "expires_in", "expires"),
        maxUses: optionalNumber(fields, "max_uses", "maxuses", "uses", "count"),
      });
      return c.json(
        {
          flag: true,
          data: {
            mode: "code",
            /** 取件码（仅本次响应返回，请转交给用户） */
            code: res.code,
            codeNormalized: res.codeNormalized,
            /** 有效期（ISO，null = 永不过期） */
            expiresAt: res.expiresAt ?? null,
            maxUses: res.maxUses,
            remaining: res.remaining,
            iterations: res.iterations,
          },
          text: "取件码已生成，请妥善交给用户（本平台不再保存明文口令）",
          meta: res,
        },
        200,
        NO_STORE,
      );
    }

    if (!rawPub) {
      throw new CardVaultError(
        "缺少传输密钥（pubkey）；如使用取件码模式请传 mode=code",
      );
    }
    // 提前校验，避免无效公钥把 PFX 已读入内存后才报错
    parseClientPubkey(rawPub);

    const pfx = await extractPfx(files, fields);
    const res = await sealVault({
      env,
      clientPubB64: rawPub,
      pfx,
      pfxKey,
      label,
    });

    return c.json(
      { flag: true, data: "OK", meta: res },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

async function handlePutCert(c: Context<HonoBindings>) {
  return putCert(c, false);
}

/** 显式取件码入口：POST <prefix>/put/code */
async function handlePutCodeCert(c: Context<HonoBindings>) {
  return putCert(c, true);
}

// ---------------------------------------------------------------------------
// 状态查询：<prefix>/status
// ---------------------------------------------------------------------------

async function handleStatus(c: Context<HonoBindings>) {
  const env = c.env as Env;
  try {
    const { fields } = await parseIncoming(c);
    const deny = await requireAnonymousOrAdmin(c, fields);
    if (deny) return deny;
    // 传了 code 即按取件码查询（两种模式共用同一入口，便于前端只记一个地址）
    const code = firstField(fields, "code", "pickup_code", "pickup", "pickupcode");
    if (code.trim()) {
      const meta = await codeVaultStatus(env, code.trim());
      return c.json(
        { flag: !!meta, meta: meta ?? null, exists: !!meta, mode: "code" },
        200,
        NO_STORE,
      );
    }
    const pubkey = firstField(fields, "pubkey", "pub");
    if (!pubkey) throw new CardVaultError("缺少传输密钥（pubkey）或取件码（code）");
    const meta = await vaultStatus(env, pubkey);
    return c.json(
      { flag: !!meta, meta: meta ?? null, exists: !!meta, mode: "key" },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

// ---------------------------------------------------------------------------
// 管理接口与鉴权（见 lib/card-admin.ts）
// ---------------------------------------------------------------------------

/** 来源 IP（用于登录失败限流） */
function clientIp(c: Context<HonoBindings>): string {
  const raw =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-real-ip") ||
    (c.req.header("x-forwarded-for") || "").split(",")[0] ||
    "";
  return raw.trim() || "unknown";
}

/** 提取管理员凭证：Authorization / x-admin-token / query token / 表单字段 */
function credentialOf(
  c: Context<HonoBindings>,
  fields?: Record<string, string>,
): string {
  const auth = c.req.header("authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const got =
    (auth ? bearer : "") ||
    c.req.header("x-admin-token") ||
    c.req.query("token") ||
    fields?.admin_token ||
    fields?.token ||
    "";
  return got.trim();
}

/**
 * 校验管理员凭证。
 *
 * @returns 通过返回 `null`；否则返回应直接回给客户端的错误响应。
 */
async function requireAdmin(
  c: Context<HonoBindings>,
  fields?: Record<string, string>,
): Promise<Response | null> {
  const env = c.env as Env;
  if (!adminPolicy(env).adminEnabled) {
    return c.json(
      {
        flag: false,
        reason: "admin_disabled",
        text: "管理接口未启用：请用 wrangler secret put CARD_ADMIN_PASSWORD（或 CARD_ADMIN_TOKEN）配置凭据",
      },
      403,
      NO_STORE,
    );
  }
  const auth = await verifyAdminCredential(env, credentialOf(c, fields));
  if (auth.ok) return null;
  const needLogin = auth.reason === "missing" || auth.reason === "expired";
  return c.json(
    {
      flag: false,
      reason: auth.reason,
      text: auth.reason === "expired" ? "登录已过期，请重新登录" : "需要管理员登录",
    },
    needLogin ? 401 : 403,
    NO_STORE,
  );
}

/** 未开启匿名下发时，上传 / 生成取件码 / 状态查询 / 管理都必须登录 */
async function requireAnonymousOrAdmin(
  c: Context<HonoBindings>,
  fields?: Record<string, string>,
): Promise<Response | null> {
  if (adminPolicy(c.env as Env).allowAnonymous) return null;
  return requireAdmin(c, fields);
}

// ---------------------------------------------------------------------------
// 管理员登录 / 会话状态
// ---------------------------------------------------------------------------

async function handleAdminLogin(c: Context<HonoBindings>) {
  const env = c.env as Env;
  try {
    const { fields } = await parseIncoming(c);
    const password = firstField(fields, "password", "passwd", "admin_password", "pwd");
    const policy = adminPolicy(env);
    if (!policy.passwordLogin) {
      return c.json(
        {
          flag: false,
          reason: "password_disabled",
          text: "未启用口令登录：请先提供 CARD_ADMIN_PASSWORD；如已配置 CARD_ADMIN_TOKEN，可直接把它作为凭证使用",
        },
        400,
        NO_STORE,
      );
    }
    const ip = clientIp(c);
    const throttle = await loginThrottle(env, ip);
    if (throttle.blocked) {
      return c.json(
        {
          flag: false,
          reason: "too_many_attempts",
          text: "登录失败次数过多，请稍后再试",
        },
        429,
        NO_STORE,
      );
    }
    if (!password.trim()) throw new CardVaultError("缺少 password（管理员口令）");

    const session = await createAdminSession(env, password);
    if (!session) {
      const failures = await recordLoginFailure(env, ip);
      return c.json(
        {
          flag: false,
          reason: "bad_credentials",
          failures,
          max: throttle.max,
          text: `管理员口令不正确（剩余 ${Math.max(throttle.max - failures, 0)} 次机会）`,
        },
        403,
        NO_STORE,
      );
    }
    await clearLoginFailures(env, ip);
    return c.json(
      {
        flag: true,
        data: {
          token: session.token,
          via: "session",
          expiresAt: session.expiresAt,
          seconds: session.seconds,
        },
        text: "登录成功",
      },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

/** 查询登录状态 + 站点策略（匿名开关 / 是否启用口令登录），页面据此渲染 */
async function handleAdminSession(c: Context<HonoBindings>) {
  const env = c.env as Env;
  try {
    const policy = adminPolicy(env);
    const auth = await verifyAdminCredential(env, credentialOf(c));
    return c.json(
      {
        flag: true,
        data: {
          authenticated: auth.ok,
          via: auth.via ?? null,
          expiresAt: auth.expiresAt ?? null,
          reason: auth.ok ? undefined : auth.reason,
          policy: {
            adminEnabled: policy.adminEnabled,
            passwordLogin: policy.passwordLogin,
            tokenLogin: policy.tokenLogin,
            allowAnonymous: policy.allowAnonymous,
            sessionSeconds: policy.sessionSeconds,
          },
        },
      },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

async function handleAdminList(c: Context<HonoBindings>) {
  const deny = await requireAdmin(c);
  if (deny) return deny;
  try {
    const items = await listVaults(c.env as Env);
    return c.json({ flag: true, data: { items } }, 200, NO_STORE);
  } catch (e) {
    return cardError(c, e, 500);
  }
}

async function handleAdminDelete(c: Context<HonoBindings>) {
  try {
    const { fields } = await parseIncoming(c);
    const deny = await requireAdmin(c, fields);
    if (deny) return deny;
    const fingerprint = firstField(fields, "fingerprint", "id", "fp");
    const pubkey = firstField(fields, "pubkey", "pub");
    const code = firstField(fields, "code", "pickup_code", "pickup");
    let ok = false;
    if (fingerprint) ok = await deleteVaultByFingerprint(c.env as Env, fingerprint);
    else if (code) ok = await deleteCodeVault(c.env as Env, code);
    else if (pubkey) ok = await deleteVaultByPubkey(c.env as Env, pubkey);
    else throw new CardVaultError("缺少 fingerprint / code / pubkey");
    return c.json(
      {
        flag: ok,
        data: { deleted: ok },
        text: ok ? "已删除" : "记录不存在（可能已过期）",
      },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

// ---------------------------------------------------------------------------
// 上传页面
// ---------------------------------------------------------------------------

function handlePage(c: Context<HonoBindings>) {
  const env = c.env as Env;
  const pubkey = c.req.query("pubkey") || "";
  const modeParam = (c.req.query("mode") || "").toLowerCase();
  const mode = modeParam === "key" || modeParam === "code" ? modeParam : undefined;
  const policy = adminPolicy(env);
  const html = renderCardUploadPage({
    pubkey,
    mode,
    adminEnabled: policy.adminEnabled,
    passwordLogin: policy.passwordLogin,
    tokenLogin: policy.tokenLogin,
    allowAnonymous: policy.allowAnonymous,
    defaultTtlSeconds: resolveCodeTtlSeconds(env, undefined) ?? 0,
    defaultMaxUses: resolveDefaultMaxUses(env, undefined),
  });
  return c.html(html, 200, {
    ...NO_STORE,
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

/**
 * 把智能卡路由注册到应用上。
 *
 * @param app   Hono 应用
 * @param prefix 路径前缀（`/card`；空串表示兼容 SmartCardWEB.py 的旧根路径）
 * @param legacy 兼容模式：只注册 get/put/web 三个旧接口，不暴露 status / admin
 */
export function mountCardRoutes(
  app: Hono<HonoBindings>,
  prefix: string,
  legacy = false,
): void {
  app.get(`${prefix}/get/cert`, handleGetCert);
  app.post(`${prefix}/get/cert`, handleGetCert);
  app.post(`${prefix}/put/cert`, handlePutCert);
  app.get(`${prefix}/put/cert`, (c) =>
    c.json(
      {
        flag: false,
        text: "请使用 POST multipart/form-data 上传（字段：pubkey / pfxkey / vaults；取件码模式：mode=code / pfxkey / vaults）",
      },
      405,
      NO_STORE,
    ),
  );
  // 取件码（自协商）模式显式入口：与 /get/cert、/put/cert 共用处理器
  app.get(`${prefix}/get/code`, handleGetCodeCert);
  app.post(`${prefix}/get/code`, handleGetCodeCert);
  app.post(`${prefix}/put/code`, handlePutCodeCert);
  app.get(`${prefix}/web/cert`, handlePage);
  app.get(`${prefix}/web/upload`, handlePage);
  if (!legacy) {
    app.get(`${prefix}/status`, handleStatus);
    app.post(`${prefix}/status`, handleStatus);
    app.get(`${prefix}/code/status`, handleCodeStatus);
    app.post(`${prefix}/code/status`, handleCodeStatus);
    app.get(`${prefix}/admin/list`, handleAdminList);
    app.post(`${prefix}/admin/list`, handleAdminList);
    app.post(`${prefix}/admin/delete`, handleAdminDelete);
    app.post(`${prefix}/admin/login`, handleAdminLogin);
    app.get(`${prefix}/admin/session`, handleAdminSession);
    app.post(`${prefix}/admin/session`, handleAdminSession);
    for (const p of [prefix, `${prefix}/`]) {
      app.get(p, (c) => c.redirect(`${prefix}/web/cert`));
    }
  }
}
