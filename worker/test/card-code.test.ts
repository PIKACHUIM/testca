/**
 * TPM 智能卡证书分发 · 取件码（自协商）模式测试
 *
 * 覆盖三层：
 *   1) 取件码本身：字母表 / 规范化（易混字符 O→0、I/L→1）/ 分组展示；
 *   2) 密码学互通：Worker 侧 PBKDF2-SHA256 + AES-256-CBC(零 IV/PKCS#7) 的密文，
 *      必须能被 OpenSSL（node:crypto，与 Python `hashlib.pbkdf2_hmac` +
 *      `Module/Cryptography.py` 同一套实现）解出；
 *   3) HTTP 协议：`mode=code` 上传 / `code=` 取回 / 有效期 / 下发次数 /
 *      状态查询（不核销）/ 管理接口。
 */
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import app from "../src/index";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  codeVaultStatus,
  deleteCodeVault,
  distinctCodeChars,
  formatCode,
  generatePickupCode,
  isStrongCustomCode,
  isWellFormedCode,
  normalizeCode,
  openCodePayload,
  redeemCodeVault,
  sealCodeVault,
} from "../src/lib/card-code";
import { CardVaultError, listVaults } from "../src/lib/card-vault";
import { toBase64 } from "../src/lib/bytes";

// ---------------------------------------------------------------------------
// 内存 KV（只实现本功能用到的子集）
// ---------------------------------------------------------------------------
class MemKV {
  readonly map = new Map<string, string>();
  async get(k: string) {
    return this.map.get(k) ?? null;
  }
  async put(k: string, v: string) {
    this.map.set(k, v);
  }
  async delete(k: string) {
    this.map.delete(k);
  }
  async list({ prefix, limit }: { prefix?: string; cursor?: string; limit?: number } = {}) {
    const keys = [...this.map.keys()]
      .filter((k) => !prefix || k.startsWith(prefix))
      .slice(0, limit ?? 1000)
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor: "" };
  }
}

function makeEnv(extra: Record<string, unknown> = {}): any {
  return { CERT_KV: new MemKV(), ...extra };
}

/** 伪造一个 DER 结构的 PFX（首字节 0x30 = SEQUENCE） */
function fakePfx(len = 512, seed = 7): Uint8Array {
  const out = new Uint8Array(len);
  out[0] = 0x30;
  out[1] = 0x82;
  out[2] = ((len - 4) >> 8) & 0xff;
  out[3] = (len - 4) & 0xff;
  for (let i = 4; i < len; i++) out[i] = (i * 31 + seed) & 0xff;
  return out;
}

/**
 * 模拟 **Python 客户端** 的解密路径：
 *   key = hashlib.pbkdf2_hmac("sha256", code, salt, iterations, 32)
 *   plain = Crypto.aes_decrypt(key, ciphertext)   # AES-256-CBC，零 IV，PKCS#7
 */
function pythonClientDecrypt(
  code: string,
  saltB64: string,
  iterations: number,
  vaultsB64: string,
): { pfx: Buffer; pfxkey: string; label?: string } {
  const salt = Buffer.from(saltB64, "base64");
  const key = pbkdf2Sync(normalizeCode(code), salt, iterations, 32, "sha256");
  const decipher = createDecipheriv("aes-256-cbc", key, Buffer.alloc(16));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(vaultsB64, "base64")),
    decipher.final(),
  ]);
  const payload = JSON.parse(plain.toString("utf8"));
  return {
    pfx: Buffer.from(payload.pfx, "base64"),
    pfxkey: payload.pfxkey,
    label: payload.label,
  };
}

