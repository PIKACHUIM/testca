/**
 * TPM 虚拟智能卡证书分发（Card Vault）
 * ============================================================================
 * 将 TPMSmartCard 项目中 SmartCardWEB.py 的能力迁移到 Worker：
 *   - 传输层：X25519 密钥协商 + AES-256-CBC（IV 全 0、PKCS#7 填充）
 *   - 存储层：Cloudflare KV（原实现为本地 pickle 文件 Caches/PullCerts.pkl）
 *
 * 协议（与 SmartCardWEB.py / SubApp/CertImport.py 逐字节兼容）
 * ---------------------------------------------------------------------------
 * 1) 客户端（TPM 虚拟智能卡管理工具 → “从云端下发”）先本地生成一对临时
 *    X25519 密钥，把 32 字节原始公钥 base64 后作为“传输密钥”展示给用户。
 *    该公钥同时充当本次分发的唯一索引（能力凭证，equivalent to 一次性令牌）。
 *
 * 2) 上传（浏览器页面 / 任意 HTTP 客户端）：
 *      POST <prefix>/put/cert   multipart/form-data
 *        pubkey = base64(客户端 X25519 原始公钥，32 字节)
 *        pfxkey = PFX 密码（明文，客户端导入卡片时使用）
 *        vaults = PFX / P12 文件二进制
 *        label  = 可选备注
 *    Worker 自己生成一对 X25519 密钥，与客户端公钥协商出 32 字节共享密钥，
 *    用 AES-256-CBC 加密 PFX 明文，连同自己的公钥一起写入 KV。
 *
 * 3) 下发：
 *      GET <prefix>/get/cert   （pubkey 可放在 body / query / header）
 *    返回 {"flag":true,"data":{"vaults":b64,"pubkey":b64,"pfxkey":"..."}}
 *    客户端用自己私钥与返回的 server 公钥协商出同一共享密钥，解密得到
 *    明文 PFX 与密码，再交给 CryptImportKey / tpmvscmgr 装进 TPM 智能卡。
 *
 * 安全模型
 * ---------------------------------------------------------------------------
 * - Worker **不留存共享密钥**：KV 中的 vaults 恒为密文，即使 KV 被读取，
 *   没有客户端临时私钥也无法解出 PFX。
 * - pfxkey 需要回传给客户端，默认明文落盘；配置 Secret `CARD_MASTER_KEY`
 *   后改为 AES-256-GCM 包裹后再落盘（防 KV 快照泄露口令）。
 * - KV key 只保存客户端公钥的 SHA-256 指纹，不落盘明文公钥。
 * - 记录默认 7 天过期（`CARD_TTL_SECONDS` 可调，0 = 不过期）。
 */
import type { Env } from "../env";
import { asBufferSource, fromBase64, sha256Hex, toBase64 } from "./bytes";

/** KV key 前缀（复用 CERT_KV 时避免与证书/CRL 记录冲突） */
const CARD_PREFIX = "card:v1:";
/** AES-CBC 固定零 IV（与原 Python 实现一致，勿改） */
const ZERO_IV = new Uint8Array(16);
/** PFX 默认保留 7 天 */
const DEFAULT_TTL_SECONDS = 7 * 24 * 3600;
/** PFX 默认上限 8 MiB（base64 后约 10.7 MiB，仍在 KV 25 MiB 单值上限内） */
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
/** 备注最大长度 */
const MAX_LABEL_LEN = 64;

/** 业务校验失败（路由层转 400 并回显 message） */
export class CardVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardVaultError";
  }
}

/** KV 中的分发记录 */
export interface CardVaultRecord {
  v: 1;
  /** base64(AES-256-CBC(shared, PFX)) */
  vaults: string;
  /** base64(服务端 X25519 原始公钥) */
  pubkey: string;
  /** PFX 密码（未配置 CARD_MASTER_KEY 时为明文） */
  pfxkey: string;
  /** pfxkey 是否被 CARD_MASTER_KEY 包裹（"gcm:iv:ct"） */
  pfxkeyWrapped: boolean;
  createdAt: string;
  /** 原始 PFX 字节数 */
  size: number;
  /** 原始 PFX SHA-256（十六进制，便于审计比对） */
  sha256: string;
  label?: string;
}

/** 对外暴露的元信息（不含任何密文 / 口令） */
export interface CardVaultMeta {
  fingerprint: string;
  createdAt: string;
  size: number;
  sha256: string;
  label?: string;
}

