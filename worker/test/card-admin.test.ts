/**
 * TPM 智能卡证书分发 · 管理员登录与匿名开关测试
 *
 * 覆盖：
 *   1) 口令登录 → 会话令牌 → 管理接口（列表 / 删除两种模式）
 *   2) 会话令牌校验：错误口令、篡改签名、过期、无凭证
 *   3) 静态令牌（CARD_ADMIN_TOKEN）兼容路径
 *   4) `CARD_ALLOW_ANONYMOUS=false`：上传 / 查询 / 管理必须登录，取回不受影响
 *   5) 登录失败次数过多 → 429
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import app from "../src/index";
import {
  adminPolicy,
  createAdminSession,
  verifyAdminCredential,
} from "../src/lib/card-admin";
import { sealCodeVault } from "../src/lib/card-code";
import { sealVault, x25519ExportPublic, x25519GenerateKeyPair } from "../src/lib/card-vault";
import { toBase64 } from "../src/lib/bytes";

const PASSWORD = "admin-pass-测试-2026";
const TOKEN = "static-token-admin-9f2c";

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
  async list({ prefix, limit }: { prefix?: string; limit?: number } = {}) {
    return {
      keys: [...this.map.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .slice(0, limit ?? 1000)
        .map((name) => ({ name })),
      list_complete: true,
      cursor: "",
    };
  }
}

function makeEnv(extra: Record<string, unknown> = {}): any {
  return { CERT_KV: new MemKV(), ...extra };
}

function fakePfx(len = 256, seed = 3): Uint8Array {
  const out = new Uint8Array(len);
  out[0] = 0x30;
  out[1] = 0x82;
  out[2] = ((len - 4) >> 8) & 0xff;
  out[3] = (len - 4) & 0xff;
  for (let i = 4; i < len; i++) out[i] = (i * 17 + seed) & 0xff;
  return out;
}

async function login(env: any, password: string, ip = "1.2.3.4") {
  return app.request(
    "/card/admin/login",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip },
      body: new URLSearchParams({ password }).toString(),
    },
    env,
  );
}

async function sessionInfo(env: any, credential?: string) {
  const res = await app.request(
    "/card/admin/session",
    { headers: credential ? { "x-admin-token": credential } : {} },
    env,
  );
  return { res, body: (await res.json()) as any };
}

async function uploadPubkey(env: any, pfxKey = "pw", credential?: string) {
  const pair = await x25519GenerateKeyPair();
  const pubB64 = toBase64(await x25519ExportPublic(pair.publicKey));
  const fd = new FormData();
  fd.append("pubkey", pubB64);
  fd.append("pfxkey", pfxKey);
  fd.append("vaults", new File([fakePfx(300) as BlobPart], "card.pfx"));
  return app.request(
    "/card/put/cert",
    {
      method: "POST",
      headers: credential ? { "x-admin-token": credential } : {},
      body: fd,
    },
    env,
  );
}

// ---------------------------------------------------------------------------
// 1. 口令登录与会话令牌
// ---------------------------------------------------------------------------
describe("card-admin: 口令登录与会话令牌", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("策略：未配置凭据时管理接口禁用、默认允许匿名", () => {
    const policy = adminPolicy(makeEnv());
    expect(policy.adminEnabled).toBe(false);
    expect(policy.passwordLogin).toBe(false);
    expect(policy.tokenLogin).toBe(false);
    expect(policy.allowAnonymous).toBe(true);
    expect(policy.sessionSeconds).toBe(43200);
  });

  it("策略：匿名开关与令牌开关可独立配置", () => {
    expect(
      adminPolicy(makeEnv({ CARD_ALLOW_ANONYMOUS: "false" })).allowAnonymous,
    ).toBe(false);
    expect(adminPolicy(makeEnv({ CARD_ALLOW_ANONYMOUS: "0" })).allowAnonymous).toBe(false);
    expect(adminPolicy(makeEnv({ CARD_ALLOW_ANONYMOUS: "off" })).allowAnonymous).toBe(false);
    expect(adminPolicy(makeEnv({ CARD_ALLOW_ANONYMOUS: "true" })).allowAnonymous).toBe(true);
    const p = adminPolicy(
      makeEnv({ CARD_ADMIN_TOKEN: TOKEN, CARD_ADMIN_SESSION_SECONDS: "99999999" }),
    );
    expect(p.tokenLogin).toBe(true);
    expect(p.passwordLogin).toBe(false);
    // 会话时长被钳制在上限 7 天
    expect(p.sessionSeconds).toBe(7 * 24 * 3600);
  });

  it("正确口令 → 返回会话令牌；错误口令 → 403", async () => {
    const env = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD });
    const ok = await login(env, PASSWORD);
    expect(ok.status).toBe(200);
    const j: any = await ok.json();
    expect(j.flag).toBe(true);
    expect(j.data.token).toMatch(/^cardadm\.v1\./);
    expect(j.data.expiresAt).toBeTruthy();
    expect(ok.headers.get("cache-control")).toContain("no-store");
    // 响应里不能出现明文口令
    expect(JSON.stringify(j)).not.toContain(PASSWORD);

    const bad = await login(makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD }), "wrong-pass");
    expect(bad.status).toBe(403);
    const bj: any = await bad.json();
    expect(bj.flag).toBe(false);
    expect(bj.reason).toBe("bad_credentials");
  });

  it("未配置 CARD_ADMIN_PASSWORD 时口令登录不可用（400 + 提示）", async () => {
    const env = makeEnv({ CARD_ADMIN_TOKEN: TOKEN });
    const res = await login(env, "whatever");
    expect(res.status).toBe(400);
    const j: any = await res.json();
    expect(j.reason).toBe("password_disabled");
    expect(j.text).toContain("CARD_ADMIN_TOKEN");
  });

  it("会话令牌可访问管理接口；篡改签名 / 过期 / 伪造前缀均被拒", async () => {
    const env = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD });
    const j: any = await (await login(env, PASSWORD)).json();
    const token = j.data.token as string;

    // 会话查询：已登录
    const info = await sessionInfo(env, token);
    expect(info.body.data.authenticated).toBe(true);
    expect(info.body.data.via).toBe("session");
    expect(info.body.data.policy.allowAnonymous).toBe(true);

    // 列表 / 删除
    const list = await app.request("/card/admin/list", { headers: { "x-admin-token": token } }, env);
    expect(list.status).toBe(200);

    // 篡改 payload（签名不匹配）
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}XX.${parts[3]}`;
    const t = await sessionInfo(env, tampered);
    expect(t.body.data.authenticated).toBe(false);
    expect(t.body.data.reason).toBe("bad_signature");
    // 伪造前缀 / 结构不合法
    const malformed = await sessionInfo(env, "cardadm.v1.nosig");
    expect(malformed.body.data.reason).toBe("malformed");
    const forged = await sessionInfo(env, "cardadm.v2.a.b");
    expect(forged.body.data.reason).toBe("invalid");

    // 换一个口令签发的令牌无效（签名密钥随口令变化）
    const otherEnv = makeEnv({ CARD_ADMIN_PASSWORD: "another-password" });
    const other: any = await (await login(otherEnv, "another-password")).json();
    const cross = await sessionInfo(env, other.data.token);
    expect(cross.body.data.authenticated).toBe(false);

    // 过期
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 43201 * 1000));
    const expired = await sessionInfo(env, token);
    expect(expired.body.data.authenticated).toBe(false);
    expect(expired.body.data.reason).toBe("expired");
    const expiredRes = await app.request(
      "/card/admin/list",
      { headers: { "x-admin-token": token } },
      env,
    );
    expect(expiredRes.status).toBe(401);
  });

  it("无凭证 401；管理员未启用 403", async () => {
    const env = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD });
    const none = await app.request("/card/admin/list", {}, env);
    expect(none.status).toBe(401);
    expect(((await none.json()) as any).reason).toBe("missing");

    const noneConfigured = await app.request("/card/admin/list", {}, makeEnv());
    expect(noneConfigured.status).toBe(403);
    expect(((await noneConfigured.json()) as any).reason).toBe("admin_disabled");
  });

  it("静态令牌（CARD_ADMIN_TOKEN）仍可直接使用", async () => {
    const env = makeEnv({ CARD_ADMIN_TOKEN: TOKEN });
    const viaHeader = await app.request(
      "/card/admin/list",
      { headers: { "x-admin-token": TOKEN } },
      env,
    );
    expect(viaHeader.status).toBe(200);

    const viaQuery = await app.request(
      `/card/admin/list?token=${encodeURIComponent(TOKEN)}`,
      {},
      env,
    );
    expect(viaQuery.status).toBe(200);

    const viaBearer = await app.request(
      "/card/admin/list",
      { headers: { authorization: `Bearer ${TOKEN}` } },
      env,
    );
    expect(viaBearer.status).toBe(200);

    const info = await sessionInfo(makeEnv({ CARD_ADMIN_TOKEN: TOKEN }), TOKEN);
    expect(info.body.data.authenticated).toBe(true);
    expect(info.body.data.via).toBe("token");

    const wrong = await app.request(
      "/card/admin/list",
      { headers: { "x-admin-token": "nope" } },
      env,
    );
    expect(wrong.status).toBe(403);
  });

  it("登录失败次数过多 → 429（并在成功后被清除）", async () => {
    const env = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD, CARD_LOGIN_MAX_FAILURES: "3" });
    for (let i = 1; i <= 3; i++) {
      const res = await login(env, "wrong", "9.9.9.9");
      expect(res.status).toBe(403);
      expect(((await res.json()) as any).failures).toBe(i);
    }
    const blocked = await login(env, PASSWORD, "9.9.9.9");
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as any).reason).toBe("too_many_attempts");

    // 其他 IP 不受影响
    const otherIp = await login(env, PASSWORD, "8.8.8.8");
    expect(otherIp.status).toBe(200);

    // 成功登录会清空该 IP 的失败计数
    const again = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD, CARD_LOGIN_MAX_FAILURES: "3" });
    await login(again, "wrong", "9.9.9.9");
    await login(again, "wrong", "9.9.9.9");
    expect((await login(again, PASSWORD, "9.9.9.9")).status).toBe(200);
    expect((await login(again, "wrong", "9.9.9.9")).status).toBe(403);
  });

  it("会话令牌可被安全解析（createAdminSession / verifyAdminCredential 直连）", async () => {
    const env = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD, CARD_ADMIN_SESSION_SECONDS: "600" });
    const session = await createAdminSession(env, PASSWORD);
    expect(session).not.toBeNull();
    const verified = await verifyAdminCredential(env, session!.token);
    expect(verified.ok).toBe(true);
    expect(verified.via).toBe("session");
    expect(verified.expiresAt).toBe(session!.expiresAt);
    // 口令不符不发令牌
    expect(await createAdminSession(env, "nope")).toBeNull();
    // 未配置口令不发令牌
    expect(await createAdminSession(makeEnv(), PASSWORD)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. 匿名开关
// ---------------------------------------------------------------------------
describe("card-admin: CARD_ALLOW_ANONYMOUS=false", () => {
  async function setup() {
    const env = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD, CARD_ALLOW_ANONYMOUS: "false" });
    const j: any = await (await login(env, PASSWORD)).json();
    return { env, token: j.data.token as string };
  }

  it("未登录：上传 / 状态查询 / 管理全部 401", async () => {
    const env = makeEnv({ CARD_ADMIN_PASSWORD: PASSWORD, CARD_ALLOW_ANONYMOUS: "false" });

    const up = await uploadPubkey(env);
    expect(up.status).toBe(401);
    expect(((await up.json()) as any).reason).toBe("missing");

    const code = await app.request(
      "/card/put/code",
      { method: "POST", body: new FormData() },
      env,
    );
    expect(code.status).toBe(401);

    const status = await app.request("/card/status?pubkey=AAAA", {}, env);
    expect(status.status).toBe(401);

    const codeStatus = await app.request("/card/code/status?code=AAAA", {}, env);
    expect(codeStatus.status).toBe(401);

    const list = await app.request("/card/admin/list", {}, env);
    expect(list.status).toBe(401);
  });

  it("登录后：上传 / 生成取件码 / 状态查询 / 列表 / 删除均可用（含传参凭证）", async () => {
    const { env, token } = await setup();

    const up = await uploadPubkey(env, "pw", token);
    expect(up.status).toBe(200);
    expect(((await up.json()) as any).meta.mode).toBe("key");

    // 取件码模式：凭证放在 multipart 字段里同样有效
    const fd = new FormData();
    fd.append("mode", "code");
    fd.append("pfxkey", "pw");
    fd.append("vaults", new File([fakePfx(200, 5) as BlobPart], "card.pfx"));
    fd.append("admin_token", token);
    const codeUp = await app.request("/card/put/code", { method: "POST", body: fd }, env);
    expect(codeUp.status).toBe(200);
    const codeJson: any = await codeUp.json();
    expect(codeJson.data.code).toBeTruthy();
    const code = codeJson.data.code as string;

    const status = await app.request(
      "/card/status",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-admin-token": token },
        body: `code=${encodeURIComponent(code)}`,
      },
      env,
    );
    expect(status.status).toBe(200);
    expect(((await status.json()) as any).mode).toBe("code");

    const list = await app.request(
      "/card/admin/list",
      { headers: { "x-admin-token": token } },
      env,
    );
    const items: any = await list.json();
    expect(items.data.items.length).toBe(2);
    const modes = items.data.items.map((i: any) => i.mode).sort();
    expect(modes).toEqual(["code", "key"]);

    // 删除（按取件码）
    const del = await app.request(
      "/card/admin/delete",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-admin-token": token },
        body: `code=${encodeURIComponent(code)}`,
      },
      env,
    );
    expect(((await del.json()) as any).flag).toBe(true);
  });

  it("取回不受匿名开关限制（凭证即授权），但错误凭证取不到", async () => {
    const env = makeEnv({
      CARD_ADMIN_PASSWORD: PASSWORD,
      CARD_ALLOW_ANONYMOUS: "false",
      CARD_CODE_ITERATIONS: "10000",
    });
    // 由管理员（登录后）生成的记录
    const sealed = await sealCodeVault({
      env,
      pfx: fakePfx(200, 7),
      pfxKey: "pw",
      ttlSeconds: 600,
      maxUses: 2,
    });

    // 目标机器凭取件码取回：无需登录
    const got = await app.request(
      "/card/get/cert",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `code=${encodeURIComponent(sealed.code)}`,
      },
      env,
    );
    expect(got.status).toBe(200);
    const gj: any = await got.json();
    expect(gj.flag).toBe(true);
    expect(gj.data.remaining).toBe(1);

    // 错误的取件码 → 格式/未命中，而非 401
    const wrong = await app.request("/card/get/cert?code=ABCD-EFGH-JKMN-PQRS", {}, env);
    expect(wrong.status).toBe(200);
    expect(((await wrong.json()) as any).flag).toBe(false);

    // 传输密钥模式同样无需登录即可取回
    const pair = await x25519GenerateKeyPair();
    const pubB64 = toBase64(await x25519ExportPublic(pair.publicKey));
    await sealVault({ env, clientPubB64: pubB64, pfx: fakePfx(200), pfxKey: "pw" });
    const getKey = await app.request(`/card/get/cert?pubkey=${encodeURIComponent(pubB64)}`, {}, env);
    expect(((await getKey.json()) as any).flag).toBe(true);
  });

  it("上传页面：服务端先隐藏表单并给出登录提示；脚本可解析", async () => {
    const env = makeEnv({
      CARD_ADMIN_PASSWORD: PASSWORD,
      CARD_ALLOW_ANONYMOUS: "false",
    });
    const html = await (await app.request("/card/web/cert", {}, env)).text();
    expect(html).toContain("本站已关闭匿名下发");
    expect(html).toMatch(/id="upload-form" class="card" autocomplete="off" hidden/);
    expect(html).toContain('id="admin-login-box"');
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(m).toBeTruthy();
    expect(() => new Function(m![1])).not.toThrow();
    expect(m![1]).toContain('var ALLOW_ANON = false');
    expect(m![1]).toContain('var ADMIN_ON = true');
  });

  it("默认（未配置该变量）时匿名上传正常，且页面不隐藏表单", async () => {
    const env = makeEnv();
    const up = await uploadPubkey(env);
    expect(up.status).toBe(200);
    const html = await (await app.request("/card/web/cert", {}, env)).text();
    expect(html).not.toContain("本站已关闭匿名下发");
    expect(html).toMatch(/id="upload-form" class="card" autocomplete="off">/);
  });
});
