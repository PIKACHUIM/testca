/**
 * CRL (RFC 5280 §5) 实时构造。
 *
 * 每次被调用时：
 *   1. 从 KV 读取 `revoked:<caName>:*` 索引
 *   2. 组装 TBSCertList（含 cRLNumber / authorityKeyIdentifier 扩展）
 *   3. 用 caName 对应私钥签名，产出 CertificateRevocationList DER
 */
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

import {
  loadCaCert,
  loadCaPrivateKey,
  type CaName,
} from "./ca-registry";
import { listRevokedByCa } from "./kv";
import { asBufferSource, fromHex } from "./bytes";
import type { Env } from "../env";

// 确保 pkijs 引擎已注册
import "./pfx";

/** 按 CA 生成 CRL 的 DER 字节流 */
export async function buildCrl(
  env: Env,
  origin: string,
  caName: CaName,
): Promise<Uint8Array> {
  const issuerCert = await loadCaCert(caName, origin);
  const issuerKey = await loadCaPrivateKey(env, caName);

  const now = new Date();
  const nextUpdate = new Date(now.getTime() + 24 * 3600 * 1000);

  // 解析 issuer DN
  const issuerPki = pkiCertFromPeculiar(issuerCert);

  // 收集 revoked
  const revoked = await listRevokedByCa(env, caName);

  // 构造 revokedCertificates 列表
  const revokedCerts = revoked.map((r) => {
    const serialBytes = fromHex(r.serial);
    // 确保首字节最高位为 0（DER INTEGER 语义）
    let sn: Uint8Array = serialBytes;
    if (sn.length === 0) sn = new Uint8Array([0]);
    if (sn[0] & 0x80) {
      const padded = new Uint8Array(sn.length + 1);
      padded[0] = 0x00;
      padded.set(sn, 1);
      sn = padded;
    }
    const rc = new pkijs.RevokedCertificate({
      userCertificate: new asn1js.Integer({
        isHexOnly: true,
        valueHex: asBufferSource(
          sn.buffer.slice(sn.byteOffset, sn.byteOffset + sn.byteLength),
        ),
      }),
      revocationDate: new pkijs.Time({ type: 0, value: new Date(r.revokedAt) }),
      crlEntryExtensions: new pkijs.Extensions({
        extensions: [
          new pkijs.Extension({
            extnID: "2.5.29.21", // cRLReason
            critical: false,
            extnValue: new asn1js.Enumerated({ value: reasonToCode(r.reason) }).toBER(false),
          }),
        ],
      }),
    });
    return rc;
  });

  // CRL 扩展：AKI + cRLNumber
  const akiExt = await buildAkiExtension(issuerCert);
  const crlNumber = BigInt(Math.floor(Date.now() / 1000));
  const crlNumberBytes = bigintToUint8(crlNumber);
  const crlNumberExt = new pkijs.Extension({
    extnID: "2.5.29.20",
    critical: false,
    extnValue: new asn1js.Integer({
      isHexOnly: true,
      valueHex: asBufferSource(
        crlNumberBytes.buffer.slice(
          crlNumberBytes.byteOffset,
          crlNumberBytes.byteOffset + crlNumberBytes.byteLength,
        ),
      ),
    }).toBER(false),
  });

  const crl = new pkijs.CertificateRevocationList({
    version: 1, // v2
    signature: new pkijs.AlgorithmIdentifier({
      algorithmId: "1.2.840.113549.1.1.11",
    }),
    issuer: issuerPki.subject,
    thisUpdate: new pkijs.Time({ type: 0, value: now }),
    nextUpdate: new pkijs.Time({ type: 0, value: nextUpdate }),
    revokedCertificates: revokedCerts,
    crlExtensions: new pkijs.Extensions({
      extensions: [akiExt, crlNumberExt],
    }),
  });

  await crl.sign(issuerKey, "SHA-256");
  return new Uint8Array(crl.toSchema(true).toBER(false));
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function reasonToCode(reason: string): number {
  const map: Record<string, number> = {
    unspecified: 0,
    keyCompromise: 1,
    cACompromise: 2,
    affiliationChanged: 3,
    superseded: 4,
    cessationOfOperation: 5,
    certificateHold: 6,
    removeFromCRL: 8,
    privilegeWithdrawn: 9,
    aACompromise: 10,
  };
  return map[reason] ?? 0;
}

function bigintToUint8(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([0]);
  const out: number[] = [];
  let v = n;
  while (v > 0n) {
    out.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  if (out[0] & 0x80) out.unshift(0);
  return Uint8Array.from(out);
}

function pkiCertFromPeculiar(
  cert: import("@peculiar/x509").X509Certificate,
): pkijs.Certificate {
  const der = new Uint8Array(cert.rawData);
  const asn = asn1js.fromBER(
    der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength),
  );
  if (asn.offset === -1) throw new Error("parse cert failed");
  return new pkijs.Certificate({ schema: asn.result });
}

/**
 * AuthorityKeyIdentifier extension value = SEQUENCE {
 *   [0] OCTET STRING keyIdentifier
 * }
 * keyIdentifier = SHA-1(SubjectPublicKey BIT STRING value)
 */
async function buildAkiExtension(
  issuerCert: import("@peculiar/x509").X509Certificate,
): Promise<pkijs.Extension> {
  const raw = new Uint8Array(issuerCert.publicKey.rawData);
  const asn = asn1js.fromBER(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const seq = asn.result as asn1js.Sequence;
  const bitStr = seq.valueBlock.value[1] as asn1js.BitString;
  const keyId = new Uint8Array(
    await crypto.subtle.digest("SHA-1", bitStr.valueBlock.valueHex),
  );

  // [0] IMPLICIT OCTET STRING keyIdentifier
  const kidTagged = new asn1js.Primitive({
    idBlock: { tagClass: 3, tagNumber: 0 },
    valueHex: keyId.buffer.slice(keyId.byteOffset, keyId.byteOffset + keyId.byteLength),
  } as any);

  const extnValue = new asn1js.Sequence({ value: [kidTagged] }).toBER(false);

  return new pkijs.Extension({
    extnID: "2.5.29.35",
    critical: false,
    extnValue,
  });
}