/** 下发内容（与 SmartCardWEB.py 的 data 字段一致） */
export interface CardVaultPayload {
  vaults: string;
  pubkey: string;
  pfxkey: string;
  meta: CardVaultMeta;
}

// ---------------------------------------------------------------------------
// KV 绑定解析
// ---------------------------------------------------------------------------

/**
 * 解析 KV 绑定：优先专用 `CARD_KV`，未配置时回退到证书用的 `CERT_KV`。
 * 两者都没有时抛错（调用方转 500 并给出配置提示）。
 */
export function resolveCardKv(env: Env): KVNamespace {
  const kv = (env.CARD_KV ?? env.CERT_KV) as KVNamespace | undefined;
  if (!kv || typeof kv.put !== "function") {
    throw new Error(
      "KV 未绑定：请在 wrangler.toml 配置 [[kv_namespaces]]（CARD_KV 或 CERT_KV）",
    );
  }
  return kv;
}

function cardKvKey(fingerprint: string): string {
  return CARD_PREFIX + fingerprint;
}

function resolveTtlSeconds(env: Env): number | null {
  const raw = env.CARD_TTL_SECONDS;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return DEFAULT_TTL_SECONDS;
  }
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null; // 0 / 负数 = 永久保留
  return n < 60 ? 60 : n; // KV 要求 expirationTtl >= 60
}

function resolveMaxBytes(env: Env): number {
  const raw = env.CARD_MAX_BYTES;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return DEFAULT_MAX_BYTES;
  }
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
}

// ---------------------------------------------------------------------------
// X25519（RFC 7748）—— 与 Python cryptography 的 X25519PrivateKey.exchange 等价
// ---------------------------------------------------------------------------

export async function x25519GenerateKeyPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: "X25519" } as AlgorithmIdentifier,
    true,
    ["deriveBits"],
  );
  return pair as CryptoKeyPair;
}

/** 导入 32 字节原始 X25519 公钥 */
export async function x25519ImportPublic(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== 32) {
    throw new CardVaultError(
      `X25519 公钥必须为 32 字节，当前 ${raw.length} 字节（请检查传输密钥是否完整）`,
    );
  }
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(raw),
    { name: "X25519" } as AlgorithmIdentifier,
    true,
    [],
  );
}

/** 导出 X25519 原始公钥（32 字节） */
export async function x25519ExportPublic(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

/** X25519 密钥协商，返回 32 字节共享密钥 */
export async function x25519DeriveShared(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits(
    { name: "X25519", public: publicKey } as AlgorithmIdentifier,
    privateKey,
    256,
  );
  return new Uint8Array(bits);
}

// ---------------------------------------------------------------------------
// AES-256-CBC（零 IV + PKCS#7）—— 与 Module/Cryptography.py 的 Crypto 等价
// ---------------------------------------------------------------------------

async function importAesCbcKey(key: Uint8Array): Promise<CryptoKey> {
  if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
    throw new CardVaultError(`AES 密钥长度非法：${key.length} 字节`);
  }
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(key),
    { name: "AES-CBC" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** AES-CBC 加密（WebCrypto 自动做 PKCS#7 填充，与原实现的 padding.PKCS7(128) 一致） */
export async function aesCbcEncrypt(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const k = await importAesCbcKey(key);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: ZERO_IV },
    k,
    asBufferSource(data),
  );
  return new Uint8Array(ct);
}

/** AES-CBC 解密（自动去除 PKCS#7 填充） */
export async function aesCbcDecrypt(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const k = await importAesCbcKey(key);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: ZERO_IV },
    k,
    asBufferSource(data),
  );
  return new Uint8Array(pt);
}

// ---------------------------------------------------------------------------
// pfxkey 静态加密（可选，防 KV 快照泄露口令）
// ---------------------------------------------------------------------------

/** 由 CARD_MASTER_KEY 派生 32 字节 AES 密钥（任意长度口令经 SHA-256 归一） */
async function deriveMasterKey(env: Env): Promise<Uint8Array | null> {
  const raw = env.CARD_MASTER_KEY?.trim();
  if (!raw) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    asBufferSource(new TextEncoder().encode(raw)),
  );
  return new Uint8Array(digest);
}

async function wrapPfxKey(
  env: Env,
  plain: string,
): Promise<{ value: string; wrapped: boolean }> {
  const mk = await deriveMasterKey(env);
  if (!mk) return { value: plain, wrapped: false };
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await crypto.subtle.importKey(
    "raw",
    asBufferSource(mk),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    asBufferSource(new TextEncoder().encode(plain)),
  );
  return { value: `gcm:${toBase64(iv)}:${toBase64(ct)}`, wrapped: true };
}

