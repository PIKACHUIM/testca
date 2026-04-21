/**
 * Pikachu Test CA · 证书与申请相关常量
 */

export interface CaItem {
  id: string
  cn: string
  cnEn: string
  description: string
  descriptionEn: string
  dir: string // relative path under certs/
  crlRange?: string
  crlFile?: string
  formats: ('cer' | 'crt' | 'der' | 'p7b')[]
  tone: 'root' | 'intermediate'
  ocsp?: string
  cpsChinese?: string
  cpsEnglish?: string
  setupZip?: string
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export const withBase = (p: string): string => {
  if (!p) return p
  if (/^https?:/i.test(p)) return p
  return `${base}/${p.replace(/^\/+/, '')}`
}

export const ROOT_CA: CaItem = {
  id: 'rootca',
  cn: '皮卡丘公共测试根 RSA',
  cnEn: 'Pikachu Public Test Root RSA',
  description: '皮卡丘信任网络 CA · 皮卡丘证书颁发机构（Root CA · 2025-2050）',
  descriptionEn: 'Pikachu Trust Network CA · Root Certification Authority',
  dir: 'certs/rootca',
  crlRange: '2025 — 2050',
  crlFile: 'certs/rootca/rootca.crl',
  formats: ['cer', 'crt', 'der', 'p7b'],
  tone: 'root',
  ocsp: 'https://test.ocsps.us.kg',
  cpsChinese: 'CPS-CN.pdf',
  cpsEnglish: 'CPS-EN.pdf',
  setupZip: 'Setupca.zip',
}

export const SUB_CAS: CaItem[] = [
  {
    id: 'timeca',
    cn: 'Pikachu Time Sub CA',
    cnEn: 'Pikachu Time Signing Sub CA',
    description: '皮卡丘时间戳签署中间子证书 CA，用于代码 / 文件时间戳服务。',
    descriptionEn: 'Intermediate CA for Time Stamping Authority (TSA).',
    dir: 'certs/timeca',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/timeca/timeca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'uefica',
    cn: 'Pikachu UEFI Sub CA',
    cnEn: 'Pikachu UEFI Key Exchange CA',
    description: '皮卡丘 UEFI 密钥交换证书中间 CA，用于固件 / 启动加载器签名。',
    descriptionEn: 'Intermediate CA for UEFI firmware / secure-boot signing.',
    dir: 'certs/uefica',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/uefica/uefica.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'codeca',
    cn: 'Pikachu Code Sub CA',
    cnEn: 'Pikachu Code Signing Sub CA',
    description: '皮卡丘公共测试代码签名中间 CA，用于代码 / 驱动签名。',
    descriptionEn: 'Intermediate CA for Authenticode / driver signing.',
    dir: 'certs/codeca',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/codeca/codeca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'authca',
    cn: 'Pikachu Auth Sub CA',
    cnEn: 'Pikachu Authentication Sub CA',
    description: '身份认证证书中间 CA（Client Auth）。',
    descriptionEn: 'Intermediate CA for client authentication certificates.',
    dir: 'certs/authca',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/authca/authca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'fileca',
    cn: 'Pikachu File Sub CA',
    cnEn: 'Pikachu File Encryption Sub CA',
    description: '文件加密 / EFS 证书中间 CA。',
    descriptionEn: 'Intermediate CA for document / EFS encryption.',
    dir: 'certs/fileca',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/fileca/fileca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'mailca',
    cn: 'Pikachu Mail Sub CA',
    cnEn: 'Pikachu S/MIME Sub CA',
    description: '电子邮件（S/MIME）签名加密中间 CA。',
    descriptionEn: 'Intermediate CA for S/MIME email certificates.',
    dir: 'certs/mailca',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/mailca/mailca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'mtlsca',
    cn: 'Pikachu mTLS Sub CA',
    cnEn: 'Pikachu mTLS Sub CA',
    description: '双向 TLS（mTLS）服务端 / 客户端证书中间 CA。',
    descriptionEn: 'Intermediate CA for mutual-TLS server / client certs.',
    dir: 'certs/mtlsca',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/mtlsca/mtlsca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'signca',
    cn: 'Pikachu Sign Sub CA',
    cnEn: 'Pikachu Document Sign Sub CA',
    description: '文档 / PDF 数字签名证书中间 CA。',
    descriptionEn: 'Intermediate CA for document / PDF digital signatures.',
    dir: 'certs/signca',
    crlRange: '2025/01/01 — 2050/01/01',
    crlFile: 'certs/signca/signca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
]

/** 可申请的证书类型（与原静态页 select 保持一致） */
export interface CertProduct {
  value: 'time' | 'uefi' | 'code' | 'auth' | 'file' | 'mail' | 'mtls' | 'sign'
  label: string
  hint: string
}

export const CERT_PRODUCTS: CertProduct[] = [
  { value: 'time', label: 'Pikachu Time Sub CA', hint: '申请时间签名证书' },
  { value: 'uefi', label: 'Pikachu UEFI Sub CA', hint: '申请 UEFI 签名证书' },
  { value: 'code', label: 'Pikachu Code Sub CA', hint: '申请代码签名证书' },
  { value: 'auth', label: 'Pikachu Auth Sub CA', hint: '申请身份认证证书' },
  { value: 'file', label: 'Pikachu File Sub CA', hint: '申请文件加密证书' },
  { value: 'mail', label: 'Pikachu Mail Sub CA', hint: '申请电子邮件证书' },
  { value: 'mtls', label: 'Pikachu mTLS Sub CA', hint: '申请 SSL 验证证书' },
  { value: 'sign', label: 'Pikachu Sign Sub CA', hint: '申请文件签名证书' },
]

export interface ValidRange {
  value: '1' | '2' | '3' | '4'
  label: string
}

export const VALID_RANGES: ValidRange[] = [
  { value: '1', label: '2000 — 2025' },
  { value: '2', label: '2025 — 2050' },
  { value: '3', label: '2050 — 2075' },
  { value: '4', label: '2075 — 2100' },
]

export const ISSUER_ENDPOINT = 'https://issuer.524228.xyz/cert/'
export const CAPTCHA_APP_ID = 'b4f11125fb26b4fd3010ba2146cf36a7'
export const CAPTCHA_API_SERVER = 'https://cap.dingxiang-inc.com'
