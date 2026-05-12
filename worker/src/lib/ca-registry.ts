/**
 * CA 注册表：
 *   - 迁移 [issue/CAServer.py](G:/Codes/PikaProjects/PikaTestCert/issue/CAServer.py)
 *     中的 `use['keyUsage']` / `use['extUsage']` / 分发 URL 配置
 *   - 懒加载并缓存各 CA 的公钥（X.509 证书），公钥 DER 由 CERTS_ORIGIN/certs/<name>ca/<name>ca.der 获取
 *   - 从环境变量（Secret）中读取各 CA 私钥（PEM / PKCS#8）
 */
import { X509Certificate } from "@peculiar/x509";

import type { Env } from "../env";

/** 支持的子 CA 名称 */
export const CA_NAMES = [
  "time",
  "uefi",
  "code",
  "auth",
  "file",
  "mail",
  "mtls",
  "sign",
  "ssh2",
  "acme",
  "ssl3",
  "iots",
  "nets",
  "card",
  "fido",
] as const;
export type CaName = (typeof CA_NAMES)[number];

/** 根 CA 与 OCSP 响应者的名称（独立于子 CA，但复用同样的加载逻辑） */
export type SpecialCaName = "root" | "ocsprs";

/** RFC 5280 KeyUsage 位名称，与 @peculiar/x509 的 KeyUsageFlags 对齐 */
export type KeyUsageBit =
  | "digitalSignature"
  | "nonRepudiation"
  | "keyEncipherment"
  | "dataEncipherment"
  | "keyAgreement"
  | "keyCertSign"
  | "cRLSign"
  | "encipherOnly"
  | "decipherOnly";

/**
 * 每个子 CA 的业务配置（扩展用途、策略 OID 等）
 * 迁移自 CAServer.py 的 `use` 字典
 */
export interface CaProfile {
  /** KeyUsage 扩展所需位 */
  keyUsage: KeyUsageBit[];
  /** ExtendedKeyUsage OID 列表 */
  extKeyUsage: string[];
}

/** CRL / AIA / 策略分发模板（与 CAServer.py 的 `url` 字典保持一致） */
export function getDistributionUrls(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    crl: [
      `${base}/crl/??????.crl`,
      `${base}/certs/??????/??????.crl`,
      "https://pikachuim.github.io/testca/certs/??????/??????.crl",
    ],
    /** AIA 条目：accessMethod 按 OID 映射 */
    aia: [
      { method: "ocsp" as const, url: `${base}/ocsp` },
      {
        method: "caIssuers" as const,
        url: `${base}/certs/??????/??????.crt`,
      },
      {
        method: "caIssuers" as const,
        url: "https://pikachuim.github.io/testca/certs/??????/??????.crt",
      },
    ] as Array<{ method: "ocsp" | "caIssuers"; url: string }>,
    /** 证书策略：OID -> CPS URI（null 表示无 CPS） */
    policies: {
      "2.23.140.1.1": null as string | null,
      "2.16.840.1.113730.1": null as string | null,
      "1.3.6.1.4.1.37476.9000.173.0":
        `${base}/#/cps` as string | null,
    },
  };
}

/**
 * 业务配置表（迁移自 CAServer.py）
 */
