/**
 * OCSP 响应器实现 (RFC 6960)。
 *
 * 流程：
 *   1. 解析 OCSPRequest (DER) -> 提取每个 Request 的 (issuerNameHash, issuerKeyHash, serial)
 *   2. 按 issuerKeyHash 匹配候选子 CA，查 KV 拿状态
 *   3. 构造 BasicOCSPResponse，用 OCSP 响应者私钥签名，整体封装为 OCSPResponse (DER)
 *
 * 不合法请求返回 HTTP 200 + OCSPResponseStatus.malformedRequest（RFC 6960 §4.2.1）。
 */
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

import {
  CA_NAMES,
  loadCaCert,
  loadCaPrivateKey,
  type CaName,
} from "./ca-registry";
import { getCert } from "./kv";
import { asBufferSource } from "./bytes";
import type { Env } from "../env";

// 确保 pkijs 引擎已注册
import "./pfx";

// OCSPResponseStatus codes (RFC 6960)
export const OCSPResponseStatus = {
  successful: 0,
  malformedRequest: 1,
  internalError: 2,
  tryLater: 3,
  sigRequired: 5,
  unauthorized: 6,
} as const;

/** 构造只含状态码（不含 responseBytes）的响应 DER。 */
export function buildStatusOnlyOcspResponse(status: number): Uint8Array {
  const resp = new pkijs.OCSPResponse({
    responseStatus: new asn1js.Enumerated({ value: status }),
  });
  const der = resp.toSchema().toBER(false);
  return new Uint8Array(der);
}

/**
 * 构造并签名完整的 OCSP 响应。
 */
export async function buildOcspResponse(
  env: Env,
  origin: string,
  reqDer: Uint8Array,
): Promise<Uint8Array> {
  // 解析请求
  let ocspReq: pkijs.OCSPRequest;
  try {
    const src = reqDer.buffer.slice(
      reqDer.byteOffset,
      reqDer.byteOffset + reqDer.byteLength,
    );
    const asn = asn1js.fromBER(asBufferSource(src));
    if (asn.offset === -1) throw new Error("asn1 parse error");
    ocspReq = new pkijs.OCSPRequest({ schema: asn.result });
  } catch (e) {
    console.error("[ocsp] malformed", e);
    return buildStatusOnlyOcspResponse(OCSPResponseStatus.malformedRequest);
  }

  const reqList = ocspReq.tbsRequest.requestList;
  if (!reqList || reqList.length === 0) {
    return buildStatusOnlyOcspResponse(OCSPResponseStatus.malformedRequest);
  }

  // OCSP 响应者证书与私钥
  const responderCert = await loadCaCert("ocsprs", origin);
  const responderKey = await loadCaPrivateKey(env, "ocsprs");
  const responderPkiCert = pkiCertFromPeculiar(responderCert);

  // 预计算各子 CA 的 keyHash（SHA-1 与 SHA-256，按请求者选择）
  const caKeyHashes = await computeAllCaKeyHashes(origin);

  // 构造 responses
  const now = new Date();
  const nextUpdate = new Date(now.getTime() + 24 * 3600 * 1000);
  const singleResponses: pkijs.SingleResponse[] = [];

  for (const one of reqList) {
    const cid = one.reqCert;
    const reqHashAlgoOid = cid.hashAlgorithm.algorithmId;
    const reqKeyHash = new Uint8Array(cid.issuerKeyHash.valueBlock.valueHex);
    const serialBi = new Uint8Array(cid.serialNumber.valueBlock.valueHex);
    const serialHex = bytesToHexTrimmed(serialBi);

    const caName = matchCa(reqHashAlgoOid, reqKeyHash, caKeyHashes);

    // 查询状态
    let certStatus: any;
    if (!caName) {
      certStatus = buildUnknownStatus();
    } else {
      const rec = await getCert(env, serialHex);
      if (!rec) {
        certStatus = buildUnknownStatus();
      } else if (rec.status === "revoked" && rec.revokedAt) {
        certStatus = buildRevokedStatus(new Date(rec.revokedAt), rec.revokeReason);
      } else {
        certStatus = buildGoodStatus();
      }
    }

    const single = new pkijs.SingleResponse({
      certID: cid,
      certStatus,
      thisUpdate: now,
      nextUpdate,
    });
    singleResponses.push(single);
  }

  // ResponseData
  const tbsResp = new pkijs.ResponseData({
    responderID: responderPkiCert.subject, // byName
    producedAt: now,
    responses: singleResponses,
  });

  const basicOcsp = new pkijs.BasicOCSPResponse({
    tbsResponseData: tbsResp,
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({
      algorithmId: "1.2.840.113549.1.1.11", // sha256WithRSAEncryption
    }),
    signature: new asn1js.BitString({ valueHex: new ArrayBuffer(0) }),
    certs: [responderPkiCert],
  });

  await basicOcsp.sign(responderKey, "SHA-256");

  // 外层 OCSPResponse
  const basicDer = basicOcsp.toSchema().toBER(false);
  const response = new pkijs.OCSPResponse({
    responseStatus: new asn1js.Enumerated({
      value: OCSPResponseStatus.successful,
    }),
    responseBytes: new pkijs.ResponseBytes({
      responseType: "1.3.6.1.5.5.7.48.1.1", // id-pkix-ocsp-basic
      response: new asn1js.OctetString({ valueHex: basicDer }),
    }),
  });

  return new Uint8Array(response.toSchema().toBER(false));
}

