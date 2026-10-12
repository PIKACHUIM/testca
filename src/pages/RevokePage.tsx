import React, { useState } from 'react'
import { Form, Input, Select, Button, App as AntdApp, Alert, Upload, Typography } from 'antd'
import {
  StopOutlined,
  NumberOutlined,
  UploadOutlined,
  WarningFilled,
  CheckCircleFilled,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import PageHelp from '../components/PageHelp'
import Hint from '../components/Hint'
import { REVOKE_ENDPOINT } from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'

const { TextArea } = Input
const { Text } = Typography

interface RevokeFormValues {
  serial: string
  privateKeyPem: string
  reason: string
}

const REVOKE_REASONS = [
  { value: 'unspecified', labelZh: '未指定', labelEn: 'Unspecified' },
  { value: 'keyCompromise', labelZh: '密钥泄露', labelEn: 'Key Compromise' },
  { value: 'affiliationChanged', labelZh: '从属关系变更', labelEn: 'Affiliation Changed' },
  { value: 'superseded', labelZh: '证书被替代', labelEn: 'Superseded' },
  { value: 'cessationOfOperation', labelZh: '停止运营', labelEn: 'Cessation of Operation' },
]

const RevokePage: React.FC = () => {
  const { t, lang } = useI18n()
  const [form] = Form.useForm<RevokeFormValues>()
  const { message, modal } = AntdApp.useApp()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ serial: string; revokedAt: string; reason: string } | null>(null)

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        form.setFieldsValue({ privateKeyPem: text.trim() })
      }
    }
    reader.readAsText(file)
    return false // 阻止自动上传
  }

  const onSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      setResult(null)

      const resp = await fetch(REVOKE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial: values.serial.trim(),
          privateKeyPem: values.privateKeyPem.trim(),
          reason: values.reason || 'unspecified',
        }),
      })

      const data = await resp.json() as Record<string, unknown>

      if (data.done) {
        setResult({
          serial: data.serial as string,
          revokedAt: data.revokedAt as string,
          reason: data.reason as string,
        })
        modal.success({
          title: t('revoke.ok.title'),
          content: t('revoke.ok.body'),
          okText: t('revoke.ok.btn'),
        })
      } else {
        const errText = (data.text as string) || 'Unknown error'
        message.error(`${t('revoke.fail')}: ${errText}`)
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // 表单验证失败，不需要额外提示
      } else {
        message.error(t('revoke.fail'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <PageHead
        num="revoke.num"
        titleA="revoke.title.a"
        titleEm="revoke.title.em"
        desc="revoke.desc"
      />

      <div className="notice notice--danger" style={{ marginBottom: 24 }}>
        <div className="notice__icon" aria-hidden><WarningFilled /></div>
        <div>
          <h3 className="notice__title">
            {t('revoke.notice.title')}
            <Hint title="help.revoke.2.t" body="help.revoke.2.b" />
          </h3>
          <p className="notice__body">{t('revoke.notice.body')}</p>
        </div>
      </div>

      {result && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleFilled />}
          style={{ marginBottom: 24 }}
          message={t('revoke.result.title')}
          description={
            <div>
              <p><Text strong>{t('revoke.result.serial')}:</Text></p>
              <p><Text code style={{ fontSize: 13, wordBreak: 'break-all', display: 'inline-block', maxWidth: '100%' }}>{result.serial}</Text></p>
              <p><Text strong>{t('revoke.result.time')}:</Text> {result.revokedAt}</p>
              <p><Text strong>{t('revoke.result.reason')}:</Text> {result.reason}</p>
            </div>
          }
        />
      )}

      <div className="card" style={{ padding: 28 }}>
        <Form<RevokeFormValues>
          form={form}
          layout="vertical"
          initialValues={{ reason: 'unspecified' }}
          requiredMark="optional"
        >
          <div className="fg">
            <Form.Item
              className="fg-8"
              name="serial"
              label={t('revoke.f.serial')}
              rules={[
                { required: true, message: t('revoke.r.serial') },
                { pattern: /^[0-9a-fA-F]+$/, message: t('revoke.i.serial') },
              ]}
              normalize={(v) => v ? String(v).trim().toLowerCase() : v}
            >
              <Input
                size="large"
                prefix={<NumberOutlined />}
                placeholder="4b9e93ee68c3086aed5d8abac29e04dd"
                style={{ width: 400 }}
              />
            </Form.Item>

            <Form.Item
              className="fg-4"
              name="reason"
              label={t('revoke.f.reason')}
            >
              <Select
                size="large"
                options={REVOKE_REASONS.map((r) => ({
                  value: r.value,
                  label: lang === 'zh' ? r.labelZh : r.labelEn,
                }))}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="privateKeyPem"
            label={
              <span>
                {t('revoke.f.key')}{' '}
                <Upload
                  accept=".pem,.key,.txt"
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                >
                  <Button size="small" icon={<UploadOutlined />} type="link">
                    {t('revoke.f.upload')}
                  </Button>
                </Upload>
              </span>
            }
            extra={t('revoke.f.key.extra')}
            rules={[
              { required: true, message: t('revoke.r.key') },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve()
                  if (value.includes('-----BEGIN') && value.includes('PRIVATE KEY')) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error(t('revoke.i.key')))
                },
              },
            ]}
          >
            <TextArea
              rows={8}
              placeholder={`-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----`}
              style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }}
            />
          </Form.Item>

          <Button
            type="primary"
            danger
            size="large"
            icon={<StopOutlined />}
            loading={submitting}
            onClick={() => {
              form.validateFields().then(() => {
                modal.confirm({
                  title: t('revoke.confirm.title'),
                  content: t('revoke.confirm.body'),
                  okText: t('revoke.confirm.ok'),
                  cancelText: t('revoke.confirm.cancel'),
                  okButtonProps: { danger: true },
                  onOk: onSubmit,
                })
              }).catch(() => { /* 表单验证失败，不弹窗 */ })
            }}
            block
          >
            {t('revoke.submit')}
          </Button>
        </Form>
      </div>

      <PageHelp page="revoke" />
    </div>
  )
}

export default RevokePage
