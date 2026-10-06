import React, { useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Collapse,
  Descriptions,
  Form,
  Input,
  Popconfirm,
  Space,
  Steps,
  Table,
  Typography,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import {
  CheckCircleFilled,
  CloudUploadOutlined,
  InboxOutlined,
  KeyOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import {
  CARD_ADMIN_DELETE_ENDPOINT,
  CARD_ADMIN_LIST_ENDPOINT,
  CARD_PUT_ENDPOINT,
  CARD_STATUS_ENDPOINT,
  CARD_WEB_PAGE,
} from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'

const { Text, Link } = Typography
const { TextArea, Password } = Input

/** 与服务端 CARD_MAX_BYTES 默认值保持一致 */
const MAX_PFX_BYTES = 8 * 1024 * 1024

interface CardFormValues {
  pubkey: string
  pfxkey: string
  label?: string
}

/** 分发记录的元信息（不含任何密文 / 口令） */
interface CardMeta {
  fingerprint: string
  createdAt: string
  size: number
  sha256: string
  label?: string
}

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
      <Descriptions.Item label={t('card.meta.fingerprint')}>
        <Text code copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
          {meta.fingerprint}
        </Text>
      </Descriptions.Item>
      <Descriptions.Item label={t('card.meta.size')}>{fmtBytes(meta.size)}</Descriptions.Item>
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

  const [file, setFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{
    ok: boolean
    text?: string
    meta?: CardMeta
  } | null>(null)
  const [status, setStatus] = useState<{ checked: boolean; meta: CardMeta | null }>({
    checked: false,
    meta: null,
  })

  const [token, setToken] = useState('')
  const [rows, setRows] = useState<CardMeta[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState('')

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

  // ---- 上传 -------------------------------------------------------------
  const onUpload = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    if (!file) {
      message.error(t('card.r.file'))
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('pubkey', values.pubkey.trim())
      fd.append('pfxkey', values.pfxkey ?? '')
      fd.append('vaults', file, file.name)
      const label = (values.label || '').trim()
      if (label) fd.append('label', label)

      const resp = await fetch(CARD_PUT_ENDPOINT, { method: 'POST', body: fd })
      const data = (await resp.json().catch(() => ({}))) as {
        flag?: boolean
        text?: string
        meta?: CardMeta
      }
      if (resp.ok && data.flag) {
        setResult({ ok: true, meta: data.meta })
        message.success(t('card.ok.title'))
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
    const values = await form.validateFields(['pubkey']).catch(() => null)
    if (!values?.pubkey) return
    setChecking(true)
    try {
      const body = new URLSearchParams()
      body.append('pubkey', values.pubkey.trim())
      const resp = await fetch(CARD_STATUS_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
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

  // ---- 缓存管理（需服务端配置 CARD_ADMIN_TOKEN）-------------------------
  const loadList = async () => {
    if (!token.trim()) {
      setListError(t('card.admin.token'))
      return
    }
    setLoadingList(true)
    setListError('')
    try {
      const resp = await fetch(
        `${CARD_ADMIN_LIST_ENDPOINT}?token=${encodeURIComponent(token.trim())}`,
      )
      const data = (await resp.json().catch(() => ({}))) as {
        flag?: boolean
        text?: string
        data?: { items?: CardMeta[] }
      }
      if (!resp.ok || !data.flag) {
        setListError(data.text || `HTTP ${resp.status}`)
        setRows([])
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
          'x-admin-token': token.trim(),
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
        num={t('card.num')}
        title={
          <>
            {t('card.title.a')}<em>{t('card.title.em')}</em>
          </>
        }
        desc={t('card.desc')}
      />

      <Steps
        size="small"
        labelPlacement="vertical"
        current={-1}
        style={{ marginBottom: 24 }}
        items={[
          { title: t('card.step1') },
          { title: t('card.step2') },
          { title: t('card.step3') },
        ]}
      />

      <div className="notice notice--info" style={{ marginBottom: 24 }}>
        <div className="notice__icon" aria-hidden><SafetyCertificateOutlined /></div>
        <div>
          <h3 className="notice__title">{t('card.notice.title')}</h3>
          <p className="notice__body">{t('card.notice.body')}</p>
          <p className="notice__body" style={{ marginTop: 6 }}>
            {t('card.notice.tool')}{' '}
            <Link href={CARD_WEB_PAGE} target="_blank" rel="noreferrer">
              {CARD_WEB_PAGE}
            </Link>
          </p>
        </div>
      </div>

      {result && (
        <Alert
          type={result.ok ? 'success' : 'error'}
          showIcon
          icon={result.ok ? <CheckCircleFilled /> : undefined}
          style={{ marginBottom: 24 }}
          message={result.ok ? t('card.ok.title') : t('card.fail')}
          description={
            result.ok ? (
              <div>
                <p>{t('card.ok.body')}</p>
                {result.meta && <MetaList meta={result.meta} />}
              </div>
            ) : (
              <Text code style={{ wordBreak: 'break-all' }}>{result.text}</Text>
            )
          }
        />
      )}

      {status.checked && (
        <Alert
          type={status.meta ? 'info' : 'warning'}
          showIcon
          style={{ marginBottom: 24 }}
          message={status.meta ? t('card.status.exists') : t('card.status.none')}
          description={status.meta ? <MetaList meta={status.meta} /> : undefined}
        />
      )}

      <div className="card" style={{ padding: 28 }}>
        <Form<CardFormValues> form={form} layout="vertical" requiredMark="optional">
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
            children: (
              <div>
                <Space wrap size={12} style={{ marginBottom: 16 }}>
                  <Password
                    placeholder={t('card.admin.token.ph')}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    style={{ width: 320 }}
                    autoComplete="new-password"
                  />
                  <Button icon={<ReloadOutlined />} loading={loadingList} onClick={loadList}>
                    {t('card.admin.refresh')}
                  </Button>
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
            ),
          },
        ]}
      />
    </div>
  )
}

export default CardCertPage
