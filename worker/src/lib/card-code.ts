/**
 * TPM 虚拟智能卡证书分发（Card Vault）· 取件码 / 自协商模式
 * ============================================================================
 * 与 `card-vault.ts` 的「传输密钥（X25519 预协商）」互为补充：**客户端不需要
 * 事先与本平台交换任何临时公钥**，只要拿到一串「取件码」即可完成取回与解密。
 *
 * 协议
 * ---------------------------------------------------------------------------
 * 1) 上传（浏览器页面 / 任意 HTTP 客户端）：
 *      POST <prefix>/put/cert   multipart/form-data（mode=code）
 *        pfxkey    = PFX 密码（明文，导入卡片时使用）
 *        vaults    = PFX / P12 文件二进制（或 vaults_b64）
 *        label     = 可选备注
 *        ttl       = 可选，有效期秒数（0 = 永不过期；缺省读 CARD_CODE_TTL_SECONDS）
 *        max_uses  = 可选，允许下发次数（缺省读 CARD_CODE_USES 或 1）
 *        code      = 可选，自定义取件码（缺省由服务端随机生成 16 位码；
 *                    自定义时至少需要 8 个不同字符，防「1111…」类弱口令）
 *    服务端：
 *      · 生成随机取件码（默认 16 位、按 4 位分组，去掉了 I/O/1 等易混字符）
 *      · salt = 16 字节随机数；K = PBKDF2-SHA256(取件码, salt, iterations, 32B)
 *      · 载荷 = JSON{ v, pfx(base64), pfxkey, label }，用 AES-256-CBC(零 IV, PKCS#7)
 *        加密后写入 KV，key = `card:v2:code:<SHA-256(pepper|取件码)>`
 *      · 响应中一次性返回取件码本身（服务端只保存其加盐指纹，不留明文口令）
 *
 * 2) 下发（智能卡工具 / 客户端）：
 *      GET|POST <prefix>/get/cert   （字段 code=取件码）
 *    返回 {flag:true, data:{mode:"code", vaults, salt, iterations, kdf, remaining}}
 *    客户端用同一取件码 + salt + iterations 派生 K，AES-CBC 解密载荷，得到
 *    明文 PFX 与其密码，再交给 certutil -importpfx / tpmvscmgr 写入卡片。
 *
 * 3) 有效期与次数：
 *      · 有效期：写入 KV 的 expirationTtl（到期自动删除），并在记录里冗余
 *        `expiresAt` 双保险；过期取件码返回 `flag:false` + `reason:"expired"`。
 *      · 下发次数：每次成功取回 `used+1`；用尽后立即删除记录，之后再取回返回
 *        `reason:"exhausted"`。
 *
 * 安全模型
 * ---------------------------------------------------------------------------
 * - **取件码即密钥**：服务端在写入后不再持有明文取件码，KV 中只有
 *   `SHA-256(pepper|取件码)` 指纹、随机盐与密文；即使 KV 快照泄露，没有取件码
 *   也无法解开 PFX（离线爆破需支付 PBKDF2 迭代成本）。
 * - **pepper**：`CARD_CODE_PEPPER`（未配置时回退 `CARD_MASTER_KEY`）参与指纹
 *   计算，使 KV key 不泄露给"拿到 KV 就能离线枚举短口令"的攻击者；未配置任何
 *   Secret 时使用内置常量，安全强度仍由取件码 80 bit 熵与 PBKDF2 保证。
 * - **防重放**：默认下发 1 次即销毁；可配置更多次，但 KV 为最终一致存储，
 *   并发取回时计数可能"超发"，需要严格一次性的场景请保持 maxUses = 1。
 */
import type { Env } from "../env";
import { asBufferSource, fromBase64, sha256Hex, toBase64 } from "./bytes";
import {
  CARD_CODE_PREFIX,
  CardVaultError,
  MAX_LABEL_LEN,
  aesCbcDecrypt,
  aesCbcEncrypt,
  codeMetaOf,
  resolveCardKv,
  validatePfx,
  type CardCodeRecordShape,
  type CardVaultMeta,
} from "./card-vault";

// ---------------------------------------------------------------------------
// 取件码：字母表 / 长度 / 规范化
// ---------------------------------------------------------------------------

