import React, { useEffect, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Collapse,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import {
  CheckCircleFilled,
  CloudUploadOutlined,
  CopyOutlined,
  InboxOutlined,
  KeyOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import PageHelp from '../components/PageHelp'
import {
  CARD_ADMIN_DELETE_ENDPOINT,
  CARD_ADMIN_LIST_ENDPOINT,
  CARD_ADMIN_LOGIN_ENDPOINT,
  CARD_ADMIN_SESSION_ENDPOINT,
  CARD_CODE_STATUS_ENDPOINT,
  CARD_PUT_ENDPOINT,
  CARD_STATUS_ENDPOINT,
  CARD_WEB_PAGE,
} from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'

const { Text, Link } = Typography
const { TextArea, Password } = Input

/** 与服务端 CARD_MAX_BYTES 默认值保持一致 */
const MAX_PFX_BYTES = 8 * 1024 * 1024

/** 下发方式：`key` = 传输密钥（X25519 预协商）；`code` = 取件码（自协商） */
type DeliveryMode = 'key' | 'code'

/** 取件码来源：`auto` = 上传后由平台生成；`custom` = 自定义 / 本地一键随机 */
type CodeSource = 'auto' | 'custom'

interface CardFormValues {
  pubkey: string
  pfxkey: string
  label?: string
  ttl: number
  maxUses: number
  /** 仅在「查询取件码」时使用，与上传表单共用（不会随上传提交） */
  checkCode?: string
}

/** 分发记录的元信息（不含任何密文 / 口令） */
interface CardMeta {
  fingerprint: string
  /** 记录模式：`key`（传输密钥）/ `code`（取件码） */
  mode?: DeliveryMode
  createdAt: string
  size: number
  sha256: string
  label?: string
  /** 取件码模式：有效期（ISO，缺省 = 永久） */
  expiresAt?: string
  /** 取件码模式：允许下发次数 */
  maxUses?: number
  /** 取件码模式：已下发次数 */
  used?: number
  /** 取件码模式：剩余可用次数 */
  remaining?: number
}

/** 服务端策略（`/card/admin/session` 返回） */
interface CardPolicy {
  /** 是否启用了管理接口（配置了口令或令牌） */
  adminEnabled: boolean;
  /** 是否启用口令登录 */
  passwordLogin: boolean;
  /** 是否配置了静态令牌 */
  tokenLogin: boolean;
  /** 是否允许未登录下发（false = 上传 / 查询 / 管理都需登录） */
  allowAnonymous: boolean;
  /** 会话有效期（秒） */
  sessionSeconds: number;
}

/** 当前登录状态 */
interface AdminAuthInfo {
  authenticated: boolean;
  via?: string | null;
  expiresAt?: string | null;
}

/** 会话令牌在本标签页内的存储键（关闭标签页即失效） */
const CREDENTIAL_KEY = 'cardAdminCredential';

/** 取件码有效期预设（秒，0 = 永久） */
const TTL_OPTIONS: Array<{ value: number; labelKey: MessageKey }> = [
  { value: 3600, labelKey: 'card.ttl.1h' },
  { value: 21600, labelKey: 'card.ttl.6h' },
  { value: 86400, labelKey: 'card.ttl.24h' },
  { value: 259200, labelKey: 'card.ttl.3d' },
  { value: 604800, labelKey: 'card.ttl.7d' },
  { value: 2592000, labelKey: 'card.ttl.30d' },
  { value: 0, labelKey: 'card.ttl.never' },
]

/**
 * 宽松解析传输密钥（与服务端 `decodeBase64Loose` 等价）：
 * 容忍空白、URL-safe 字符（- _）、缺失填充以及整段 PEM 文本。
 * 返回 null 表示不是合法 Base64。
 */
const decodeTransferKey = (input: string): Uint8Array | null => {
  let t = (input || '').trim()
  if (!t) return null
  if (t.includes('-----BEGIN')) {
    t = t.replace(/-----BEGIN[^-]*-----/g, '').replace(/-----END[^-]*-----/g, '')
  }
  t = t.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (!/^[A-Za-z0-9+/]+$/.test(t)) return null
  const pad = (4 - (t.length % 4)) % 4
  try {
    const bin = atob(t + '='.repeat(pad))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

const fmtBytes = (n: number): string => {
  if (!Number.isFinite(n)) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`
  return `${(n / 1024 / 1024).toFixed(2)} MiB`
}

const fmtTime = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/** 元信息表格（用于上传结果 / 缓存状态 / 列表） */
const MetaList: React.FC<{ meta: CardMeta }> = ({ meta }) => {
  const { t } = useI18n()
  return (
    <Descriptions size="small" column={1} style={{ marginTop: 4 }}>
      {meta.mode && (
        <Descriptions.Item label={t('card.meta.mode')}>
          <Tag color={meta.mode === 'code' ? 'gold' : 'blue'}>
            {meta.mode === 'code' ? t('card.mode.code.short') : t('card.mode.key.short')}
          </Tag>
        </Descriptions.Item>
      )}
      <Descriptions.Item label={t('card.meta.fingerprint')}>
        <Text code copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
          {meta.fingerprint}
        </Text>
      </Descriptions.Item>
      <Descriptions.Item label={t('card.meta.size')}>{fmtBytes(meta.size)}</Descriptions.Item>
      {meta.mode === 'code' && (
        <Descriptions.Item label={t('card.meta.expires')}>
          {meta.expiresAt ? fmtTime(meta.expiresAt) : t('card.meta.never')}
        </Descriptions.Item>
      )}
      {meta.maxUses !== undefined && (
        <Descriptions.Item label={t('card.meta.uses')}>
          {meta.remaining ?? 0} / {meta.maxUses}
        </Descriptions.Item>
      )}
      <Descriptions.Item label={t('card.meta.sha256')}>
        <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>
          {meta.sha256}
        </Text>
      </Descriptions.Item>
      {meta.createdAt && (
        <Descriptions.Item label={t('card.meta.created')}>{fmtTime(meta.createdAt)}</Descriptions.Item>
      )}
      {meta.label && (
        <Descriptions.Item label={t('card.meta.label')}>{meta.label}</Descriptions.Item>
      )}
    </Descriptions>
  )
}

// ---------------------------------------------------------------------------
// 取件码：与 worker/src/lib/card-code.ts 保持一致的本地规则
// （同一套规则也用在客户端工具 Module/Cryptography.py）
// ---------------------------------------------------------------------------

/** 字母表：数字 + 大写字母，排除会被规范化的 I / L / O */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_LENGTH = 16
const CODE_GROUP = 4
/** 自定义取件码的最小强度：至少这么多个不同字符（服务端同样强制） */
const CODE_MIN_DISTINCT = 8

/** 规范化：大写 → 去掉分隔符 → O→0、I/L→1 */
const normalizePickupCode = (input: string): string =>
  (input || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')

/** 展示形式：每 4 位一组 */
const formatPickupCode = (normalized: string): string =>
  (normalized.match(new RegExp(`.{1,${CODE_GROUP}}`, 'g')) || []).join('-')

const distinctPickupChars = (normalized: string): number => new Set(normalized).size

const isWellFormedPickupCode = (normalized: string): boolean =>
  normalized.length === CODE_LENGTH && [...normalized].every((ch) => CODE_ALPHABET.includes(ch))

const isStrongPickupCode = (normalized: string): boolean =>
  isWellFormedPickupCode(normalized) && distinctPickupChars(normalized) >= CODE_MIN_DISTINCT

/** 本地随机生成取件码（拒绝法采样，避免取模偏差） */
const generatePickupCode = (): string => {
  const limit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length
  let out = ''
  while (out.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < bytes.length && out.length < CODE_LENGTH; i++) {
      if (bytes[i] < limit) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
    }
  }
  return out
}

/** 复制到剪贴板（带降级方案，兼容非安全上下文） */
const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 继续走降级方案 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * TPM 虚拟智能卡证书下发（/card/*）
 *
 * 与 worker/src/routes/card.ts 对接；服务端渲染的上传页（/card/web/cert）
 * 保留给智能卡工具与无 JS 环境使用，两者共用同一套接口。
 */
const CardCertPage: React.FC = () => {
  const { t } = useI18n()
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm<CardFormValues>()

  const [mode, setMode] = useState<DeliveryMode>('code')
  const [codeSource, setCodeSource] = useState<CodeSource>('auto')
  const [customCode, setCustomCode] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{
    ok: boolean
    text?: string
    meta?: CardMeta
    /** 取件码模式下本次生成的口令（仅此一次可得） */
    code?: string
  } | null>(null)
  const [status, setStatus] = useState<{
    checked: boolean
    meta: CardMeta | null
    error?: string
  }>({
    checked: false,
    meta: null,
  })

  // ---- 管理员登录（口令 → 会话令牌）--------------------------------------
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [policy, setPolicy] = useState<CardPolicy | null>(null)
  const [authInfo, setAuthInfo] = useState<AdminAuthInfo>({ authenticated: false })
  const [rows, setRows] = useState<CardMeta[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState('')

  const adminHeaders = (cred: string = credential): Record<string, string> =>
    cred ? { 'x-admin-token': cred } : {}

  /** 查询登录状态与服务端策略；返回是否已认证 */
  const refreshSession = async (cred: string = credential): Promise<boolean> => {
    try {
      const resp = await fetch(CARD_ADMIN_SESSION_ENDPOINT, { headers: adminHeaders(cred) })
      const data = (await resp.json().catch(() => ({}))) as {
        flag?: boolean
        data?: {
          authenticated?: boolean
          via?: string | null
          expiresAt?: string | null
          policy?: CardPolicy
        }
      }
      const info = data.data
      setPolicy(info?.policy ?? null)
      if (resp.ok && info?.authenticated) {
        setAuthInfo({
          authenticated: true,
          via: info.via ?? null,
          expiresAt: info.expiresAt ?? null,
        })
        return true
      }
      setAuthInfo({ authenticated: false })
      return false
    } catch {
      return false
    }
  }

  // 首次进入：恢复本标签页保存的令牌并校验
  useEffect(() => {
    let saved = ''
    try {
      saved = sessionStorage.getItem(CREDENTIAL_KEY) || ''
    } catch {
      saved = ''
    }
    setCredential(saved)
    void refreshSession(saved).then((ok) => {
      if (!ok && saved) {
        try {
          sessionStorage.removeItem(CREDENTIAL_KEY)
        } catch {
          /* 忽略 */
        }
        setCredential('')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLogin = async () => {
    const pwd = password.trim()
    if (!pwd) {
      message.warning(t('card.admin.pass.ph'))
      return
    }
    setLoggingIn(true)
    setListError('')
    try {
      const resp = await fetch(CARD_ADMIN_LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password: pwd }).toString(),
      })
      const data = (await resp.json().catch(() => ({}))) as {
        flag?: boolean
        reason?: string
        text?: string
        data?: { token?: string }
      }
      // 服务端未启用口令登录（只配了静态令牌）时，允许把输入直接当令牌用
      let cred = ''
      if (resp.ok && data.flag && data.data?.token) cred = data.data.token
      else if (data.reason === 'password_disabled') cred = pwd
      else {
        setListError(data.text || t('card.admin.login.fail'))
        return
      }

      const ok = await refreshSession(cred)
      if (!ok) {
        setListError(data.text || t('card.admin.login.fail'))
        return
      }
      setCredential(cred)
      try {
        sessionStorage.setItem(CREDENTIAL_KEY, cred)
      } catch {
        /* 忽略：隐私模式下无法写入 */
      }
      setPassword('')
      message.success(t('card.admin.login.ok'))
      void loadList(cred)
    } catch (err) {
      setListError(`${t('card.net')}: ${(err as Error).message}`)
    } finally {
      setLoggingIn(false)
    }
  }

  const onLogout = () => {
    setCredential('')
    setAuthInfo({ authenticated: false })
    setPassword('')
    setRows([])
    setListError('')
    try {
      sessionStorage.removeItem(CREDENTIAL_KEY)
    } catch {
      /* 忽略 */
    }
  }

  /** 站点允许上传/查询：默认允许匿名，或已登录 */
  const canDistribute = !policy || policy.allowAnonymous || authInfo.authenticated

  // ---- 文件选择 ---------------------------------------------------------
  const beforeUpload = (f: File) => {
    if (f.size > MAX_PFX_BYTES) {
      message.error(t('card.i.file'))
      return false
    }
    setFile(f)
    setFileList([{ uid: f.name, name: f.name, size: f.size } as UploadFile])
    return false // 阻止 antd 自动上传
  }

  // ---- 下发方式切换 -----------------------------------------------------
  const switchMode = (next: DeliveryMode) => {
    setMode(next)
    setResult(null)
    setStatus({ checked: false, meta: null })
  }

  // ---- 取件码来源切换（自动生成 / 自定义）--------------------------------
  const switchCodeSource = (next: CodeSource) => {
    setCodeSource(next)
    // 切到自定义时若还是空的，直接给一个本地随机的，方便即时预览 / 复制
    if (next === 'custom' && !customCode) setCustomCode(generatePickupCode())
  }

  const customCodeState = {
    raw: customCode,
    distinct: distinctPickupChars(customCode),
    valid: isStrongPickupCode(customCode),
    formatted: formatPickupCode(customCode),
  }

  // ---- 上传 -------------------------------------------------------------
  const onUpload = async () => {
    const fields = mode === 'key' ? ['pubkey', 'pfxkey'] : ['pfxkey', 'ttl', 'maxUses']
    const values = await form.validateFields(fields).catch(() => null)
    if (!values) return
    if (!file) {
      message.error(t('card.r.file'))
      return
    }
    // 自定义取件码：先做格式 + 强度校验，避免白传一遍
    if (mode === 'code' && codeSource === 'custom') {
      if (!isWellFormedPickupCode(customCode)) {
        setResult({ ok: false, text: t('card.r.code') })
        return
      }
      if (!isStrongPickupCode(customCode)) {
        setResult({ ok: false, text: t('card.r.code.weak') })
        return
      }
    }
    setSubmitting(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('pfxkey', values.pfxkey ?? '')
      fd.append('vaults', file, file.name)
      const label = (values.label || '').trim()
      if (label) fd.append('label', label)
      if (mode === 'key') {
        fd.append('pubkey', (values.pubkey || '').trim())
      } else {
        fd.append('mode', 'code')
        fd.append('ttl', String(form.getFieldValue('ttl') ?? 86400))
        fd.append('max_uses', String(form.getFieldValue('maxUses') ?? 1))
        // 留空 = 由服务端随机生成；自定义时把规范化后的取件码一起提交
        if (codeSource === 'custom') fd.append('code', customCode)
      }

      const resp = await fetch(CARD_PUT_ENDPOINT, {
        method: 'POST',
        body: fd,
        headers: adminHeaders(),
      })
      const data = (await resp.json().catch(() => ({}))) as {
        flag?: boolean
        text?: string
        meta?: CardMeta
        data?: { code?: string }
      }
      if (resp.ok && data.flag) {
        const code = mode === 'code' ? data.data?.code : undefined
        setResult({ ok: true, meta: data.meta, code })
        if (code) {
          const copied = await copyText(code)
          message.success(copied ? `${t('card.code.ok.title')} · ${t('card.code.copied')}` : t('card.code.ok.title'))
        } else {
          message.success(t('card.ok.title'))
        }
      } else {
        setResult({ ok: false, text: data.text || `HTTP ${resp.status}` })
      }
    } catch (err) {
      setResult({ ok: false, text: `${t('card.net')}: ${(err as Error).message}` })
    } finally {
      setSubmitting(false)
    }
  }

  // ---- 缓存状态查询 -----------------------------------------------------
  const onCheck = async () => {
    if (mode === 'code') {
      const raw = (form.getFieldValue('checkCode') || '').trim()
      const code = raw
      if (!code) {
        setStatus({ checked: true, meta: null, error: t('card.r.code') })
        return
      }
      setChecking(true)
      try {
        const body = new URLSearchParams()
        body.append('code', code)
        const resp = await fetch(CARD_CODE_STATUS_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...adminHeaders() },
          body: body.toString(),
        })
        const data = (await resp.json().catch(() => ({}))) as {
          exists?: boolean
          meta?: CardMeta
          text?: string
        }
        setStatus({
          checked: true,
          meta: data.exists ? data.meta ?? null : null,
          error: data.exists ? undefined : data.text,
        })
      } catch (err) {
        setStatus({ checked: true, meta: null, error: `${t('card.net')}: ${(err as Error).message}` })
      } finally {
        setChecking(false)
      }
      return
    }

    const values = await form.validateFields(['pubkey']).catch(() => null)
    if (!values?.pubkey) return
    setChecking(true)
    try {
      const body = new URLSearchParams()
      body.append('pubkey', values.pubkey.trim())
      const resp = await fetch(CARD_STATUS_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...adminHeaders() },
        body: body.toString(),
      })
      const data = (await resp.json().catch(() => ({}))) as {
        exists?: boolean
        meta?: CardMeta
      }
      setStatus({ checked: true, meta: data.exists ? data.meta ?? null : null })
    } catch (err) {
      message.error(`${t('card.net')}: ${(err as Error).message}`)
    } finally {
      setChecking(false)
    }
  }

  // ---- 缓存管理（需管理员登录）------------------------------------------
  const loadList = async (cred: string = credential) => {
    if (!cred) {
      setListError(t('card.admin.needlogin'))
      return
    }
    setLoadingList(true)
    setListError('')
    try {
      const resp = await fetch(CARD_ADMIN_LIST_ENDPOINT, { headers: adminHeaders(cred) })
      const data = (await resp.json().catch(() => ({}))) as {
        flag?: boolean
        text?: string
        data?: { items?: CardMeta[] }
      }
      if (!resp.ok || !data.flag) {
        setListError(data.text || `HTTP ${resp.status}`)
        setRows([])
        if (resp.status === 401) onLogout()
        return
      }
      setRows(data.data?.items ?? [])
    } catch (err) {
      setListError(`${t('card.net')}: ${(err as Error).message}`)
    } finally {
      setLoadingList(false)
    }
  }

  const removeRow = async (fingerprint: string) => {
    try {
      const body = new URLSearchParams()
      body.append('fingerprint', fingerprint)
      const resp = await fetch(CARD_ADMIN_DELETE_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          ...adminHeaders(),
        },
        body: body.toString(),
      })
      const data = (await resp.json().catch(() => ({}))) as { flag?: boolean; text?: string }
      if (data.flag) {
        message.success(data.text || t('card.admin.delete'))
        void loadList()
      } else {
        message.error(data.text || `HTTP ${resp.status}`)
      }
    } catch (err) {
      message.error(`${t('card.net')}: ${(err as Error).message}`)
    }
  }

  return (
    <div className="page">
      <PageHead
        num="card.num"
        titleA="card.title.a"
        titleEm="card.title.em"
        desc="card.desc"
      />

      <div className="flow" role="list">
        {(['card.step1', 'card.step2', 'card.step3'] as const).map((k, i) => (
          <span className="flow__i" role="listitem" key={k}>
            <b>{i + 1}</b>
            {t(k)}
            {i < 2 ? <i className="flow__sep" aria-hidden>→</i> : null}
          </span>
        ))}
      </div>

      {!canDistribute && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          message={t('card.anon.off.title')}
          description={
            policy?.adminEnabled ? t('card.anon.off.body') : t('card.anon.off.noadmin')
          }
        />
      )}

      {canDistribute && result && (
        <Alert
          type={result.ok ? 'success' : 'error'}
          showIcon
          icon={result.ok ? <CheckCircleFilled /> : undefined}
          style={{ marginBottom: 24 }}
          message={
            result.ok
              ? result.code
                ? t('card.code.ok.title')
                : t('card.ok.title')
              : t('card.fail')
          }
          description={
            result.ok ? (
              <div>
                {result.code ? (
                  <>
                    <p>{t('card.code.ok.body')}</p>
                    <Space wrap size={12} style={{ marginBottom: 6 }}>
                      <Text
                        style={{
                          fontSize: 22,
                          letterSpacing: 3,
                          fontFamily: 'var(--ff-mono)',
                          padding: '8px 16px',
                          background: 'rgba(255,210,63,.10)',
                          border: '1px dashed rgba(255,210,63,.45)',
                          borderRadius: 10,
                          wordBreak: 'break-all',
                        }}
                      >
                        {result.code}
                      </Text>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={async () => {
                          const ok = await copyText(result.code!)
                          message[ok ? 'success' : 'warning'](
                            ok ? t('card.code.copied') : result.code!,
                          )
                        }}
                      >
                        {t('card.code.copy')}
                      </Button>
                    </Space>
                  </>
                ) : (
                  <p>{t('card.ok.body')}</p>
                )}
                {result.meta && <MetaList meta={result.meta} />}
              </div>
            ) : (
              <Text code style={{ wordBreak: 'break-all' }}>{result.text}</Text>
            )
          }
        />
      )}

      {canDistribute && status.checked && (
        <Alert
          type={status.meta ? 'info' : 'warning'}
          showIcon
          style={{ marginBottom: 24 }}
          message={
            status.meta
              ? status.meta.mode === 'code'
                ? t('card.code.status.exists')
                : t('card.status.exists')
              : status.error || t('card.code.status.none')
          }
          description={status.meta ? <MetaList meta={status.meta} /> : undefined}
        />
      )}

      {canDistribute && (
      <div className="card" style={{ padding: 28 }}>
        <Segmented<DeliveryMode>
          block
          value={mode}
          onChange={switchMode}
          style={{ marginBottom: 20 }}
          options={[
            { value: 'code', label: t('card.mode.code') },
            { value: 'key', label: t('card.mode.key') },
          ]}
        />

        <div className="facts">
          <span className="fact">
            <SafetyCertificateOutlined /> {t('card.chip.e2ee')}
          </span>
          {mode === 'code' ? (
            <>
              <span className="fact">{t('card.chip.ttl')}</span>
              <span className="fact">{t('card.chip.uses')}</span>
            </>
          ) : (
            <span className="fact">{t('card.chip.x25519')}</span>
          )}
        </div>

        <Form<CardFormValues> form={form} layout="vertical" requiredMark="optional">
          {mode === 'key' && (
            <Form.Item
              name="pubkey"
              label={t('card.f.pubkey')}
              extra={t('card.f.pubkey.extra')}
              rules={[
                { required: true, message: t('card.r.pubkey') },
                {
                  validator: (_, value: string) => {
                    if (!value) return Promise.resolve()
                    const raw = decodeTransferKey(value)
                    if (raw && raw.length === 32) return Promise.resolve()
                    return Promise.reject(new Error(t('card.i.pubkey')))
                  },
                },
              ]}
            >
              <TextArea
                rows={2}
                spellCheck={false}
                placeholder={t('card.f.pubkey.ph')}
                style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, wordBreak: 'break-all' }}
              />
            </Form.Item>
          )}

          {mode === 'code' && (
            <>
              <div className="fg">
                <Form.Item
                  className="fg-6"
                  name="ttl"
                  label={t('card.f.ttl')}
                  extra={t('card.f.ttl.extra')}
                  initialValue={86400}
                >
                  <Select
                    size="large"
                    options={TTL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  />
                </Form.Item>

                <Form.Item
                  className="fg-6"
                  name="maxUses"
                  label={t('card.f.uses')}
                  extra={t('card.f.uses.extra')}
                  initialValue={1}
                >
                  <InputNumber min={1} max={100} size="large" style={{ width: '100%' }} />
                </Form.Item>
              </div>

              <Form.Item label={t('card.f.pickup')}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Segmented<CodeSource>
                    value={codeSource}
                    onChange={switchCodeSource}
                    options={[
                      { value: 'auto', label: t('card.code.auto') },
                      { value: 'custom', label: t('card.code.custom') },
                    ]}
                  />

                  {codeSource === 'auto' ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('card.code.auto.hint')}
                    </Text>
                  ) : (
                    <>
                      <Space wrap size={8}>
                        <Input
                          value={customCode}
                          onChange={(e) => setCustomCode(normalizePickupCode(e.target.value))}
                          placeholder={t('card.f.code.ph')}
                          maxLength={CODE_LENGTH + 4}
                          spellCheck={false}
                          style={{
                            width: 280,
                            fontFamily: 'var(--ff-mono)',
                            letterSpacing: 1,
                          }}
                          status={customCode && !customCodeState.valid ? 'warning' : undefined}
                        />
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => setCustomCode(generatePickupCode())}
                        >
                          {t('card.code.random')}
                        </Button>
                        <Button
                          icon={<CopyOutlined />}
                          disabled={!customCodeState.valid}
                          onClick={async () => {
                            const ok = await copyText(customCodeState.formatted)
                            message[ok ? 'success' : 'warning'](
                              ok ? t('card.code.copied') : customCodeState.formatted,
                            )
                          }}
                        >
                          {t('card.code.copy')}
                        </Button>
                      </Space>

                      {customCodeState.valid ? (
                        <Space size={8} wrap>
                          <Text
                            style={{
                              fontFamily: 'var(--ff-mono)',
                              fontSize: 18,
                              letterSpacing: 2,
                              padding: '4px 12px',
                              background: 'rgba(255,210,63,.10)',
                              border: '1px dashed rgba(255,210,63,.45)',
                              borderRadius: 8,
                            }}
                          >
                            {customCodeState.formatted}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('card.code.distinct')} {customCodeState.distinct} / {CODE_LENGTH}
                          </Text>
                        </Space>
                      ) : (
                        <Text type="warning" style={{ fontSize: 12 }}>
                          {t('card.r.code.weak')}
                        </Text>
                      )}
                    </>
                  )}
                </Space>
              </Form.Item>

              <Form.Item
                name="checkCode"
                label={t('card.btn.checkcode')}
                extra={t('card.f.code.extra')}
              >
                <Input
                  size="large"
                  spellCheck={false}
                  placeholder={t('card.f.code.ph')}
                  style={{ fontFamily: 'var(--ff-mono)' }}
                />
              </Form.Item>
            </>
          )}

          <div className="fg">
            <Form.Item
              className="fg-6"
              name="pfxkey"
              label={t('card.f.pfxkey')}
              extra={t('card.f.pfxkey.extra')}
              rules={[{ required: true, message: t('card.r.pfxkey') }]}
            >
              <Password
                size="large"
                autoComplete="new-password"
                placeholder={t('card.f.pfxkey.ph')}
              />
            </Form.Item>

            <Form.Item
              className="fg-6"
              name="label"
              label={t('card.f.label')}
              extra={t('card.f.label.extra')}
            >
              <Input size="large" maxLength={64} placeholder={t('card.f.label.ph')} />
            </Form.Item>
          </div>

          <Form.Item label={t('card.f.file')} required>
            <Upload.Dragger
              accept=".pfx,.p12,application/x-pkcs12"
              maxCount={1}
              fileList={fileList}
              beforeUpload={beforeUpload}
              onRemove={() => {
                setFile(null)
                setFileList([])
              }}
            >
              <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{t('card.f.file.ph')}</p>
              <p className="ant-upload-hint">{t('card.f.file.hint')}</p>
            </Upload.Dragger>
          </Form.Item>

          <Space wrap size={12}>
            <Button
              type="primary"
              size="large"
              icon={<CloudUploadOutlined />}
              loading={submitting}
              onClick={onUpload}
            >
              {t('card.btn.upload')}
            </Button>
            <Button
              size="large"
              icon={<SearchOutlined />}
              loading={checking}
              onClick={onCheck}
            >
              {t('card.btn.check')}
            </Button>
          </Space>
        </Form>
      </div>
      )}

      <Collapse
        style={{ marginTop: 24 }}
        items={[
          {
            key: 'admin',
            label: (
              <span>
                <KeyOutlined /> {t('card.admin.title')}{' '}
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  {t('card.admin.extra')}
                </Text>
              </span>
            ),
            children: authInfo.authenticated ? (
              <div>
                <Space wrap size={12} style={{ marginBottom: 16 }}>
                  <Tag color="green">{t('card.admin.loggedin')}</Tag>
                  {authInfo.expiresAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('card.admin.expires')} {fmtTime(authInfo.expiresAt)}
                    </Text>
                  )}
                  <Button
                    icon={<ReloadOutlined />}
                    loading={loadingList}
                    onClick={() => void loadList()}
                  >
                    {t('card.admin.refresh')}
                  </Button>
                  <Button onClick={onLogout}>{t('card.admin.logout')}</Button>
                </Space>

                {listError && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={listError}
                  />
                )}

                <Table<CardMeta>
                  rowKey="fingerprint"
                  size="small"
                  dataSource={rows}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: t('card.admin.empty') }}
                  columns={[
                    {
                      title: t('card.col.fingerprint'),
                      dataIndex: 'fingerprint',
                      render: (v: string) => (
                        <Text code style={{ fontSize: 12 }}>
                          {v ? `${v.slice(0, 16)}…` : '-'}
                        </Text>
                      ),
                    },
                    {
                      title: t('card.col.mode'),
                      dataIndex: 'mode',
                      render: (v?: DeliveryMode) => (
                        <Tag color={v === 'code' ? 'gold' : 'blue'}>
                          {v === 'code' ? t('card.mode.code.short') : t('card.mode.key.short')}
                        </Tag>
                      ),
                    },
                    {
                      title: t('card.col.label'),
                      dataIndex: 'label',
                      render: (v?: string) => v || '-',
                    },
                    {
                      title: t('card.col.size'),
                      dataIndex: 'size',
                      render: (v: number) => fmtBytes(v),
                    },
                    {
                      title: t('card.col.remaining'),
                      dataIndex: 'remaining',
                      render: (v: number | undefined, record) =>
                        v === undefined || record.maxUses === undefined
                          ? '-'
                          : `${v} / ${record.maxUses}`,
                    },
                    {
                      title: t('card.col.expires'),
                      dataIndex: 'expiresAt',
                      render: (v?: string) =>
                        v ? fmtTime(v) : t('card.meta.never'),
                    },
                    {
                      title: t('card.col.created'),
                      dataIndex: 'createdAt',
                      render: (v: string) => fmtTime(v),
                    },
                    {
                      title: t('card.col.action'),
                      key: 'action',
                      render: (_, record) => (
                        <Popconfirm
                          title={t('card.admin.confirm')}
                          okText={t('card.admin.delete')}
                          onConfirm={() => removeRow(record.fingerprint)}
                        >
                          <Button danger type="link" size="small">
                            {t('card.admin.delete')}
                          </Button>
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </div>
            ) : (
              <div>
                <Space wrap size={12} style={{ marginBottom: 16 }}>
                  <Password
                    placeholder={t('card.admin.pass.ph')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onPressEnter={() => void onLogin()}
                    style={{ width: 320 }}
                    autoComplete="new-password"
                  />
                  <Button
                    type="primary"
                    icon={<KeyOutlined />}
                    loading={loggingIn}
                    onClick={() => void onLogin()}
                  >
                    {t('card.admin.login')}
                  </Button>
                </Space>

                {policy && !policy.adminEnabled && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={t('card.admin.disabled')}
                  />
                )}
                {policy && policy.adminEnabled && !policy.passwordLogin && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={t('card.admin.nopassword')}
                  />
                )}
                {listError && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={listError}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <p className="pfoot">
        <Link href={CARD_WEB_PAGE} target="_blank" rel="noreferrer">
          {t('card.ssr')}
        </Link>
      </p>

      <PageHelp page="card" />
    </div>
  )
}

export default CardCertPage