export const CA_PROFILES: Record<CaName, CaProfile> = {
  time: {
    keyUsage: ["digitalSignature"],
    extKeyUsage: ["1.3.6.1.5.5.7.3.8"],
  },
  uefi: {
    keyUsage: ["digitalSignature"],
    extKeyUsage: [
      "1.3.6.1.5.5.7.3.3",
      "1.3.6.1.4.1.311.10.3.6",
      "1.3.6.1.4.1.311.10.3.8",
      "1.3.6.1.4.1.2312.16.1.1",
      "1.3.6.1.4.1.2312.16.1.2",
      "1.3.6.1.4.1.2312.16.1.3",
    ],
  },
  code: {
    keyUsage: ["digitalSignature"],
    extKeyUsage: [
      "1.3.6.1.4.1.311.61.1.1",
      "1.3.6.1.4.1.311.10.3.5",
      "1.3.6.1.4.1.311.10.3.6",
      "1.3.6.1.4.1.311.10.3.7",
      "1.3.6.1.4.1.311.10.3.8",
      "1.3.6.1.4.1.311.10.3.39",
    ],
  },
  auth: {
    keyUsage: [
      "digitalSignature",
      "nonRepudiation",
      "keyEncipherment",
      "dataEncipherment",
      "keyAgreement",
      "encipherOnly",
      "decipherOnly",
    ],
    extKeyUsage: [
      "1.3.6.1.5.2.3.4",
      "1.3.6.1.5.5.7.3.5",
      "1.3.6.1.5.5.7.3.6",
      "1.3.6.1.5.5.7.3.17",
      "1.3.6.1.5.5.7.3.21",
      "1.3.6.1.5.5.7.3.22",
      "1.3.6.1.5.5.7.3.23",
      "1.3.6.1.5.5.7.3.24",
      "1.3.6.1.5.5.7.3.25",
      "1.3.6.1.5.5.7.3.26",
      "1.3.6.1.5.5.7.3.27",
      "1.3.6.1.5.5.7.3.28",
      "1.3.6.1.5.5.7.3.29",
      "1.3.6.1.5.5.7.3.30",
      "1.3.6.1.5.5.8.2.2",
      "1.3.6.1.4.1.311.21.1",
      "1.3.6.1.4.1.311.21.5",
      "1.3.6.1.4.1.311.21.3",
      "1.3.6.1.4.1.311.21.4",
      "1.3.6.1.4.1.311.21.6",
      "1.3.6.1.4.1.311.21.2",
      "1.3.6.1.4.1.311.21.10",
      "1.3.6.1.4.1.311.10.3.3",
      "1.3.6.1.4.1.311.10.3.1",
      "1.3.6.1.4.1.311.10.3.9",
      "1.3.6.1.4.1.311.10.3.10",
      "1.3.6.1.4.1.311.10.5.1",
      "1.3.6.1.4.1.311.10.6.1",
      "1.3.6.1.4.1.311.10.6.2",
      "1.3.6.1.4.1.311.20.2",
      "1.3.6.1.4.1.311.20.2.1",
      "1.3.6.1.4.1.311.20.2.2",
      "1.3.6.1.4.1.311.20.2.3",
    ],
  },
  file: {
    keyUsage: [
      "keyEncipherment",
      "dataEncipherment",
      "keyAgreement",
      "encipherOnly",
      "decipherOnly",
    ],
    extKeyUsage: [
      "1.3.6.1.4.1.311.10.3.4",
      "1.3.6.1.4.1.311.10.3.4.1",
      "1.3.6.1.4.1.311.10.3.11",
      "1.3.6.1.4.1.311.67.1.1",
      "1.3.6.1.4.1.311.67.1.2",
    ],
  },
  mail: {
    keyUsage: [
      "digitalSignature",
      "keyAgreement",
      "encipherOnly",
      "decipherOnly",
    ],
    extKeyUsage: ["1.3.6.1.5.5.7.3.4", "1.3.6.1.4.1.311.21.19"],
  },
  mtls: {
    keyUsage: ["digitalSignature"],
    extKeyUsage: ["1.3.6.1.5.5.7.3.1", "1.3.6.1.5.5.7.3.2"],
  },
  sign: {
    keyUsage: ["digitalSignature", "nonRepudiation"],
    extKeyUsage: [
      "1.2.840.113583.1.1.5",
      "1.3.6.1.4.1.311.10.3.12",
      "1.3.6.1.4.1.311.10.3.1",
      "1.3.6.1.4.1.311.10.3.2",
      "1.3.6.1.4.1.311.10.3.13",
    ],
  },
  ssh2: {
    keyUsage: ["digitalSignature"],
    extKeyUsage: [
      "1.3.6.1.5.5.7.3.21", // id-kp-secureShellClient
      "1.3.6.1.5.5.7.3.22", // id-kp-secureShellServer
    ],
  },
  acme: {
    keyUsage: ["digitalSignature", "keyEncipherment"],
    extKeyUsage: [
      "1.3.6.1.5.5.7.3.1", // id-kp-serverAuth
      "1.3.6.1.5.5.7.3.2", // id-kp-clientAuth
    ],
  },
  ssl3: {
    keyUsage: ["digitalSignature", "keyEncipherment", "keyAgreement"],
    extKeyUsage: [
      "1.3.6.1.5.5.7.3.1", // id-kp-serverAuth
      "1.3.6.1.5.5.7.3.2", // id-kp-clientAuth
    ],
  },
  iots: {
    keyUsage: ["digitalSignature", "keyEncipherment", "dataEncipherment"],
    extKeyUsage: [
      "1.3.6.1.5.5.7.3.2", // id-kp-clientAuth
      "1.3.6.1.5.5.7.3.1", // id-kp-serverAuth
      "1.3.6.1.5.5.7.3.3", // id-kp-codeSigning (固件签名)
    ],
  },
  nets: {
    keyUsage: ["digitalSignature", "keyEncipherment", "keyAgreement"],
    extKeyUsage: [
      "1.3.6.1.5.5.7.3.1", // id-kp-serverAuth
      "1.3.6.1.5.5.7.3.2", // id-kp-clientAuth
      "1.3.6.1.5.5.8.2.2", // id-kp-ipsecProtection (IPSec)
      "1.3.6.1.5.5.7.3.5", // id-kp-ipsecEndSystem
      "1.3.6.1.5.5.7.3.6", // id-kp-ipsecTunnel
      "1.3.6.1.5.5.7.3.7", // id-kp-ipsecUser
    ],
  },
  card: {
    keyUsage: [
      "digitalSignature",
      "nonRepudiation",
      "keyEncipherment",
      "dataEncipherment",
    ],
    extKeyUsage: [
      "1.3.6.1.4.1.311.20.2.2", // id-kp-smartcardLogon
      "1.3.6.1.5.5.7.3.2",      // id-kp-clientAuth
      "1.3.6.1.5.5.7.3.4",      // id-kp-emailProtection
      "1.3.6.1.4.1.311.10.3.11", // id-kp-keyRecovery
    ],
  },
  fido: {
    keyUsage: ["digitalSignature"],
    extKeyUsage: [
      "1.3.6.1.5.5.7.3.2",        // id-kp-clientAuth
      "1.2.840.113549.1.9.2",      // FIDO U2F
      "1.3.6.1.4.1.45724.1.1.4",   // FIDO2 hmac-secret
    ],
  },
};