// ---------------------------------------------------------------------------
// 1. 取件码本身
// ---------------------------------------------------------------------------
describe("card-code: 取件码生成与规范化", () => {
  it("字母表不含会被规范化映射的易混字符 I / L / O，且无重复", () => {
    expect(CODE_ALPHABET).not.toContain("I");
    expect(CODE_ALPHABET).not.toContain("L");
    expect(CODE_ALPHABET).not.toContain("O");
    expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length);
    expect(CODE_ALPHABET.length).toBe(33);
  });

  it("随机生成 16 位、字符均落在字母表内，且重复率极低", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = generatePickupCode();
      expect(c.length).toBe(CODE_LENGTH);
      expect(isWellFormedCode(c)).toBe(true);
      // 生成的码必须与规范化结果完全一致（否则无法取回）
      expect(normalizeCode(c)).toBe(c);
      seen.add(c);
    }
    expect(seen.size).toBe(200);
  });

  it("规范化：大小写 / 分隔符 / 易混字符", () => {
    expect(normalizeCode("abcd-efgh-jkmn-pqrs")).toBe("ABCDEFGHJKMNPQRS");
    expect(normalizeCode("  abcd efgh_jkmn.pqrs  ")).toBe("ABCDEFGHJKMNPQRS");
    // O→0、I→1、L→1
    expect(normalizeCode("OI LI")).toBe("0111");
    expect(normalizeCode("")).toBe("");
  });

  it("分组展示与合法性判断", () => {
    expect(formatCode("ABCDEFGHJKMNPQRS")).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(isWellFormedCode("ABCDEFGHJKMNPQRS")).toBe(true);
    expect(isWellFormedCode("ABCDEFGHJKMNPQ")).toBe(false); // 15 位
    expect(isWellFormedCode("ABCDEFGHLJKMNPQR")).toBe(false); // 含 L
  });
});

