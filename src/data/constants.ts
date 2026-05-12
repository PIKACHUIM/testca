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
  cnEn: 'Pikachu Test CA RSA',
  description: '皮卡丘信任网络 CA · 皮卡丘证书颁发机构（Root CA · 2000-2100）',
  descriptionEn: 'Pikachu Trust Network CA · Root Certification Authority',
  dir: 'certs/rootca',
  crlRange: '2000 — 2100',
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
    crlRange: '2000/01/01 — 2100/01/01',
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
    crlRange: '2000/01/01 — 2100/01/01',
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
    crlRange: '2000/01/01 — 2100/01/01',
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
    crlRange: '2000/01/01 — 2100/01/01',
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
    crlRange: '2000/01/01 — 2100/01/01',
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
    crlRange: '2000/01/01 — 2100/01/01',
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
    crlRange: '2000/01/01 — 2100/01/01',
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
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/signca/signca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'ssh2ca',
    cn: 'Pikachu SSH2 Sub CA',
    cnEn: 'Pikachu SSH2 Authentication Sub CA',
    description: 'SSH2 密钥认证证书中间 CA，用于 SSH 远程登录身份认证。',
    descriptionEn: 'Intermediate CA for SSH2 key-based authentication certificates.',
    dir: 'certs/ssh2ca',
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/ssh2ca/ssh2ca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'acmeca',
    cn: 'Pikachu ACME Sub CA',
    cnEn: 'Pikachu ACME Automation Sub CA',
    description: 'ACME 自动化证书管理中间 CA，用于 Let\'s Encrypt 风格的自动证书签发与续期。',
    descriptionEn: 'Intermediate CA for ACME automated certificate management (Let\'s Encrypt style).',
    dir: 'certs/acmeca',
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/acmeca/acmeca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'ssl3ca',
    cn: 'Pikachu SSL3 Sub CA',
    cnEn: 'Pikachu SSL3 Legacy Sub CA',
    description: 'SSL3 传统兼容证书中间 CA，用于旧版 SSL/TLS 协议兼容性测试。',
    descriptionEn: 'Intermediate CA for legacy SSL3/TLS compatibility testing.',
    dir: 'certs/ssl3ca',
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/ssl3ca/ssl3ca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'iotsca',
    cn: 'Pikachu IoTS Sub CA',
    cnEn: 'Pikachu IoT Security Sub CA',
    description: 'IoT 设备安全证书中间 CA，用于物联网设备身份认证与安全通信。',
    descriptionEn: 'Intermediate CA for IoT device identity and secure communication.',
    dir: 'certs/iotsca',
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/iotsca/iotsca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'netsca',
    cn: 'Pikachu NetS Sub CA',
    cnEn: 'Pikachu Network Security Sub CA',
    description: '网络安全证书中间 CA，用于 VPN / IPSec / 802.1X 等网络安全场景。',
    descriptionEn: 'Intermediate CA for VPN / IPSec / 802.1X network security certificates.',
    dir: 'certs/netsca',
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/netsca/netsca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'cardca',
    cn: 'Pikachu Card Sub CA',
    cnEn: 'Pikachu Smart Card Sub CA',
    description: '智能卡证书中间 CA，用于 PIV / CAC 智能卡与硬件令牌身份认证。',
    descriptionEn: 'Intermediate CA for PIV / CAC smart card and hardware token authentication.',
    dir: 'certs/cardca',
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/cardca/cardca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
  {
    id: 'fidoca',
    cn: 'Pikachu FIDO Sub CA',
    cnEn: 'Pikachu FIDO Attestation Sub CA',
    description: 'FIDO/WebAuthn 认证器证明证书中间 CA，用于 FIDO2 / U2F 安全密钥设备认证。',
    descriptionEn: 'Intermediate CA for FIDO2 / U2F / WebAuthn authenticator attestation.',
    dir: 'certs/fidoca',
    crlRange: '2000/01/01 — 2100/01/01',
    crlFile: 'certs/fidoca/fidoca.crl',
    formats: ['cer', 'crt', 'der', 'p7b'],
    tone: 'intermediate',
  },
]