async function unwrapPfxKey(
  env: Env,
  stored: string,
  wrapped: boolean,
): Promise<string> {
  if (!wrapped) return stored;
  const mk = await deriveMasterKey(env);
  if (!mk) {
    throw new CardVaultError(
      "该记录的口令由 CARD_MASTER_KEY 加密，但当前 Worker 未配置该 Secret，无法解开",
    );
  }
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "gcm") {
    throw new CardVaultError("口令密文格式异常，无法解开");
  }
  try {
    const iv = fromBase64(parts[1]);
    const ct = fromBase64(parts[2]);
    const key = await crypto.subtle.importKey(
      "raw",
      asBufferSource(mk),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(iv) },
      key,
      asBufferSource(ct),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new CardVaultError(
      "口令解密失败：当前 CARD_MASTER_KEY 与写入时不一致",
    );
  }
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

/**
 * 宽松解析 base64：容忍空白、URL-safe 字符（- _）、缺失填充，
 * 以及整段 PEM 文本（取其 base64 主体）。
 */
export function decodeBase64Loose(input: string): Uint8Array {
  let t = (input || "").trim();
  if (!t) throw new CardVaultError("传输密钥为空");
  if (t.includes("-----BEGIN")) {
    t = t.replace(/-----BEGIN[^-]*-----/g, "").replace(/-----END[^-]*-----/g, "");
  }
  t = t.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  t = t.replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(t) || t.length === 0) {
    throw new CardVaultError("传输密钥不是合法的 Base64 文本");
  }
  const pad = (4 - (t.length % 4)) % 4;
  try {
    return fromBase64(t + "=".repeat(pad));
  } catch {
    throw new CardVaultError("传输密钥 Base64 解码失败");
  }
}

/** 解析客户端传输公钥（32 字节原始 X25519 公钥） */
export function parseClientPubkey(input: string): Uint8Array {
  const raw = decodeBase64Loose(input);
  if (raw.length !== 32) {
    throw new CardVaultError(
      `传输密钥必须解码为 32 字节（当前 ${raw.length} 字节），请从智能卡工具重新复制`,
    );
  }
  return raw;
}

/** 定长比较，避免令牌比较的时序侧信道 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

function metaOf(fingerprint: string, rec: CardVaultRecord): CardVaultMeta {
  return {
    fingerprint,
    createdAt: rec.createdAt,
    size: rec.size,
    sha256: rec.sha256,
    label: rec.label,
  };
}

// ---------------------------------------------------------------------------
// 对外能力
// ---------------------------------------------------------------------------

export interface SealVaultParams {
  env: Env;
  /** 客户端传输公钥（base64 文本） */
  clientPubB64: string;
  /** PFX / P12 明文二进制 */
  pfx: Uint8Array;
  /** PFX 密码（客户端导入卡片时使用） */
  pfxKey: string;
  /** 可选备注 */
  label?: string;
}

export interface SealVaultResult extends CardVaultMeta {
  /** 客户端公钥指纹（KV key 的一部分） */
  serverPubB64: string;
}

/**
 * 加密 PFX 并写入 KV。
 *
 * 相同客户端公钥重复上传视为“覆盖”（同一张待下发卡片重新投递）。
 */