/** 判断任意字符串是否为合法 CA 名 */
export function isCaName(v: unknown): v is CaName {
  return typeof v === "string" && (CA_NAMES as readonly string[]).includes(v);
}

/** 把模板中的 `??????` 替换成 `<caName>ca` */
export function fillTemplate(tmpl: string, caName: CaName): string {
  return tmpl.replaceAll("??????", `${caName}ca`);
}

// ===========================================================================
//  公钥 / 私钥加载 ============================================================
// ===========================================================================

/** 证书缓存：同一个 isolate 内只拉取一次 */
const certCache = new Map<string, X509Certificate>();
/** 私钥缓存：importKey 结果 */
const keyCache = new Map<string, CryptoKey>();

/** 获取 CA 静态资源来源 origin */
export function resolveCertsOrigin(env: Env, reqUrl?: string): string {
  if (env.CERTS_ORIGIN) {
    let origin = env.CERTS_ORIGIN.replace(/\/$/, "");
    // 确保有协议前缀
    if (!/^https?:\/\//.test(origin)) {
      origin = `https://${origin}`;
    }
    return origin;
  }
  if (reqUrl) {
    try {
      const u = new URL(reqUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return "";
}

/**
 * 加载某个 CA 的 X.509 证书（DER）。
 *
 * 路径约定：`<origin>/certs/<name>ca/<name>ca.der`；`root` -> `rootca`；`ocsprs` -> `ocsprs`
 */
export async function loadCaCert(
  name: CaName | SpecialCaName,
  origin: string,
): Promise<X509Certificate> {
  const cacheKey = `${origin}::${name}`;
  const cached = certCache.get(cacheKey);
  if (cached) return cached;

  const dir = name === "root" ? "rootca" : name === "ocsprs" ? "ocsprs" : `${name}ca`;
  const file = name === "root" ? "rootca" : name === "ocsprs" ? "ocsprs" : `${name}ca`;
  const url = `${origin}/certs/${dir}/${file}.der`;

  const res = await fetch(url, { cf: { cacheTtl: 3600 } as any });
  if (!res.ok) {
    throw new Error(`Fetch CA cert failed: ${url} -> HTTP ${res.status}`);
  }
  const der = new Uint8Array(await res.arrayBuffer());
  const cert = new X509Certificate(der);
  certCache.set(cacheKey, cert);
  return cert;
}

/** 环境变量 key 映射 */
function privateKeyEnvKey(name: CaName | SpecialCaName): keyof Env {
  if (name === "root") return "ROOT_CA_KEY";
  if (name === "ocsprs") return "OCSP_CA_KEY";
  return `${name.toUpperCase()}_CA_KEY` as keyof Env;
}

/**
 * PEM (PKCS#8) -> WebCrypto CryptoKey (RSA sign)
 */
export async function importRsaPrivateKeyPem(
  pem: string,
  hash: "SHA-256" | "SHA-384" | "SHA-512" = "SHA-256",
): Promise<CryptoKey> {
  const der = pemToDer(pem, "PRIVATE KEY");
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash },
    true,
    ["sign"],
  );
}

/**
 * 从环境变量读取某 CA 私钥，转 WebCrypto CryptoKey。
 * 支持 PKCS#8 与 PKCS#1（传统 RSA PRIVATE KEY）。
 */
export async function loadCaPrivateKey(
  env: Env,
  name: CaName | SpecialCaName,
): Promise<CryptoKey> {
  const cached = keyCache.get(name);
  if (cached) return cached;

  const envKey = privateKeyEnvKey(name);
  const pem = env[envKey] as string | undefined;
  if (!pem) {
    throw new Error(`Missing env secret: ${String(envKey)}`);
  }

  let key: CryptoKey;
  if (/BEGIN RSA PRIVATE KEY/.test(pem)) {
    // PKCS#1 -> 包一层 PKCS#8
    const pkcs8 = rsaPkcs1ToPkcs8(pemToDer(pem, "RSA PRIVATE KEY"));
    key = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"],
    );
  } else {
    key = await importRsaPrivateKeyPem(pem, "SHA-256");
  }
  keyCache.set(name, key);
  return key;
}

