/**
 * TPM 智能卡证书分发（Card Vault）测试
 *
 * 覆盖三层：
 *   1) 密码学互通：Worker 侧的 X25519 + AES-256-CBC(零 IV/PKCS#7) 必须能被
 *      OpenSSL（node:crypto，与 Python cryptography 同一套实现）解出，反向亦然；
 *   2) KV 存取：sealVault / openVault / status / delete / list；
 *   3) HTTP 协议：与 SmartCardWEB.py 逐字段兼容（multipart 上传、GET 带 body
 *      的 `requests.get(url, data={...})` 取回、旧路径别名、管理接口鉴权）。
 *
 * 说明：GET + body 在 Node 侧构造 Request 会被规范拒绝，因此这里用 POST 覆盖
 * 该解析分支；线上 GET+body 已用真实 workerd 探针验证可正常保留请求体。
 */
import { createCipheriv, createDecipheriv } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../src/index";
import {
  CardVaultError,
  aesCbcDecrypt,
  deleteVaultByFingerprint,
  listVaults,
  openVault,
  parseClientPubkey,
  sealVault,
  vaultStatus,
  x25519DeriveShared,
  x25519ExportPublic,
  x25519GenerateKeyPair,
  x25519ImportPublic,
} from "../src/lib/card-vault";
import { fromBase64, sha256Hex, toBase64 } from "../src/lib/bytes";
import { renderCardUploadPage } from "../src/lib/card-page";

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

/** 模拟 TPMSmartCard 客户端：生成临时 X25519 密钥并给出传输密钥 */
async function clientKeypair() {
  const pair = await x25519GenerateKeyPair();
  const pubB64 = toBase64(await x25519ExportPublic(pair.publicKey));
  return { pair, pubB64 };
}

/** 模拟客户端侧解密：用自己的私钥 + 服务端公钥协商，再 AES-CBC 解密 */
async function clientDecrypt(
  privateKey: CryptoKey,
  serverPubB64: string,
  vaultsB64: string,
): Promise<Uint8Array> {
  const serverPub = await x25519ImportPublic(fromBase64(serverPubB64));
  const shared = await x25519DeriveShared(privateKey, serverPub);
  return aesCbcDecrypt(shared, fromBase64(vaultsB64));
}