export async function sealVault(p: SealVaultParams): Promise<SealVaultResult> {
  const { env, clientPubB64, pfx, pfxKey } = p;

  const max = resolveMaxBytes(env);
  if (!pfx || pfx.length === 0) {
    throw new CardVaultError("上传的 PFX 文件为空");
  }
  if (pfx.length > max) {
    throw new CardVaultError(
      `PFX 文件过大：${fmtBytes(pfx.length)}，上限 ${fmtBytes(max)}（可通过 CARD_MAX_BYTES 调整）`,
    );
  }
  // PKCS#12 为 DER 编码，首字节必须是 SEQUENCE(0x30)：拦截误传的 .crt/.pem/.p7b
  if (pfx[0] !== 0x30) {
    throw new CardVaultError(
      "上传内容不是有效的 PKCS#12 (PFX/P12)：DER 首字节应为 0x30，请确认文件类型",
    );
  }

  const label = (p.label || "").trim().slice(0, MAX_LABEL_LEN) || undefined;

  // 1) 协商共享密钥
  const clientPubRaw = parseClientPubkey(clientPubB64);
  const clientPub = await x25519ImportPublic(clientPubRaw);
  const serverPair = await x25519GenerateKeyPair();
  const shared = await x25519DeriveShared(serverPair.privateKey, clientPub);
  const serverPubRaw = await x25519ExportPublic(serverPair.publicKey);

  // 2) 加密 PFX 与口令
  const cipher = await aesCbcEncrypt(shared, pfx);
  const secret = await wrapPfxKey(env, pfxKey ?? "");

  const fingerprint = await sha256Hex(clientPubRaw);
  const record: CardVaultRecord = {
    v: 1,
    vaults: toBase64(cipher),
    pubkey: toBase64(serverPubRaw),
    pfxkey: secret.value,
    pfxkeyWrapped: secret.wrapped,
    createdAt: new Date().toISOString(),
    size: pfx.length,
    sha256: await sha256Hex(pfx),
    label,
  };

  // 3) 落盘
  const ttl = resolveTtlSeconds(env);
  await resolveCardKv(env).put(
    cardKvKey(fingerprint),
    JSON.stringify(record),
    ttl ? { expirationTtl: ttl } : {},
  );

  return { ...metaOf(fingerprint, record), serverPubB64: record.pubkey };
}

/** 读取密文记录（内部） */
async function loadRecord(
  env: Env,
  clientPubB64: string,
): Promise<{ fingerprint: string; record: CardVaultRecord } | null> {
  const clientPubRaw = parseClientPubkey(clientPubB64);
  const fingerprint = await sha256Hex(clientPubRaw);
  const raw = await resolveCardKv(env).get(cardKvKey(fingerprint));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as CardVaultRecord;
    if (!record || record.v !== 1 || !record.vaults || !record.pubkey) {
      throw new Error("字段缺失");
    }
    return { fingerprint, record };
  } catch (e) {
    console.error("[card-vault] 记录解析失败", e);
    throw new CardVaultError("KV 中的分发记录已损坏，请重新上传");
  }
}

/**
 * 取回下发内容（解密 pfxkey；vaults 仍为密文，只有客户端能解开）。
 */
export async function openVault(
  env: Env,
  clientPubB64: string,
): Promise<CardVaultPayload | null> {
  const hit = await loadRecord(env, clientPubB64);
  if (!hit) return null;
  const { fingerprint, record } = hit;
  const pfxkey = await unwrapPfxKey(env, record.pfxkey, !!record.pfxkeyWrapped);
  return {
    vaults: record.vaults,
    pubkey: record.pubkey,
    pfxkey,
    meta: metaOf(fingerprint, record),
  };
}

/** 仅查询元信息（不下发密文 / 口令），用于页面“检查缓存” */
export async function vaultStatus(
  env: Env,
  clientPubB64: string,
): Promise<CardVaultMeta | null> {
  const hit = await loadRecord(env, clientPubB64);
  return hit ? metaOf(hit.fingerprint, hit.record) : null;
}

/** 按指纹删除记录，返回是否真的删掉了 */
export async function deleteVaultByFingerprint(
  env: Env,
  fingerprint: string,
): Promise<boolean> {
  const fp = (fingerprint || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(fp)) {
    throw new CardVaultError("指纹格式非法（应为 64 位十六进制 SHA-256）");
  }
  const kv = resolveCardKv(env);
  const key = cardKvKey(fp);
  if ((await kv.get(key)) === null) return false;
  await kv.delete(key);
  return true;
}

/** 按客户端公钥删除记录 */
export async function deleteVaultByPubkey(
  env: Env,
  clientPubB64: string,
): Promise<boolean> {
  const raw = parseClientPubkey(clientPubB64);
  return deleteVaultByFingerprint(env, await sha256Hex(raw));
}

/** 列出缓存的分发记录（仅元信息，按创建时间倒序） */
export async function listVaults(env: Env, limit = 200): Promise<CardVaultMeta[]> {
  const kv = resolveCardKv(env);
  const page = await kv.list({ prefix: CARD_PREFIX, limit });
  const out: CardVaultMeta[] = [];
  for (const k of page.keys) {
    const raw = await kv.get(k.name);
    if (!raw) continue;
    try {
      const record = JSON.parse(raw) as CardVaultRecord;
      out.push(metaOf(k.name.slice(CARD_PREFIX.length), record));
    } catch {
      // 忽略损坏记录
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}