// ---------------------------------------------------------------------------
//  工具函数：PEM <-> DER；PKCS#1 -> PKCS#8 封装
// ---------------------------------------------------------------------------

export function pemToDer(pem: string, label: string): ArrayBuffer {
  const re = new RegExp(
    `-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`,
  );
  const m = pem.match(re);
  const b64 = (m ? m[1] : pem).replace(/[^A-Za-z0-9+/=]/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer as ArrayBuffer;
}

export function derToPem(der: ArrayBuffer | Uint8Array, label: string): string {
  const bytes = der instanceof Uint8Array ? der : new Uint8Array(der);
  let b64 = "";
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  b64 = btoa(b64);
  const chunks = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${chunks.join("\n")}\n-----END ${label}-----\n`;
}

/**
 * 将 PKCS#1 的 RSAPrivateKey DER 包装成 PKCS#8 PrivateKeyInfo。
 * PrivateKeyInfo ::= SEQUENCE {
 *   version Version,
 *   privateKeyAlgorithm AlgorithmIdentifier,
 *   privateKey OCTET STRING  -- 内容为 RSAPrivateKey
 * }
 * rsaEncryption OID = 1.2.840.113549.1.1.1
 */
function rsaPkcs1ToPkcs8(pkcs1: ArrayBuffer): ArrayBuffer {
  const rsaDer = new Uint8Array(pkcs1);
  // AlgorithmIdentifier: 30 0D 06 09 2A 86 48 86 F7 0D 01 01 01 05 00
  const algId = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);
  // version INTEGER 0: 02 01 00
  const ver = new Uint8Array([0x02, 0x01, 0x00]);
  const octetStr = concatLen([0x04], rsaDer);
  const inner = concat(ver, algId, octetStr);
  const out = concatLen([0x30], inner);
  return out.buffer as ArrayBuffer;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** 为给定 payload 加上 ASN.1 TLV 的 tag + length 头 */
function concatLen(tag: number[], payload: Uint8Array): Uint8Array {
  const len = payload.length;
  let lenBytes: number[];
  if (len < 0x80) {
    lenBytes = [len];
  } else {
    const tmp: number[] = [];
    let v = len;
    while (v > 0) {
      tmp.unshift(v & 0xff);
      v >>= 8;
    }
    lenBytes = [0x80 | tmp.length, ...tmp];
  }
  return concat(
    new Uint8Array(tag),
    new Uint8Array(lenBytes),
    payload,
  );
}