/**
 * 取件码字母表：数字 0-9 + 大写字母，**排除 I / L / O**。
 *
 * 排除这三个字符的原因：它们会被 {@link normalizeCode} 映射为 1 / 1 / 0，
 * 若出现在生成结果里，生成的码与规范化后的码将不一致（无法取回）。
 * 33 个字符 × 16 位 ≈ 80.7 bit 熵。取模采样用拒绝法避免分布偏差。
 */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** 取件码有效长度（规范化后，不含分隔符） */
export const CODE_LENGTH = 16;
/** 显示分组宽度（XXXX-XXXX-XXXX-XXXX） */
export const CODE_GROUP = 4;

const CODE_CHAR_RE = /^[0-9A-Z]+$/;
/** 拒绝法上限：小于该值的随机字节可均匀映射到字母表 */
const CODE_SAMPLE_LIMIT = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;

/**
 * 规范化用户输入的取件码：转大写 → 去掉一切非字母数字字符（分隔符/空格）→
 * 把易混字符映射回字母表（O→0、I→1、L→1）。
 *
 * 与 TPMSmartCard 侧 `Crypto.normalize_code` 必须逐字符保持一致。
 */
export function normalizeCode(input: string): string {
  const s = (input || "").toUpperCase().replace(/[^0-9A-Z]+/g, "");
  return s.replace(/O/g, "0").replace(/[IL]/g, "1");
}

/** 规范化后的取件码是否合法（长度 + 字符集合） */
export function isWellFormedCode(normalized: string): boolean {
  return (
    normalized.length === CODE_LENGTH &&
    CODE_CHAR_RE.test(normalized) &&
    [...normalized].every((ch) => CODE_ALPHABET.includes(ch))
  );
}

/**
 * 自定义取件码的最小强度：至少 8 个不同字符。
 *
 * 自动生成的取件码有约 80 bit 熵；但自定义码由调用方给出，`1111111111111111`
 * 这类「口令」几乎零熵，一旦 KV 快照泄露会被瞬间爆破，因此在服务端强制拦下。
 */
export const CODE_MIN_DISTINCT = 8;

/** 统计取件码中不同字符的数量（强度检查） */
export function distinctCodeChars(normalized: string): number {
  return new Set(normalized).size;
}

/** 自定义取件码的强度是否达标 */
export function isStrongCustomCode(normalized: string): boolean {
  return isWellFormedCode(normalized) && distinctCodeChars(normalized) >= CODE_MIN_DISTINCT;
}

/** 规范化取件码 → 展示形式（XXXX-XXXX-XXXX-XXXX） */
export function formatCode(normalized: string): string {
  const out: string[] = [];
  for (let i = 0; i < normalized.length; i += CODE_GROUP) {
    out.push(normalized.slice(i, i + CODE_GROUP));
  }
  return out.join("-");
}

