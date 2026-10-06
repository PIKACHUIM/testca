/**
 * PKCS#12 (.pfx) 打包。
 *
 * 使用 pkijs 的 PFX/SafeContents/SafeBag 构造符合 RFC 7292 的 PKCS#12：
 *   - CertBag: 终端证书 + 子 CA
 *   - PKCS#8 ShroudedKeyBag: 加密后的订户私钥
 *   - MAC: HMAC-SHA-256 保护
 *
 * 随机 16 位字母+数字密码由调用方生成，本模块负责 bytes -> bytes 的序列化。
 */
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

import { pemToDer } from "./ca-registry";

// 在 Worker 中设置 pkijs 引擎为 WebCrypto
const pkiEngine = new pkijs.CryptoEngine({
  name: "webcrypto",
  crypto: crypto,
});
pkijs.setEngine("worker-webcrypto", pkiEngine, pkiEngine as any);

export interface BuildPfxParams {
  certPem: string;
  caCertPem: string;
  privateKeyPem: string; // PKCS#8
  friendlyName: string;
  password: string;
}

/**
 * 组装 PKCS#12 字节流（DER）。
 */
export async function buildPfx(params: BuildPfxParams): Promise<Uint8Array> {
  const { certPem, caCertPem, privateKeyPem, friendlyName, password } = params;

  // 解析入参 ---------------------------------------------------------------
  const certDer = new Uint8Array(pemToDer(certPem, "CERTIFICATE"));
  const caDer = new Uint8Array(pemToDer(caCertPem, "CERTIFICATE"));
  const keyDer = new Uint8Array(pemToDer(privateKeyPem, "PRIVATE KEY"));

  const certAsn = asn1js.fromBER(certDer.buffer);
  if (certAsn.offset === -1) throw new Error("parse cert failed");
  const cert = new pkijs.Certificate({ schema: certAsn.result });

  const caAsn = asn1js.fromBER(caDer.buffer);
  if (caAsn.offset === -1) throw new Error("parse CA failed");
  const caCert = new pkijs.Certificate({ schema: caAsn.result });

  const pkAsn = asn1js.fromBER(keyDer.buffer);
  if (pkAsn.offset === -1) throw new Error("parse key failed");
  const pkcs8 = new pkijs.PrivateKeyInfo({ schema: pkAsn.result });

  const localKeyId = new Uint8Array(20);
  crypto.getRandomValues(localKeyId);

  // 1) CertBag SafeContents ------------------------------------------------
  const certBag = new pkijs.SafeBag({
    bagId: "1.2.840.113549.1.12.10.1.3", // certBag
    bagValue: new pkijs.CertBag({
      parsedValue: cert,
    }),
    bagAttributes: [
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.20", // friendlyName
        values: [new asn1js.BmpString({ value: friendlyName })],
      }),
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.21", // localKeyID
        values: [new asn1js.OctetString({ valueHex: localKeyId.buffer })],
      }),
    ],
  });

  const caBag = new pkijs.SafeBag({
    bagId: "1.2.840.113549.1.12.10.1.3",
    bagValue: new pkijs.CertBag({
      parsedValue: caCert,
    }),
  });

  // 2) ShroudedKeyBag SafeContents ----------------------------------------
  const shroudedKeyBag = new pkijs.PKCS8ShroudedKeyBag({
    parsedValue: pkcs8,
  });

  const keyBag = new pkijs.SafeBag({
    bagId: "1.2.840.113549.1.12.10.1.2", // pkcs8ShroudedKeyBag
    bagValue: shroudedKeyBag,
    bagAttributes: [
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.20",
        values: [new asn1js.BmpString({ value: friendlyName })],
      }),
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.21",
        values: [new asn1js.OctetString({ valueHex: localKeyId.buffer })],
      }),
    ],
  });

  // 3) 组装 PFX -----------------------------------------------------------
  // 注意：私钥已在 ShroudedKeyBag 级别加密，所以其容器使用 privacyMode: 0（明文）。
  // 如果容器也用 privacyMode: 1 会导致双重加密，客户端无法正确解密。
  const pfx = new pkijs.PFX({
    parsedValue: {
      integrityMode: 0, // password based
      authenticatedSafe: new pkijs.AuthenticatedSafe({
        parsedValue: {
          safeContents: [
            {
              privacyMode: 0, // 明文容器（CertBag）
              value: new pkijs.SafeContents({
                safeBags: [certBag, caBag],
              }),
            },
            {
              privacyMode: 0, // 明文容器（ShroudedKeyBag 已自带加密）
              value: new pkijs.SafeContents({
                safeBags: [keyBag],
              }),
            },
          ],
        },
      }),
    },
  });

  // 4) 对 ShroudedKey 与整体 MAC 进行加密/保护
  if (!pfx.parsedValue?.authenticatedSafe) {
    throw new Error("PFX parsedValue missing");
  }

  await shroudedKeyBag.makeInternalValues(
    {
      password: strToArrayBuffer(password),
      // 注意：pkijs 的 ContentEncryptionAesCbcParams 直接复用 WebCrypto 的
      // AesCbcParams（内含必填的 iv），但 pkijs 运行期在未提供 iv 时会自行
      // 随机生成，因此这里只给 name/length 是官方推荐用法，需显式收窄类型。
      contentEncryptionAlgorithm: {
        name: "AES-CBC",
        length: 256,
      } as unknown as pkijs.ContentEncryptionAlgorithm,
      hmacHashAlgorithm: "SHA-256",
      iterationCount: 2048,
    },
    pkiEngine as any,
  );

  await pfx.parsedValue.authenticatedSafe.makeInternalValues(
    {
      safeContents: [
        {}, // 明文容器（CertBag）
        {}, // 明文容器（ShroudedKeyBag 已自带加密）
      ],
    },
    pkiEngine as any,
  );

  await pfx.makeInternalValues(
    {
      password: strToArrayBuffer(password),
      iterations: 2048,
      pbkdf2HashAlgorithm: "SHA-256",
      hmacHashAlgorithm: "SHA-256",
    },
    pkiEngine as any,
  );

  const der = pfx.toSchema().toBER(false);
  return new Uint8Array(der);
}

/**
 * 将密码字符串转为 UTF-8 编码的 ArrayBuffer。
 *
 * pkijs 内部对不同操作有不同的密码处理：
 *   - MAC (PKCS#12 B.2 via makePKCS12B2Key): 内部自动将 UTF-8 解码后转 UTF-16BE
 *   - 加密 (PBES2/PBKDF2 via encryptEncryptedContentInfo): 直接使用原始字节作为 key material
 *
 * 因此这里统一传入 UTF-8 编码即可，pkijs 会在需要时自行处理编码转换。
 */
function strToArrayBuffer(s: string): ArrayBuffer {
  const buf = new TextEncoder().encode(s);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