/** 可申请的证书类型（与原静态页 select 保持一致） */
export interface CertProduct {
  value: 'time' | 'uefi' | 'code' | 'auth' | 'file' | 'mail' | 'mtls' | 'sign' | 'ssh2' | 'acme' | 'ssl3' | 'iots' | 'nets' | 'card' | 'fido'
  label: string
  /** i18n key: prod.<value>.hint */
  hintKey:
    | 'prod.time.hint'
    | 'prod.uefi.hint'
    | 'prod.code.hint'
    | 'prod.auth.hint'
    | 'prod.file.hint'
    | 'prod.mail.hint'
    | 'prod.mtls.hint'
    | 'prod.sign.hint'
    | 'prod.ssh2.hint'
    | 'prod.acme.hint'
    | 'prod.ssl3.hint'
    | 'prod.iots.hint'
    | 'prod.nets.hint'
    | 'prod.card.hint'
    | 'prod.fido.hint'
  /** i18n key: prod.<value>.use —— 用途详细说明 */
  useKey:
    | 'prod.time.use'
    | 'prod.uefi.use'
    | 'prod.code.use'
    | 'prod.auth.use'
    | 'prod.file.use'
    | 'prod.mail.use'
    | 'prod.mtls.use'
    | 'prod.sign.use'
    | 'prod.ssh2.use'
    | 'prod.acme.use'
    | 'prod.ssl3.use'
    | 'prod.iots.use'
    | 'prod.nets.use'
    | 'prod.card.use'
    | 'prod.fido.use'
}

export const CERT_PRODUCTS: CertProduct[] = [
  { value: 'time', label: 'Pikachu Time Sub CA', hintKey: 'prod.time.hint', useKey: 'prod.time.use' },
  { value: 'uefi', label: 'Pikachu UEFI Sub CA', hintKey: 'prod.uefi.hint', useKey: 'prod.uefi.use' },
  { value: 'code', label: 'Pikachu Code Sub CA', hintKey: 'prod.code.hint', useKey: 'prod.code.use' },
  { value: 'auth', label: 'Pikachu Auth Sub CA', hintKey: 'prod.auth.hint', useKey: 'prod.auth.use' },
  { value: 'file', label: 'Pikachu File Sub CA', hintKey: 'prod.file.hint', useKey: 'prod.file.use' },
  { value: 'mail', label: 'Pikachu Mail Sub CA', hintKey: 'prod.mail.hint', useKey: 'prod.mail.use' },
  { value: 'mtls', label: 'Pikachu mTLS Sub CA', hintKey: 'prod.mtls.hint', useKey: 'prod.mtls.use' },
  { value: 'sign', label: 'Pikachu Sign Sub CA', hintKey: 'prod.sign.hint', useKey: 'prod.sign.use' },
  { value: 'ssh2', label: 'Pikachu SSH2 Sub CA', hintKey: 'prod.ssh2.hint', useKey: 'prod.ssh2.use' },
  { value: 'acme', label: 'Pikachu ACME Sub CA', hintKey: 'prod.acme.hint', useKey: 'prod.acme.use' },
  { value: 'ssl3', label: 'Pikachu SSL3 Sub CA', hintKey: 'prod.ssl3.hint', useKey: 'prod.ssl3.use' },
  { value: 'iots', label: 'Pikachu IoTS Sub CA', hintKey: 'prod.iots.hint', useKey: 'prod.iots.use' },
  { value: 'nets', label: 'Pikachu NetS Sub CA', hintKey: 'prod.nets.hint', useKey: 'prod.nets.use' },
  { value: 'card', label: 'Pikachu Card Sub CA', hintKey: 'prod.card.hint', useKey: 'prod.card.use' },
  { value: 'fido', label: 'Pikachu FIDO Sub CA', hintKey: 'prod.fido.hint', useKey: 'prod.fido.use' },
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

/**
 * 后端签发接口：同站部署（与前端同一个 Cloudflare Worker）时为相对路径，
 * 需要跨站部署时改成完整 URL，例如 `https://issuer.524228.xyz/cert/`。
 */
export const ISSUER_ENDPOINT = '/cert/'

/**
 * 后端吊销接口。
 */
export const REVOKE_ENDPOINT = '/revoke'