/** 生成随机取件码（规范化形式，不含分隔符） */
export function generatePickupCode(): string {
  let out = "";
  // 拒绝法：丢弃 >= 33*7 = 231 的字节，保证每个字符等概率
  while (out.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && out.length < CODE_LENGTH; i++) {
      if (bytes[i] < CODE_SAMPLE_LIMIT) {
        out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 参数解析（env）
// ---------------------------------------------------------------------------

/** 取件码默认有效期：24 小时 */
const DEFAULT_CODE_TTL_SECONDS = 24 * 3600;
/** 有效期上限：90 天 */
const MAX_CODE_TTL_SECONDS = 90 * 24 * 3600;
/** PBKDF2 默认迭代次数 */
const DEFAULT_CODE_ITERATIONS = 100_000;
const MIN_CODE_ITERATIONS = 10_000;
const MAX_CODE_ITERATIONS = 1_000_000;
/** 默认下发次数 */
const DEFAULT_CODE_USES = 1;
/** 下发次数上限 */
const MAX_CODE_USES = 100;
/** 未配置任何 Secret 时的指纹 pepper（取件码本身已有 80 bit 熵） */
const FALLBACK_PEPPER = "pika-card-code-v1";

function parseIntOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * 解析有效期（秒）。约定：
 *   · 显式传入 `0` / 负数 → 永不过期
 *   · 未传入 → `CARD_CODE_TTL_SECONDS`（默认 86400），其 0 亦表示永不过期
 *   · 上限 90 天
 */
export function resolveCodeTtlSeconds(env: Env, explicit?: number): number | null {
  let n: number | null;
  if (explicit !== undefined && explicit !== null && Number.isFinite(explicit)) {
    n = Math.trunc(explicit);
  } else {
    n = parseIntOrNull(env.CARD_CODE_TTL_SECONDS);
    if (n === null) n = DEFAULT_CODE_TTL_SECONDS;
  }
  if (n <= 0) return null; // 永不过期
  return Math.min(n, MAX_CODE_TTL_SECONDS);
}

/** 解析 PBKDF2 迭代次数（下限 10000，避免配置过弱） */
export function resolveCodeIterations(env: Env): number {
  const n = parseIntOrNull(env.CARD_CODE_ITERATIONS) ?? DEFAULT_CODE_ITERATIONS;
  return Math.min(Math.max(n, MIN_CODE_ITERATIONS), MAX_CODE_ITERATIONS);
}

/** 解析默认下发次数 */
export function resolveDefaultMaxUses(env: Env, explicit?: number): number {
  let n: number | null = null;
  if (explicit !== undefined && explicit !== null && Number.isFinite(explicit)) {
    n = Math.trunc(explicit);
  } else {
    n = parseIntOrNull(env.CARD_CODE_USES);
    if (n === null) n = DEFAULT_CODE_USES;
  }
  if (n <= 0) return DEFAULT_CODE_USES;
  return Math.min(n, MAX_CODE_USES);
}

/** 指纹 pepper：CARD_CODE_PEPPER → CARD_MASTER_KEY → 内置常量 */
function resolveCodePepper(env: Env): string {
  return (
    env.CARD_CODE_PEPPER?.trim() ||
    env.CARD_MASTER_KEY?.trim() ||
    FALLBACK_PEPPER
  );
}

async function codeFingerprint(env: Env, normalized: string): Promise<string> {
  const input = new TextEncoder().encode(`${resolveCodePepper(env)}|${normalized}`);
  return sha256Hex(input);
}

// ---------------------------------------------------------------------------
// 密钥派生（PBKDF2-SHA256）—— 与 Python hashlib.pbkdf2_hmac("sha256", …) 等价
// ---------------------------------------------------------------------------

export async function deriveCodeKey(
  code: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey(
    "raw",
    asBufferSource(new TextEncoder().encode(code)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: asBufferSource(salt),
      iterations,
      hash: "SHA-256",
    },
    base,
    256,
  );
  return new Uint8Array(bits);
}

/** 加密载荷（AES-256-CBC 的明文）结构 */
export interface CardCodePayload {
  v: 1;
  /** base64(PFX / P12 明文) */
  pfx: string;
  /** PFX 密码 */
  pfxkey: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// 上传（封存）
// ---------------------------------------------------------------------------

export interface SealCodeParams {
  env: Env;
  /** PFX / P12 明文二进制 */
  pfx: Uint8Array;
  /** PFX 密码（客户端导入卡片时使用） */
  pfxKey: string;
  /** 可选备注 */
  label?: string;
  /** 自定义取件码（缺省随机生成；同样支持带分隔符/小写，会自动规范化） */
  code?: string;
  /** 有效期秒数（0 = 永不过期；缺省读 CARD_CODE_TTL_SECONDS） */
  ttlSeconds?: number;
  /** 允许下发次数（缺省读 CARD_CODE_USES 或 1） */
  maxUses?: number;
}

export interface SealCodeResult extends CardVaultMeta {
  /** 取件码（展示形式，仅此一次返回） */
  code: string;
  /** 规范化后的取件码（无分隔符，供程序复制/比对） */
  codeNormalized: string;
  /** 服务端实际使用的 PBKDF2 迭代次数 */
  iterations: number;
}

/** 把 `expiresAt` 换算成 KV 的 expirationTtl（KV 要求 >= 60 秒） */
function ttlFromExpiresAt(expiresAt: string): number | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return null;
  const left = Math.ceil((at - Date.now()) / 1000);
  if (left <= 0) return 0;
  return Math.max(60, left);
}

function recordKvKey(fingerprint: string): string {
  return CARD_CODE_PREFIX + fingerprint;
}

/**
 * 加密 PFX 并写入 KV，返回一次性展示的取件码。
 *
 * 相同取件码重复上传视为“覆盖”（同一口令重新投递）。
 */
export async function sealCodeVault(p: SealCodeParams): Promise<SealCodeResult> {
  const { env, pfx, pfxKey } = p;

  validatePfx(env, pfx);

  const label = (p.label || "").trim().slice(0, MAX_LABEL_LEN) || undefined;

  // 1) 取件码（留空 = 服务端随机生成）
  let normalized: string;
  if (p.code !== undefined && String(p.code).trim() !== "") {
    normalized = normalizeCode(String(p.code));
    if (!isWellFormedCode(normalized)) {
      throw new CardVaultError(
        `自定义取件码格式不正确：规范化后应为 ${CODE_LENGTH} 位（可用 - 分组，字母表为 ${CODE_ALPHABET}）`,
      );
    }
    const distinct = distinctCodeChars(normalized);
    if (distinct < CODE_MIN_DISTINCT) {
      throw new CardVaultError(
        `自定义取件码太弱：至少需要 ${CODE_MIN_DISTINCT} 个不同字符（当前 ${distinct} 个），请改随机生成`,
      );
    }
  } else {
    normalized = generatePickupCode();
  }

  // 2) 参数
  const iterations = resolveCodeIterations(env);
  const ttl = resolveCodeTtlSeconds(env, p.ttlSeconds);
  const maxUses = resolveDefaultMaxUses(env, p.maxUses);
  const createdAt = new Date();
  const expiresAt = ttl ? new Date(createdAt.getTime() + ttl * 1000).toISOString() : "";

  // 3) 派生密钥并加密载荷（PFX + 其口令 + 备注一起加密）
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await deriveCodeKey(normalized, salt, iterations);
  const payload: CardCodePayload = {
    v: 1,
    pfx: toBase64(pfx),
    pfxkey: pfxKey ?? "",
    ...(label ? { label } : {}),
  };
  const cipher = await aesCbcEncrypt(
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  const record: CardCodeRecordShape = {
    v: 2,
    mode: "code",
    vaults: toBase64(cipher),
    salt: toBase64(salt),
    iterations,
    kdf: "pbkdf2-sha256",
    createdAt: createdAt.toISOString(),
    expiresAt,
    maxUses,
    used: 0,
    size: pfx.length,
    sha256: await sha256Hex(pfx),
    label,
  };

  // 4) 落盘（KV TTL 与 expiresAt 双保险）
  const fingerprint = await codeFingerprint(env, normalized);
  await resolveCardKv(env).put(
    recordKvKey(fingerprint),
    JSON.stringify(record),
    ttl ? { expirationTtl: ttl } : {},
  );

  return {
    ...codeMetaOf(fingerprint, record),
    code: formatCode(normalized),
    codeNormalized: normalized,
    iterations,
  };
}

// ---------------------------------------------------------------------------
// 下发（核销）
// ---------------------------------------------------------------------------

export type CodeRedeemFailure = "bad_format" | "not_found" | "expired" | "exhausted";

/** 取回成功时的 data 字段（与 v1 的 vaults/pubkey/pfxkey 并列，客户端按 mode 分派） */
export interface CodeRedeemData {
  mode: "code";
  /** base64(AES-256-CBC(PBKDF2(取件码, salt, iterations), JSON 载荷)) */
  vaults: string;
  /** base64(16 字节盐) */
  salt: string;
  iterations: number;
  kdf: "pbkdf2-sha256";
  /** 本次核销后剩余可用次数 */
  remaining: number;
}

export type CodeRedeemResult =
  | { ok: true; data: CodeRedeemData; meta: CardVaultMeta }
  | { ok: false; reason: CodeRedeemFailure; text: string };

function failure(reason: CodeRedeemFailure, text: string): CodeRedeemResult {
  return { ok: false, reason, text };
}

/** 读取原始记录（内部） */
async function loadRecord(
  env: Env,
  normalized: string,
): Promise<{ fingerprint: string; key: string; record: CardCodeRecordShape } | null> {
  const fingerprint = await codeFingerprint(env, normalized);
  const key = recordKvKey(fingerprint);
  const raw = await resolveCardKv(env).get(key);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as CardCodeRecordShape;
    if (!record || record.v !== 2 || !record.vaults || !record.salt || !record.iterations) {
      throw new Error("字段缺失");
    }
    return { fingerprint, key, record };
  } catch (e) {
    console.error("[card-code] 记录解析失败", e);
    throw new CardVaultError("KV 中的取件码记录已损坏，请重新上传");
  }
}

/**
 * 用取件码换取密文：校验有效期与剩余次数，成功后 `used + 1`，
 * 次数用尽立即删除记录。
 */
export async function redeemCodeVault(env: Env, code: string): Promise<CodeRedeemResult> {
  const normalized = normalizeCode(code);
  if (!isWellFormedCode(normalized)) {
    return failure(
      "bad_format",
      `取件码格式不正确：应为 ${CODE_LENGTH} 位（可用 - 分隔；O/I/L 会分别按 0/1/1 处理）`,
    );
  }

  const hit = await loadRecord(env, normalized);
  if (!hit) {
    return failure("not_found", "取件码不存在、已过期或已被使用完");
  }
  const { fingerprint, key, record } = hit;

  if (record.expiresAt) {
    const at = Date.parse(record.expiresAt);
    if (Number.isFinite(at) && Date.now() >= at) {
      await resolveCardKv(env).delete(key);
      return failure("expired", "取件码已过期，请重新在平台生成");
    }
  }
  if (record.maxUses > 0 && record.used >= record.maxUses) {
    await resolveCardKv(env).delete(key);
    return failure("exhausted", "取件码的下发次数已用尽，请重新在平台生成");
  }

  record.used += 1;
  const remaining = Math.max(0, record.maxUses - record.used);
  const ttl = ttlFromExpiresAt(record.expiresAt);
  const kv = resolveCardKv(env);
  if (remaining <= 0) {
    // 最后一次：取回内容已返回，记录无需保留
    await kv.delete(key);
  } else {
    await kv.put(key, JSON.stringify(record), ttl ? { expirationTtl: ttl } : {});
  }

  return {
    ok: true,
    data: {
      mode: "code",
      vaults: record.vaults,
      salt: record.salt,
      iterations: record.iterations,
      kdf: "pbkdf2-sha256",
      remaining,
    },
    meta: codeMetaOf(fingerprint, record),
  };
}

/**
 * 仅查询取件码状态（不核销、不消耗次数），用于「检查取件码」与工具预检。
 * 过期 / 用尽的记录会顺手清掉并返回 null。
 */
export async function codeVaultStatus(env: Env, code: string): Promise<CardVaultMeta | null> {
  const normalized = normalizeCode(code);
  if (!isWellFormedCode(normalized)) return null;
  const hit = await loadRecord(env, normalized);
  if (!hit) return null;
  const { fingerprint, key, record } = hit;
  if (record.expiresAt) {
    const at = Date.parse(record.expiresAt);
    if (Number.isFinite(at) && Date.now() >= at) {
      await resolveCardKv(env).delete(key);
      return null;
    }
  }
  if (record.maxUses > 0 && record.used >= record.maxUses) {
    await resolveCardKv(env).delete(key);
    return null;
  }
  return codeMetaOf(fingerprint, record);
}

/** 删除某个取件码记录 */
export async function deleteCodeVault(env: Env, code: string): Promise<boolean> {
  const normalized = normalizeCode(code);
  if (!isWellFormedCode(normalized)) {
    throw new CardVaultError(`取件码格式不正确：规范化后应为 ${CODE_LENGTH} 位`);
  }
  const kv = resolveCardKv(env);
  const key = recordKvKey(await codeFingerprint(env, normalized));
  if ((await kv.get(key)) === null) return false;
  await kv.delete(key);
  return true;
}

/** 供测试使用的加密结果反解（客户端侧逻辑的最小复刻） */
export async function openCodePayload(
  code: string,
  salt: Uint8Array,
  iterations: number,
  vaultsB64: string,
): Promise<CardCodePayload> {
  const key = await deriveCodeKey(normalizeCode(code), salt, iterations);
  const plain = await aesCbcDecrypt(key, fromBase64(vaultsB64));
  const payload = JSON.parse(new TextDecoder().decode(plain)) as CardCodePayload;
  if (!payload || payload.v !== 1 || typeof payload.pfx !== "string") {
    throw new CardVaultError("取件码载荷格式异常（可能取件码不正确）");
  }
  return payload;
}
