/**
 * /card/*  —— TPM 虚拟智能卡证书分发路由
 * ============================================================================
 * 对应 TPMSmartCard 项目的 SmartCardWEB.py（Flask），协议保持逐字段兼容，
 * 因此现网的智能卡工具无需改动即可指向本 Worker。同时保留旧版的根路径
 * 别名（/get/cert、/put/cert、/web/cert），以便反向代理把 /card 前缀重写掉
 * 的历史部署继续可用。
 *
 * 路由清单（prefix = /card）：
 *   GET|POST /card/get/cert   —— 下发（客户端取回密文 + PFX 密码）
 *   POST     /card/put/cert   —— 上传（multipart：pubkey / pfxkey / vaults）
 *   GET|POST /card/status     —— 仅查询该传输密钥是否已有缓存
 *   GET      /card/web/cert   —— 浏览器上传页面
 *   GET      /card/admin/list —— 缓存列表（需 CARD_ADMIN_TOKEN）
 *   POST     /card/admin/delete —— 删除某条缓存（需 CARD_ADMIN_TOKEN）
 *   GET      /card            —— 跳转到上传页面
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
  timingSafeEqual,
  vaultStatus,
} from "../lib/card-vault";
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
// 下发：GET|POST <prefix>/get/cert
// ---------------------------------------------------------------------------

async function handleGetCert(c: Context<HonoBindings>) {
  const env = c.env as Env;
  try {
    const { fields } = await parseIncoming(c);
    const pubkey = firstField(fields, "pubkey", "pub", "x-pubkey") ||
      c.req.header("x-pubkey") ||
      "";
    if (!pubkey.trim()) {
      return c.json(
        { flag: false, data: null, text: "缺少 pubkey（传输密钥）" },
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

// ---------------------------------------------------------------------------
// 上传：POST <prefix>/put/cert
// ---------------------------------------------------------------------------

async function handlePutCert(c: Context<HonoBindings>) {
  const env = c.env as Env;
  try {
    const { fields, files } = await parseIncoming(c);

    // 传输密钥：兼容旧版字段名 pubkey
    const rawPub = firstField(fields, "pubkey", "pub", "transfer_key");
    if (!rawPub) throw new CardVaultError("缺少传输密钥（pubkey）");
    // 提前校验，避免无效公钥把 PFX 已读入内存后才报错
    parseClientPubkey(rawPub);

    // PFX 密码（允许空口令的 PFX）
    const pfxKey = firstField(fields, "pfxkey", "password", "passphrase");
    const label = firstField(fields, "label", "remark");

    // PFX 二进制：multipart 文件字段 vaults（兼容 file / pfx / p12 / 首个文件），
    // 或 base64 文本字段 vaults_b64（便于脚本 / curl 调用）
    const file =
      files.vaults ||
      files.file ||
      files.pfx ||
      files.p12 ||
      Object.values(files)[0];
    let pfx: Uint8Array;
    if (file) {
      pfx = new Uint8Array(await file.arrayBuffer());
    } else {
      const b64 = firstField(fields, "vaults_b64", "pfx_b64", "vaults");
      if (!b64) throw new CardVaultError("缺少 PFX 文件（multipart 字段名 vaults）");
      try {
        pfx = fromBase64(b64.trim());
      } catch {
        throw new CardVaultError("vaults/vaults_b64 不是合法的 Base64 内容");
      }
    }

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

// ---------------------------------------------------------------------------
// 状态查询：<prefix>/status
// ---------------------------------------------------------------------------

async function handleStatus(c: Context<HonoBindings>) {
  const env = c.env as Env;
  try {
    const { fields } = await parseIncoming(c);
    const pubkey = firstField(fields, "pubkey", "pub");
    if (!pubkey) throw new CardVaultError("缺少传输密钥（pubkey）");
    const meta = await vaultStatus(env, pubkey);
    return c.json(
      { flag: !!meta, meta: meta ?? null, exists: !!meta },
      200,
      NO_STORE,
    );
  } catch (e) {
    return cardError(c, e);
  }
}

// ---------------------------------------------------------------------------
// 管理接口（需 CARD_ADMIN_TOKEN）
// ---------------------------------------------------------------------------

function checkAdminToken(c: Context<HonoBindings>): string | null {
  const env = c.env as Env;
  const expect = env.CARD_ADMIN_TOKEN?.trim();
  if (!expect) {
    return "管理接口未启用：请用 wrangler secret put CARD_ADMIN_TOKEN 配置令牌";
  }
  const got =
    c.req.header("x-admin-token") ||
    (c.req.header("authorization") || "").replace(/^Bearer\s+/i, "") ||
    c.req.query("token") ||
    "";
  return timingSafeEqual(got, expect) ? null : "管理令牌无效";
}

async function handleAdminList(c: Context<HonoBindings>) {
  const deny = checkAdminToken(c);
  if (deny) return c.json({ flag: false, text: deny }, 403, NO_STORE);
  try {
    const items = await listVaults(c.env as Env);
    return c.json({ flag: true, data: { items } }, 200, NO_STORE);
  } catch (e) {
    return cardError(c, e, 500);
  }
}

async function handleAdminDelete(c: Context<HonoBindings>) {
  const deny = checkAdminToken(c);
  if (deny) return c.json({ flag: false, text: deny }, 403, NO_STORE);
  try {
    const { fields } = await parseIncoming(c);
    const fingerprint = firstField(fields, "fingerprint", "id", "fp");
    const pubkey = firstField(fields, "pubkey", "pub");
    let ok = false;
    if (fingerprint) ok = await deleteVaultByFingerprint(c.env as Env, fingerprint);
    else if (pubkey) ok = await deleteVaultByPubkey(c.env as Env, pubkey);
    else throw new CardVaultError("缺少 fingerprint / pubkey");
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
  const html = renderCardUploadPage({
    pubkey: c.req.query("pubkey") || "",
    adminEnabled: !!(env.CARD_ADMIN_TOKEN && env.CARD_ADMIN_TOKEN.trim()),
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
        text: "请使用 POST multipart/form-data 上传（字段：pubkey / pfxkey / vaults）",
      },
      405,
      NO_STORE,
    ),
  );
  app.get(`${prefix}/web/cert`, handlePage);
  app.get(`${prefix}/web/upload`, handlePage);
  if (!legacy) {
    app.get(`${prefix}/status`, handleStatus);
    app.post(`${prefix}/status`, handleStatus);
    app.get(`${prefix}/admin/list`, handleAdminList);
    app.post(`${prefix}/admin/list`, handleAdminList);
    app.post(`${prefix}/admin/delete`, handleAdminDelete);
    for (const p of [prefix, `${prefix}/`]) {
      app.get(p, (c) => c.redirect(`${prefix}/web/cert`));
    }
  }
}