// ---------------------------------------------------------------------------
// 2. 密码学互通
// ---------------------------------------------------------------------------
describe("card-code: 与 Python/OpenSSL 的密码学互通", () => {
  it("seal 结果可被 Python 侧（PBKDF2 + AES-256-CBC/零IV）解出", async () => {
    const env = makeEnv();
    const pfx = fakePfx(300, 3);
    const sealed = await sealCodeVault({
      env,
      pfx,
      pfxKey: "P@ssw0rd",
      label: "张三-笔记本",
      ttlSeconds: 3600,
      maxUses: 2,
    });

    const rec = JSON.parse(env.CERT_KV.map.get(`card:v2:code:${sealed.fingerprint}`)!);
    expect(rec.mode).toBe("code");
    expect(rec.kdf).toBe("pbkdf2-sha256");
    expect(rec.iterations).toBeGreaterThanOrEqual(10000);

    const opened = pythonClientDecrypt(
      sealed.code,
      rec.salt,
      rec.iterations,
      rec.vaults,
    );
    expect(opened.pfx.equals(Buffer.from(pfx))).toBe(true);
    expect(opened.pfxkey).toBe("P@ssw0rd");
    expect(opened.label).toBe("张三-笔记本");
  });

  it("带分隔符 / 小写 / 易混字符的取件码同样能解开（规范化一致）", async () => {
    const env = makeEnv();
    const pfx = fakePfx(128, 5);
    const sealed = await sealCodeVault({ env, pfx, pfxKey: "k" });
    const rec = JSON.parse(env.CERT_KV.map.get(`card:v2:code:${sealed.fingerprint}`)!);

    // 用「全小写 + 空格 + O/I 混淆」的形式解密，应得到同样的密钥
    const messy = sealed.codeNormalized
      .toLowerCase()
      .split("")
      .map((c) => (c === "0" ? "o" : c === "1" ? "i" : c))
      .join(" ");
    const opened = pythonClientDecrypt(messy, rec.salt, rec.iterations, rec.vaults);
    expect(opened.pfx.equals(Buffer.from(pfx))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. KV 存取：有效期 / 下发次数 / 状态
// ---------------------------------------------------------------------------
describe("card-code: 有效期与下发次数", () => {
  let env: any;
  beforeEach(() => {
    env = makeEnv();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("默认下发 1 次：取回成功后记录被删除，再取回报 not_found", async () => {
    const pfx = fakePfx(256, 11);
    const sealed = await sealCodeVault({ env, pfx, pfxKey: "pw" });
    expect(sealed.maxUses).toBe(1);
    expect(sealed.remaining).toBe(1);

    const first = await redeemCodeVault(env, sealed.code);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.data.mode).toBe("code");
      expect(first.data.remaining).toBe(0);
      expect(first.meta.expiresAt).toBeTruthy();
    }

    const second = await redeemCodeVault(env, sealed.code);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("not_found");
    expect(env.CERT_KV.map.size).toBe(0);
  });

  it("设置多次时可重复取回，用尽后返回 exhausted", async () => {
    const sealed = await sealCodeVault({
      env,
      pfx: fakePfx(200, 2),
      pfxKey: "pw",
      maxUses: 3,
      ttlSeconds: 600,
    });
    for (let i = 1; i <= 3; i++) {
      const r = await redeemCodeVault(env, sealed.code);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.remaining).toBe(3 - i);
    }
    // 第 4 次：记录已删除
    const last = await redeemCodeVault(env, sealed.code);
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.reason).toBe("not_found");
  });

  it("剩余次数未用尽时，状态查询不消耗次数", async () => {
    const sealed = await sealCodeVault({
      env,
      pfx: fakePfx(200, 4),
      pfxKey: "pw",
      maxUses: 2,
      ttlSeconds: 600,
    });
    for (let i = 0; i < 3; i++) {
      const meta = await codeVaultStatus(env, sealed.code);
      expect(meta?.remaining).toBe(2);
      expect(meta?.maxUses).toBe(2);
      expect(meta?.used).toBe(0);
    }
    expect(await codeVaultStatus(env, sealed.code)).not.toBeNull();
  });

  it("过期后取回返回 expired 且记录被清理", async () => {
    const sealed = await sealCodeVault({
      env,
      pfx: fakePfx(200, 6),
      pfxKey: "pw",
      ttlSeconds: 60,
    });
    expect(await codeVaultStatus(env, sealed.code)).not.toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 61_000));

    expect(await codeVaultStatus(env, sealed.code)).toBeNull();
    const r = await redeemCodeVault(env, sealed.code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
    expect(env.CERT_KV.map.size).toBe(0);
  });

  it("过期瞬间（记录仍在 KV 中）也能识别为 expired", async () => {
    const sealed = await sealCodeVault({ env, pfx: fakePfx(200, 8), pfxKey: "pw", ttlSeconds: 60 });
    // 伪造：把记录改成已过期但仍在 KV 里（模拟 TTL 未生效 / 最终一致窗口）
    const key = `card:v2:code:${sealed.fingerprint}`;
    const rec = JSON.parse(env.CERT_KV.map.get(key)!);
    rec.expiresAt = new Date(Date.now() - 1000).toISOString();
    env.CERT_KV.map.set(key, JSON.stringify(rec));

    const r = await redeemCodeVault(env, sealed.code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
    expect(env.CERT_KV.map.size).toBe(0);
  });

  it("格式错误的取件码返回 bad_format", async () => {
    const r = await redeemCodeVault(env, "ABC-123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_format");
  });

  it("自定义取件码：合法则复用，非法则报错", async () => {
    const sealed = await sealCodeVault({
      env,
      pfx: fakePfx(128),
      pfxKey: "pw",
      code: "abcd-efgh-jkmn-pqrs",
    });
    expect(sealed.code).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(sealed.codeNormalized).toBe("ABCDEFGHJKMNPQRS");
    expect((await codeVaultStatus(env, "ABCD EFGH JKMN PQRS"))?.mode).toBe("code");
    // 大小写 + 易混字符（O→0、I/L→1）同样可定位
    expect((await codeVaultStatus(env, "abcd-efgh-jkmn-pqrs"))?.mode).toBe("code");
    // 留空 / 空白 = 服务端自动生成
    const auto = await sealCodeVault({ env, pfx: fakePfx(128), pfxKey: "pw", code: "   " });
    expect(auto.codeNormalized).toMatch(/^[0-9A-Z]{16}$/);
    expect(auto.codeNormalized).not.toBe("");

    // 不同字符数统计与强度判定
    expect(distinctCodeChars("ABCDEFGHJKMNPQRS")).toBe(16);
    expect(distinctCodeChars("1111111111111111")).toBe(1);
    expect(isStrongCustomCode("ABCDEFGHJKMNPQRS")).toBe(true);
    expect(isStrongCustomCode("ABABABABABABABAB")).toBe(false);
    expect(isStrongCustomCode("ABCDEFGHJKMNPQ")).toBe(false);

    // 弱口令（字符集合法但几乎零熵）必须被拒绝
    await expect(
      sealCodeVault({ env, pfx: fakePfx(128), pfxKey: "pw", code: "1111111111111111" }),
    ).rejects.toThrow(/太弱/);
    await expect(
      sealCodeVault({ env, pfx: fakePfx(128), pfxKey: "pw", code: "abab-abab-abab-abab" }),
    ).rejects.toThrow(/太弱/);
    // 7 个不同字符同样不达标（边界）
    await expect(
      sealCodeVault({ env, pfx: fakePfx(128), pfxKey: "pw", code: "AAAABBBBCCCCDDD1" }),
    ).rejects.toThrow(/太弱/);

    await expect(
      sealCodeVault({ env, pfx: fakePfx(128), pfxKey: "pw", code: "too-short" }),
    ).rejects.toThrow(CardVaultError);
  });

  it("按取件码删除后无法再取回", async () => {
    const sealed = await sealCodeVault({ env, pfx: fakePfx(128), pfxKey: "pw", maxUses: 5 });
    expect(await deleteCodeVault(env, sealed.code)).toBe(true);
    expect(await deleteCodeVault(env, sealed.code)).toBe(false);
    expect((await redeemCodeVault(env, sealed.code)).ok).toBe(false);
  });

  it("listVaults 同时列出传输密钥与取件码两种记录", async () => {
    const { sealVault, x25519ExportPublic, x25519GenerateKeyPair } = await import(
      "../src/lib/card-vault"
    );
    const pair = await x25519GenerateKeyPair();
    const pubB64 = toBase64(await x25519ExportPublic(pair.publicKey));
    await sealVault({ env, clientPubB64: pubB64, pfx: fakePfx(100), pfxKey: "a" });
    await sealCodeVault({ env, pfx: fakePfx(300, 9), pfxKey: "b", maxUses: 2 });

    const items = await listVaults(env);
    expect(items.length).toBe(2);
    const modes = items.map((i) => i.mode).sort();
    expect(modes).toEqual(["code", "key"]);
    const code = items.find((i) => i.mode === "code")!;
    expect(code.maxUses).toBe(2);
    expect(code.remaining).toBe(2);
  });

  it("CARD_CODE_PEPPER / CARD_MASTER_KEY 参与指纹，改变 pepper 后旧记录取不回", async () => {
    const e1 = makeEnv({ CARD_CODE_PEPPER: "pepper-1" });
    const sealed = await sealCodeVault({ env: e1, pfx: fakePfx(128), pfxKey: "pw" });
    const fp1 = sealed.fingerprint;
    expect(await codeVaultStatus(e1, sealed.code)).not.toBeNull();

    // pepper 变了 → 指纹不同 → 记录不可达（这正是防离线枚举的意义）
    const e2: any = { CERT_KV: e1.CERT_KV, CARD_CODE_PEPPER: "pepper-2" };
    expect(await codeVaultStatus(e2, sealed.code)).toBeNull();
    const sealed2 = await sealCodeVault({
      env: e2,
      pfx: fakePfx(128),
      pfxKey: "pw",
      code: sealed.code,
    });
    expect(sealed2.fingerprint).not.toBe(fp1);
  });

  it("CARD_CODE_ITERATIONS 生效且被钳制在安全区间", async () => {
    const low = makeEnv({ CARD_CODE_ITERATIONS: "500" });
    const sealedLow = await sealCodeVault({ env: low, pfx: fakePfx(64), pfxKey: "pw" });
    expect(sealedLow.iterations).toBe(10_000);

    const high = makeEnv({ CARD_CODE_ITERATIONS: "99999999" });
    const sealedHigh = await sealCodeVault({ env: high, pfx: fakePfx(64), pfxKey: "pw" });
    expect(sealedHigh.iterations).toBe(1_000_000);
  });

  it("拒绝非 PKCS#12 / 超限文件", async () => {
    const pem = new TextEncoder().encode("-----BEGIN CERTIFICATE-----\nabc\n");
    await expect(sealCodeVault({ env, pfx: pem, pfxKey: "x" })).rejects.toThrow(/PKCS#12/);
    await expect(sealCodeVault({ env, pfx: new Uint8Array(0), pfxKey: "x" })).rejects.toThrow(
      /为空/,
    );
    const small = makeEnv({ CARD_MAX_BYTES: "128" });
    await expect(
      sealCodeVault({ env: small, pfx: fakePfx(512), pfxKey: "x" }),
    ).rejects.toThrow(/过大/);
  });

  it("openCodePayload 与 seal 互为逆运算（服务端自检工具）", async () => {
    const pfx = fakePfx(321, 13);
    const sealed = await sealCodeVault({ env, pfx, pfxKey: "pw", label: "L" });
    const rec = JSON.parse(env.CERT_KV.map.get(`card:v2:code:${sealed.fingerprint}`)!);
    const payload = await openCodePayload(
      sealed.code,
      Uint8Array.from(Buffer.from(rec.salt, "base64")),
      rec.iterations,
      rec.vaults,
    );
    expect(Buffer.from(payload.pfx, "base64").equals(Buffer.from(pfx))).toBe(true);
    expect(payload.pfxkey).toBe("pw");
  });
});

// ---------------------------------------------------------------------------
// 4. HTTP 协议
// ---------------------------------------------------------------------------
describe("card routes: 取件码（自协商）模式协议", () => {
  const ADMIN_TOKEN = "admin-token-test-code";

  function buildEnv() {
    return makeEnv({ CARD_ADMIN_TOKEN: ADMIN_TOKEN });
  }

  async function uploadCode(
    env: any,
    pfx: Uint8Array,
    pfxKey: string,
    label?: string,
    ttl = "3600",
    maxUses = "1",
  ) {
    const fd = new FormData();
    fd.append("mode", "code");
    fd.append("pfxkey", pfxKey);
    fd.append("vaults", new File([pfx as BlobPart], "card.pfx"));
    fd.append("ttl", ttl);
    fd.append("max_uses", maxUses);
    if (label) fd.append("label", label);
    return app.request("/card/put/cert", { method: "POST", body: fd }, env);
  }

  it("POST /card/put/cert（mode=code）返回取件码 / 有效期 / 次数", async () => {
    const env = buildEnv();
    const pfx = fakePfx(640, 5);
    const res = await uploadCode(env, pfx, "pfx-password", "测试卡片", "86400", "2");
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.flag).toBe(true);
    expect(j.data.mode).toBe("code");
    expect(j.data.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(j.data.maxUses).toBe(2);
    expect(j.data.remaining).toBe(2);
    expect(j.data.expiresAt).toBeTruthy();
    expect(j.meta.mode).toBe("code");
    expect(j.meta.size).toBe(pfx.length);
    // 明文口令不得回显
    expect(JSON.stringify(j)).not.toContain("pfx-password");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("POST /card/put/code 与 mode=code 等价", async () => {
    const env = buildEnv();
    const fd = new FormData();
    fd.append("pfxkey", "pw");
    fd.append("vaults", new File([fakePfx(300) as BlobPart], "card.pfx"));
    const res = await app.request("/card/put/code", { method: "POST", body: fd }, env);
    const j: any = await res.json();
    expect(j.flag).toBe(true);
    expect(j.data.code).toBeTruthy();
  });

  it("自定义取件码：上传时指定，随即用该口令取回；弱口令 400", async () => {
    const env = buildEnv();
    const pfx = fakePfx(320, 21);
    const fd = new FormData();
    fd.append("mode", "code");
    fd.append("code", "abcd-efgh-jkmn-pqrs"); // 故意用小写 + 分隔符
    fd.append("pfxkey", "pw-custom");
    fd.append("vaults", new File([pfx as BlobPart], "card.pfx"));
    const up = await app.request("/card/put/cert", { method: "POST", body: fd }, env);
    expect(up.status).toBe(200);
    const uj: any = await up.json();
    expect(uj.data.code).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(uj.data.codeNormalized).toBe("ABCDEFGHJKMNPQRS");

    const got = await app.request("/card/get/code?code=ABCD-EFGH-JKMN-PQRS", {}, env);
    const gj: any = await got.json();
    expect(gj.flag).toBe(true);
    const opened = pythonClientDecrypt(
      "ABCDEFGHJKMNPQRS",
      gj.data.salt,
      gj.data.iterations,
      gj.data.vaults,
    );
    expect(opened.pfx.equals(Buffer.from(pfx))).toBe(true);
    expect(opened.pfxkey).toBe("pw-custom");

    // 弱口令（字符集合法但几乎零熵）被服务端拒绝
    const weakFd = new FormData();
    weakFd.append("mode", "code");
    weakFd.append("code", "1111111111111111");
    weakFd.append("pfxkey", "pw");
    weakFd.append("vaults", new File([fakePfx(200) as BlobPart], "card.pfx"));
    const weak = await app.request("/card/put/cert", { method: "POST", body: weakFd }, env);
    expect(weak.status).toBe(400);
    expect(((await weak.json()) as any).text).toContain("太弱");

    // 格式不合法同样被拒
    const badFd = new FormData();
    badFd.append("mode", "code");
    badFd.append("code", "too-short");
    badFd.append("pfxkey", "pw");
    badFd.append("vaults", new File([fakePfx(200) as BlobPart], "card.pfx"));
    const bad = await app.request("/card/put/cert", { method: "POST", body: badFd }, env);
    expect(bad.status).toBe(400);
  });

  it("GET|POST /card/get/cert?code=… 取回可用 Python 路径解密的内容", async () => {
    const env = buildEnv();
    const pfx = fakePfx(880, 9);
    const up = await uploadCode(env, pfx, "TpM-1234", "取件码卡片", "3600", "1");
    const upJson: any = await up.json();
    const code = upJson.data.code;

    // 模拟 Python 工具：requests.get(url, data={"code": code})
    const res = await app.request(
      "/card/get/cert",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `code=${encodeURIComponent(code.toLowerCase().replace(/-/g, " "))}`,
      },
      env,
    );
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.flag).toBe(true);
    expect(j.data.mode).toBe("code");
    expect(j.data.iterations).toBeGreaterThanOrEqual(10000);
    expect(j.data.remaining).toBe(0);
    expect(j.data.pubkey).toBeUndefined();

    const opened = pythonClientDecrypt(code, j.data.salt, j.data.iterations, j.data.vaults);
    expect(opened.pfx.equals(Buffer.from(pfx))).toBe(true);
    expect(opened.pfxkey).toBe("TpM-1234");

    // 次数用尽 → 再取回 flag:false（HTTP 仍为 200，兼容旧客户端）
    const again = await app.request(`/card/get/code?code=${encodeURIComponent(code)}`, {}, env);
    expect(again.status).toBe(200);
    const j2: any = await again.json();
    expect(j2.flag).toBe(false);
    expect(j2.reason).toBe("not_found");
  });

  it("格式错误的取件码返回 400 + reason:bad_format", async () => {
    const env = buildEnv();
    const res = await app.request("/card/get/cert?code=nope", {}, env);
    expect(res.status).toBe(400);
    const j: any = await res.json();
    expect(j.flag).toBe(false);
    expect(j.reason).toBe("bad_format");
    expect(j.text).toContain("取件码");
  });

  it("未提供 pubkey 与 code 时给出可读错误", async () => {
    const res = await app.request("/card/get/cert", {}, buildEnv());
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).text).toContain("pubkey");
  });

  it("/card/code/status 只返回元信息且不消耗次数", async () => {
    const env = buildEnv();
    const up = await uploadCode(env, fakePfx(300), "pw", "备注B", "3600", "3");
    const code: string = ((await up.json()) as any).data.code;

    const res = await app.request(
      "/card/code/status",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `code=${encodeURIComponent(code)}`,
      },
      env,
    );
    const j: any = await res.json();
    expect(j.flag).toBe(true);
    expect(j.exists).toBe(true);
    expect(j.meta.mode).toBe("code");
    expect(j.meta.remaining).toBe(3);
    expect(j.meta.label).toBe("备注B");
    expect(j.meta.vaults).toBeUndefined();
    expect(j.meta.salt).toBeUndefined();
  });

  it("/card/status 传 code 时按取件码查询", async () => {
    const env = buildEnv();
    const up = await uploadCode(env, fakePfx(200), "pw");
    const code: string = ((await up.json()) as any).data.code;
    const res = await app.request(`/card/status?code=${encodeURIComponent(code)}`, {}, env);
    const j: any = await res.json();
    expect(j.mode).toBe("code");
    expect(j.exists).toBe(true);
  });

  it("管理接口：列表包含两种模式，可按取件码删除", async () => {
    const env = buildEnv();
    const up = await uploadCode(env, fakePfx(300), "pw", "待删除");
    const code: string = ((await up.json()) as any).data.code;

    let res = await app.request(`/card/admin/list?token=${encodeURIComponent(ADMIN_TOKEN)}`, {}, env);
    const list: any = await res.json();
    expect(list.data.items.length).toBe(1);
    expect(list.data.items[0].mode).toBe("code");

    res = await app.request(
      "/card/admin/delete",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-admin-token": ADMIN_TOKEN,
        },
        body: `code=${encodeURIComponent(code)}`,
      },
      env,
    );
    const del: any = await res.json();
    expect(del.flag).toBe(true);
    expect(await codeVaultStatus(env, code)).toBeNull();
  });

  it("上传页面：包含模式切换与取件码结果容器，内联脚本语法正确", async () => {
    const env = buildEnv();
    const res = await app.request("/card/web/cert", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("取件码（自协商）");
    expect(html).toContain('name="mode"');
    expect(html).toContain("code-out");
    expect(html).toContain("/put/cert");
    // 自定义 / 一键随机取件码的输入与预览
    expect(html).toContain('id="pickup_code"');
    expect(html).toContain('id="gen_code"');
    expect(html).toContain('id="code_preview"');

    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(m).toBeTruthy();
    expect(() => new Function(m![1])).not.toThrow();
    // 取件码模式的默认有效期与次数由 env 决定
    const custom = await (
      await app.request("/card/web/cert?mode=code", {}, makeEnv({ CARD_CODE_TTL_SECONDS: "3600", CARD_CODE_USES: "4" }))
    ).text();
    expect(custom).toContain('value="3600" selected');
    expect(custom).toContain('value="4"');
  });
});
