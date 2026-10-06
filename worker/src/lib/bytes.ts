/**
 * 二进制 / 十六进制 / Base64 / Base64URL 等通用工具。
 */

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const s = hex.replace(/^0x/, "");
  if (s.length % 2 !== 0) throw new Error("invalid hex length");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 收窄为 WebCrypto / asn1js / pkijs 所需的 `BufferSource`。
 *
 * TS 5.7+ 起 `Uint8Array`/`ArrayBuffer` 带 `ArrayBufferLike` 泛型
 * （可能是 SharedArrayBuffer），而 WebCrypto 的 `BufferSource` 要求
 * `ArrayBufferView<ArrayBuffer>`，两者不兼容；但运行期值始终是普通
 * ArrayBuffer/视图，这里仅做类型收窄，不产生任何运行时开销。
 */
export function asBufferSource(
  data: ArrayBufferLike | ArrayBufferView,
): BufferSource {
  return data as unknown as BufferSource;
}

export function fromBase64Url(b64url: string): Uint8Array {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(b64);
}

export function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  return toBase64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 随机 ASCII（字母+数字）串 */
export function randAscii(len: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** 随机大写 + 数字（CAServer.py 的 6 位后缀使用此方式） */
export function randUpperAlnum(len: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** SHA-256 DER SPKI 指纹（hex, lower） */
export async function sha256Hex(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", asBufferSource(buf));
  return toHex(digest);
}
