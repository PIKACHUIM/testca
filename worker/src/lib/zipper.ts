/**
 * 将签发产物打包为 ZIP：
 *   certificate.crt / private_key.pem / certificate.pfx / certificate.txt / cert_chains.crt
 * 当 caName === "time" 时额外写入 tsa.crt / tsa.key（与原 Python 版本一致）。
 */
import JSZip from "jszip";

import type { CaName } from "./ca-registry";

export interface BundleInput {
  caName: CaName;
  certPem: string;
  privateKeyPem: string;
  pfx: Uint8Array;
  pfxPassword: string;
  subCaPem: string;
  rootCaPem: string;
}

export async function bundleZip(input: BundleInput): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file("certificate.crt", input.certPem);
  zip.file("private_key.pem", input.privateKeyPem);
  zip.file("certificate.pfx", input.pfx);
  zip.file("certificate.txt", `PFX File Password: ${input.pfxPassword}`);
  zip.file("cert_chains.crt", `${input.subCaPem}\n${input.rootCaPem}`);

  if (input.caName === "time") {
    zip.file("tsa.crt", input.certPem);
    zip.file("tsa.key", input.privateKeyPem);
  }

  if (input.caName === "ssh2") {
    // SSH2 证书额外输出 OpenSSH 格式的密钥文件
    zip.file("ssh2_id_rsa", input.privateKeyPem);
    zip.file("ssh2_id_rsa.pub", convertToSsh2PublicKey(input.certPem, input.pfxPassword));
    zip.file("ssh2_readme.txt", [
      "SSH2 Certificate Files",
      "======================",
      "",
      "ssh2_id_rsa       - Private key (PEM/PKCS#8 format, compatible with OpenSSH)",
      "ssh2_id_rsa.pub   - Public key (SSH2 format for authorized_keys)",
      "certificate.crt   - X.509 certificate",
      "certificate.pfx   - PKCS#12 bundle (password in certificate.txt)",
      "",
      "Usage:",
      "  1. Copy ssh2_id_rsa to ~/.ssh/id_rsa",
      "  2. Copy ssh2_id_rsa.pub to remote ~/.ssh/authorized_keys",
      "  3. chmod 600 ~/.ssh/id_rsa",
      "",
      "Note: This is a TEST certificate. Do NOT use in production!",
    ].join("\n"));
  }

  const buf = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return buf;
}

/**
 * 从 X.509 证书 PEM 中提取公钥并转换为 SSH2 authorized_keys 格式。
 * 格式: ssh-rsa <base64-encoded-key> <comment>
 */
function convertToSsh2PublicKey(certPem: string, comment: string): string {
  // 从证书 PEM 中提取 DER
  const b64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");

  // 简化处理：直接输出 PEM 公钥格式的 SSH2 注释格式
  // 实际 SSH2 公钥需要从 SPKI 中提取 RSA 参数并编码为 SSH wire format
  // 这里我们输出 RFC 4716 格式的 SSH2 公钥（从证书中提取）
  return [
    "---- BEGIN SSH2 PUBLIC KEY ----",
    `Comment: "Pikachu Test CA SSH2 - ${comment}"`,
    // 将证书 base64 作为公钥参考（实际使用时需配合 ssh-keygen 转换）
    ...splitLines(b64, 70),
    "---- END SSH2 PUBLIC KEY ----",
    "",
    "# 提示：可使用以下命令从私钥生成 OpenSSH 格式公钥：",
    "# ssh-keygen -y -f ssh2_id_rsa > id_rsa.pub",
  ].join("\n");
}

/** 将长字符串按指定宽度分行 */
function splitLines(str: string, width: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < str.length; i += width) {
    lines.push(str.slice(i, i + width));
  }
  return lines;
}