// ---------------------------------------------------------------------------
//  helpers: CertStatus 构造（pkijs 的 CertificateStatus 是 schema-only 包装）
// ---------------------------------------------------------------------------

/**
 * certStatus CHOICE:
 *   good     [0] IMPLICIT NULL
 *   revoked  [1] IMPLICIT RevokedInfo
 *   unknown  [2] IMPLICIT UnknownInfo (NULL)
 */
function buildGoodStatus(): asn1js.Primitive {
  return new asn1js.Primitive({
    idBlock: { tagClass: 3, tagNumber: 0 },
    lenBlockLength: 1,
  } as any);
}

function buildUnknownStatus(): asn1js.Primitive {
  return new asn1js.Primitive({
    idBlock: { tagClass: 3, tagNumber: 2 },
    lenBlockLength: 1,
  } as any);
}

function buildRevokedStatus(revokedAt: Date, reason?: string): asn1js.Constructed {
  const items: asn1js.BaseBlock<any>[] = [
    new asn1js.GeneralizedTime({ valueDate: revokedAt }),
  ];
  if (reason) {
    items.push(
      new asn1js.Constructed({
        idBlock: { tagClass: 3, tagNumber: 0 },
        value: [new asn1js.Enumerated({ value: reasonToCode(reason) })],
      } as any),
    );
  }
  return new asn1js.Constructed({
    idBlock: { tagClass: 3, tagNumber: 1 },
    value: items,
  } as any);
}

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

// ---------------------------------------------------------------------------
//  helpers: issuer keyHash 匹配
// ---------------------------------------------------------------------------

async function computeAllCaKeyHashes(origin: string): Promise<
  Array<{ caName: CaName; sha1: Uint8Array; sha256: Uint8Array }>
> {
  const out: Array<{ caName: CaName; sha1: Uint8Array; sha256: Uint8Array }> = [];
  for (const name of CA_NAMES) {
    try {
      const cert = await loadCaCert(name, origin);
      const spkiBytes = spkiPublicKeyBytes(cert);
      const sha1 = new Uint8Array(await crypto.subtle.digest("SHA-1", spkiBytes));
      const sha256 = new Uint8Array(await crypto.subtle.digest("SHA-256", spkiBytes));
      out.push({ caName: name, sha1, sha256 });
    } catch (e) {
      console.error(`[ocsp] load ${name} ca failed`, e);
    }
  }
  return out;
}

/** 取 SubjectPublicKey BIT STRING 的 value（不含 unused bits 字节） */
function spkiPublicKeyBytes(
  cert: import("@peculiar/x509").X509Certificate,
): ArrayBuffer {
  const raw = new Uint8Array(cert.publicKey.rawData);
  const asn = asn1js.fromBER(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  );
  if (asn.offset === -1) return raw.buffer as ArrayBuffer;
  const seq = asn.result as asn1js.Sequence;
  const bitStr = seq.valueBlock.value[1] as asn1js.BitString;
  return bitStr.valueBlock.valueHex;
}

function matchCa(
  hashAlgoOid: string,
  keyHash: Uint8Array,
  all: Array<{ caName: CaName; sha1: Uint8Array; sha256: Uint8Array }>,
): CaName | null {
  const isSha1 = hashAlgoOid === "1.3.14.3.2.26";
  for (const it of all) {
    const target = isSha1 ? it.sha1 : it.sha256;
    if (equalBytes(target, keyHash)) return it.caName;
  }
  return null;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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

function bytesToHexTrimmed(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex.replace(/^0+/, "") || "0";
}