// ---------------------------------------------------------------------------
// 1. 密码学互通
// ---------------------------------------------------------------------------
describe("card-vault: 与 Python/OpenSSL 的密码学互通", () => {
  it("Worker 加密结果可被 OpenSSL(AES-256-CBC/零IV/PKCS#7) 解出", async () => {
    const env = makeEnv();
    const { pair, pubB64 } = await clientKeypair();
    const pfx = fakePfx(300);

    const sealed = await sealVault({ env, clientPubB64: pubB64, pfx, pfxKey: "p@ss" });
    const rec = JSON.parse(env.CERT_KV.map.get(`card:v1:${sealed.fingerprint}`)!);

    // 客户端侧协商共享密钥
    const serverPub = await x25519ImportPublic(fromBase64(rec.pubkey));
    const shared = await x25519DeriveShared(pair.privateKey, serverPub);

    // OpenSSL 侧解密（Python cryptography 亦为 OpenSSL 实现）
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(shared), Buffer.alloc(16));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(fromBase64(rec.vaults))),
      decipher.final(),
    ]);
    expect(Buffer.from(pfx).equals(plain)).toBe(true);
  });

  it("OpenSSL 加密结果可被 Worker 的 aesCbcDecrypt 解出（反向互通）", async () => {
    const shared = new Uint8Array(32).fill(0x2a);
    const data = fakePfx(257, 3);

    const cipher = createCipheriv("aes-256-cbc", Buffer.from(shared), Buffer.alloc(16));
    const ct = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);

    const out = await aesCbcDecrypt(shared, new Uint8Array(ct));
    expect(Buffer.from(out).equals(Buffer.from(data))).toBe(true);
  });

  it("X25519 协商结果两端一致且为 32 字节", async () => {
    const a = await x25519GenerateKeyPair();
    const b = await x25519GenerateKeyPair();
    const s1 = await x25519DeriveShared(a.privateKey, b.publicKey);
    const s2 = await x25519DeriveShared(b.privateKey, a.publicKey);
    expect(s1.length).toBe(32);
    expect(Buffer.from(s1).equals(Buffer.from(s2))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. KV 存取
// ---------------------------------------------------------------------------
describe("card-vault: KV 存取", () => {
  let env: any;
  beforeEach(() => {
    env = makeEnv();
  });

  it("上传后可完整取回并解密", async () => {
    const { pair, pubB64 } = await clientKeypair();
    const pfx = fakePfx(1024, 11);

    const sealed = await sealVault({
      env,
      clientPubB64: pubB64,
      pfx,
      pfxKey: "TpM#2026",
      label: "张三-笔记本",
    });
    expect(sealed.size).toBe(pfx.length);
    expect(sealed.sha256).toBe(await sha256Hex(pfx));
    expect(sealed.fingerprint).toBe(await sha256Hex(parseClientPubkey(pubB64)));

    const got = await openVault(env, pubB64);
    expect(got).not.toBeNull();
    expect(got!.pfxkey).toBe("TpM#2026");
    expect(got!.meta.label).toBe("张三-笔记本");
    expect((await clientDecrypt(pair.privateKey, got!.pubkey, got!.vaults)).length).toBe(
      pfx.length,
    );
    expect(
      Buffer.from(await clientDecrypt(pair.privateKey, got!.pubkey, got!.vaults)).equals(
        Buffer.from(pfx),
      ),
    ).toBe(true);
  });

  it("未命中的传输密钥返回 null / flag:false 语义", async () => {
    const { pubB64 } = await clientKeypair();
    expect(await openVault(env, pubB64)).toBeNull();
    expect(await vaultStatus(env, pubB64)).toBeNull();
  });

  it("相同传输密钥重复上传为覆盖，列表仍只有一条", async () => {
    const { pubB64 } = await clientKeypair();
    await sealVault({ env, clientPubB64: pubB64, pfx: fakePfx(200), pfxKey: "a" });
    await sealVault({ env, clientPubB64: pubB64, pfx: fakePfx(400), pfxKey: "b" });
    const items = await listVaults(env);
    expect(items.length).toBe(1);
    expect(items[0].size).toBe(400);
    expect((await openVault(env, pubB64))!.pfxkey).toBe("b");
  });

  it("status / delete 行为正确", async () => {
    const { pubB64 } = await clientKeypair();
    const sealed = await sealVault({ env, clientPubB64: pubB64, pfx: fakePfx(300), pfxKey: "x" });
    expect((await vaultStatus(env, pubB64))!.fingerprint).toBe(sealed.fingerprint);

    expect(await deleteVaultByFingerprint(env, sealed.fingerprint)).toBe(true);
    expect(await deleteVaultByFingerprint(env, sealed.fingerprint)).toBe(false);
    expect(await vaultStatus(env, pubB64)).toBeNull();
    await expect(deleteVaultByFingerprint(env, "not-a-fingerprint")).rejects.toThrow(
      CardVaultError,
    );
  });

  it("CARD_MASTER_KEY 会把 pfxkey 静态加密，且仍能还原", async () => {
    const e = makeEnv({ CARD_MASTER_KEY: "unit-test-master-key" });
    const { pubB64 } = await clientKeypair();
    const sealed = await sealVault({ env: e, clientPubB64: pubB64, pfx: fakePfx(300), pfxKey: "secret-pw" });
    const rec = JSON.parse(e.CERT_KV.map.get(`card:v1:${sealed.fingerprint}`)!);
    expect(rec.pfxkeyWrapped).toBe(true);
    expect(rec.pfxkey.startsWith("gcm:")).toBe(true);
    expect(rec.pfxkey).not.toContain("secret-pw");
    expect((await openVault(e, pubB64))!.pfxkey).toBe("secret-pw");

    // 缺少 CARD_MASTER_KEY 时必须明确报错，而不是返回错误口令
    await expect(openVault(makeEnv({ CARD_KV: e.CERT_KV }), pubB64)).rejects.toThrow(
      /CARD_MASTER_KEY/,
    );
  });

  it("CARD_KV 优先于 CERT_KV", async () => {
    const cardKv = new MemKV();
    const certKv = new MemKV();
    const e: any = { CERT_KV: certKv, CARD_KV: cardKv };
    const { pubB64 } = await clientKeypair();
    await sealVault({ env: e, clientPubB64: pubB64, pfx: fakePfx(64), pfxKey: "" });
    expect(cardKv.map.size).toBe(1);
    expect(certKv.map.size).toBe(0);
  });

  it("拒绝非 PKCS#12 / 超限 / 空文件 / 非法公钥", async () => {
    const { pubB64 } = await clientKeypair();

    const pem = new TextEncoder().encode("-----BEGIN CERTIFICATE-----\nabc\n");
    await expect(
      sealVault({ env, clientPubB64: pubB64, pfx: pem, pfxKey: "x" }),
    ).rejects.toThrow(/PKCS#12/);

    await expect(
      sealVault({ env, clientPubB64: pubB64, pfx: new Uint8Array(0), pfxKey: "x" }),
    ).rejects.toThrow(/为空/);

    const small = makeEnv({ CARD_MAX_BYTES: "128" });
    await expect(
      sealVault({ env: small, clientPubB64: pubB64, pfx: fakePfx(512), pfxKey: "x" }),
    ).rejects.toThrow(/过大/);

    const wrong = toBase64(new Uint8Array(16));
    await expect(
      sealVault({ env, clientPubB64: wrong, pfx: fakePfx(64), pfxKey: "x" }),
    ).rejects.toThrow(/32 字节/);

    await expect(
      sealVault({ env, clientPubB64: "!!!not-base64!!!", pfx: fakePfx(64), pfxKey: "x" }),
    ).rejects.toThrow(CardVaultError);
  });

  it("传输密钥兼容 URL-safe / 缺失填充 / PEM 包裹", async () => {
    const pair = await x25519GenerateKeyPair();
    const raw = await x25519ExportPublic(pair.publicKey);
    const std = toBase64(raw);
    const urlsafe = std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(parseClientPubkey(std).length).toBe(32);
    expect(parseClientPubkey(urlsafe).length).toBe(32);
    expect(parseClientPubkey(`-----BEGIN PUBLIC KEY-----\n${std}\n-----END PUBLIC KEY-----`).length).toBe(32);
    expect(parseClientPubkey(`  ${std.slice(0, 10)}\n${std.slice(10)}  `).length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// 3. HTTP 协议
// ---------------------------------------------------------------------------
describe("card routes: 与 SmartCardWEB.py 的协议兼容", () => {
  // 注意：HTTP 头只能携带 ByteString，令牌必须是 ASCII（真实令牌亦然）
  const ADMIN_TOKEN = "admin-token-test-9f2c";

  function buildEnv() {
    return makeEnv({ CARD_ADMIN_TOKEN: ADMIN_TOKEN });
  }

  async function upload(env: any, pubB64: string, pfx: Uint8Array, pfxKey: string, label?: string) {
    const fd = new FormData();
    fd.append("pubkey", pubB64);
    fd.append("pfxkey", pfxKey);
    fd.append("vaults", new File([pfx as BlobPart], "card.pfx"));
    if (label) fd.append("label", label);
    return app.request("/card/put/cert", { method: "POST", body: fd }, env);
  }

  it("POST /card/put/cert 上传返回 flag:true / data:OK", async () => {
    const env = buildEnv();
    const { pubB64 } = await clientKeypair();
    const pfx = fakePfx(640, 5);

    const res = await upload(env, pubB64, pfx, "pfx-password", "测试卡片");
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.flag).toBe(true);
    expect(j.data).toBe("OK");
    expect(j.meta.size).toBe(pfx.length);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("POST /card/get/cert（urlencoded body，模拟 Python requests.get(data=…)）可解密取回", async () => {
    const env = buildEnv();
    const { pair, pubB64 } = await clientKeypair();
    const pfx = fakePfx(880, 9);
    await upload(env, pubB64, pfx, "TpM-1234");

    const res = await app.request(
      "/card/get/cert",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `pubkey=${encodeURIComponent(pubB64)}`,
      },
      env,
    );
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.flag).toBe(true);
    expect(j.data.pfxkey).toBe("TpM-1234");
    const plain = await clientDecrypt(pair.privateKey, j.data.pubkey, j.data.vaults);
    expect(Buffer.from(plain).equals(Buffer.from(pfx))).toBe(true);
  });

  it("GET /card/get/cert?pubkey=… 与旧路径 /get/cert 均可取回", async () => {
    const env = buildEnv();
    const { pubB64 } = await clientKeypair();
    await upload(env, pubB64, fakePfx(256), "pw");

    for (const url of [
      `/card/get/cert?pubkey=${encodeURIComponent(pubB64)}`,
      `/get/cert?pubkey=${encodeURIComponent(pubB64)}`,
    ]) {
      const res = await app.request(url, {}, env);
      expect(res.status).toBe(200);
      const j: any = await res.json();
      expect(j.flag).toBe(true);
      expect(typeof j.data.vaults).toBe("string");
      expect(typeof j.data.pubkey).toBe("string");
    }
  });

  it("未命中的传输密钥返回 200 + flag:false（与原 Flask 行为一致）", async () => {
    const env = buildEnv();
    const { pubB64 } = await clientKeypair();
    const res = await app.request(
      `/card/get/cert?pubkey=${encodeURIComponent(pubB64)}`,
      {},
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as any).toEqual({ flag: false, data: null });
  });

  it("缺少 pubkey 时给出可读错误", async () => {
    const env = buildEnv();
    const res = await app.request("/card/get/cert", {}, env);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).text).toContain("pubkey");
  });

  it("POST /card/status 只返回元信息", async () => {
    const env = buildEnv();
    const { pubB64 } = await clientKeypair();
    const body = `pubkey=${encodeURIComponent(pubB64)}`;

    let res = await app.request(
      "/card/status",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
      env,
    );
    expect(((await res.json()) as any).exists).toBe(false);

    await upload(env, pubB64, fakePfx(300), "pw", "备注A");
    res = await app.request(
      "/card/status",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
      env,
    );
    const j: any = await res.json();
    expect(j.exists).toBe(true);
    expect(j.meta.label).toBe("备注A");
    expect(j.meta.vaults).toBeUndefined();
    expect(j.meta.pfxkey).toBeUndefined();
  });

  it("/card/web/cert 返回上传页面（含 CSP，且支持 ?pubkey= 预填）", async () => {
    const env = buildEnv();
    for (const url of ["/card/web/cert?pubkey=QUJD", "/web/cert"]) {
      const res = await app.request(url, {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(res.headers.get("content-security-policy")).toBeTruthy();
      const html = await res.text();
      expect(html).toContain("智能卡证书分发");
      expect(html).toContain("/put/cert");
    }
    // ?pubkey= 预填到 textarea
    const pre = await app.request("/card/web/cert?pubkey=QUJD", {}, env);
    expect(await pre.text()).toContain(">QUJD<");

    // 管理面板仅当配置了 CARD_ADMIN_TOKEN 时渲染
    const withAdmin = await (await app.request("/card/web/cert", {}, env)).text();
    expect(withAdmin).toContain("缓存管理");
    const withoutAdmin = await (
      await app.request("/card/web/cert", {}, makeEnv())
    ).text();
    expect(withoutAdmin).not.toContain("缓存管理");
  });

  it("/card 跳转到上传页面", async () => {
    const res = await app.request("/card", {}, buildEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/card/web/cert");
  });

  it("上传页面内联脚本语法正确（模板字符串转义回归）", async () => {
    for (const adminEnabled of [false, true]) {
      const html = renderCardUploadPage({
        pubkey: "QUJD+/=</textarea>",
        adminEnabled,
      });
      // 传输密钥必须被 HTML 转义，避免注入
      expect(html).not.toContain("</textarea><");
      const m = html.match(/<script>([\s\S]*?)<\/script>/);
      expect(m).toBeTruthy();
      expect(() => new Function(m![1])).not.toThrow();
      // API 前缀按挂载路径推导：/card/web/cert → /card，/web/cert → 空
      expect(m![1]).toContain("location.pathname.replace");
      expect(html).toContain(adminEnabled ? "缓存管理" : "api-base");
    }
  });

  it("管理接口：未配置令牌 / 令牌错误 / 正确令牌", async () => {
    const env = buildEnv();
    const { pubB64 } = await clientKeypair();
    await upload(env, pubB64, fakePfx(300), "pw", "待删除");

    // 未配置令牌
    const noTokenEnv = makeEnv();
    let res = await app.request("/card/admin/list", {}, noTokenEnv);
    expect(res.status).toBe(403);

    // 令牌错误
    res = await app.request("/card/admin/list?token=wrong", {}, env);
    expect(res.status).toBe(403);

    // 正确令牌
    res = await app.request(`/card/admin/list?token=${encodeURIComponent(ADMIN_TOKEN)}`, {}, env);
    expect(res.status).toBe(200);
    const list: any = await res.json();
    expect(list.flag).toBe(true);
    expect(list.data.items.length).toBe(1);
    const fp = list.data.items[0].fingerprint;

    // 删除（header 传令牌）
    res = await app.request(
      "/card/admin/delete",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-admin-token": ADMIN_TOKEN,
        },
        body: `fingerprint=${fp}`,
      },
      env,
    );
    const del: any = await res.json();
    expect(del.flag).toBe(true);
    expect(await vaultStatus(env, pubB64)).toBeNull();
  });
});
