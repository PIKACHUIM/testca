import React, { useEffect, useRef, useState } from 'react'
import { Form, Input, Select, Button, App as AntdApp, Tag, Alert, Divider } from 'antd'
import {
  MailOutlined,
  GlobalOutlined,
  BankOutlined,
  CompassOutlined,
  TagOutlined,
  SafetyOutlined,
  RocketFilled,
  InfoCircleOutlined,
} from '@ant-design/icons'
import {
  CERT_PRODUCTS,
  VALID_RANGES,
  ISSUER_ENDPOINT,
  CAPTCHA_APP_ID,
  CAPTCHA_API_SERVER,
} from '../data/constants'

interface FormValues {
  ca_name: string
  va_time: string
  in_mail: string
  in_code: string
  in_main: string
  in_subs: string
  in_orgs: string
  in_part: string
  in_data?: string
  in_coms?: string
}

const ApplyForm: React.FC = () => {
  const [form] = Form.useForm<FormValues>()
  const { message, modal } = AntdApp.useApp()
  const captchaRef = useRef<HTMLDivElement | null>(null)
  const captchaInstance = useRef<ReturnType<NonNullable<Window['_dx']>['Captcha']> | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // 初始化滴像验证码
  useEffect(() => {
    let tries = 0
    const tick = () => {
      if (!captchaRef.current) return
      if (window._dx && window._dx.Captcha) {
        captchaInstance.current = window._dx.Captcha(captchaRef.current, {
          appId: CAPTCHA_APP_ID,
          apiServer: CAPTCHA_API_SERVER,
          success: (token: string) => {
            setCaptchaToken(token)
            message.success('人机验证通过 · Verified')
          },
        })
      } else if (tries < 20) {
        tries += 1
        setTimeout(tick, 300)
      }
    }
    tick()
    return () => {
      captchaInstance.current?.destroy?.()
    }
  }, [message])

  const onSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!captchaToken) {
        message.warning('请先完成人机验证 · Please complete captcha first')
        // 尝试重绘验证码
        captchaInstance.current?.reload?.()
        return
      }
      setSubmitting(true)

      const params = new URLSearchParams({
        ca_name: values.ca_name,
        va_time: values.va_time,
        in_data: values.in_data ?? '',
        in_code: values.in_code.toUpperCase(),
        in_main: values.in_main,
        in_subs: values.in_subs,
        in_orgs: values.in_orgs,
        in_part: values.in_part,
        in_mail: values.in_mail,
        in_coms: values.in_coms ?? '',
        captcha: captchaToken,
      })
      const url = `${ISSUER_ENDPOINT}?${params.toString()}`

      // 保持原逻辑：新标签页打开请求，服务端返回证书供下载
      window.open(url, '_blank', 'noopener,noreferrer')

      modal.success({
        title: '证书请求已提交',
        content: (
          <div>
            <p>
              您的证书请求已提交到服务器，请检查新打开的网页并下载您的证书与私钥。
            </p>
            <Alert
              type="warning"
              showIcon
              icon={<InfoCircleOutlined />}
              message="重要提示"
              description={
                <>
                  服务器 <strong>不会保留</strong> 您的私钥，也 <strong>无法吊销</strong>{' '}
                  已签发证书。请务必妥善保管您的私钥文件。
                </>
              }
            />
          </div>
        ),
        okText: '我已知晓',
      })

      setCaptchaToken('')
      captchaInstance.current?.reload?.()
    } catch (err) {
      // validateFields 报错会自动显示
      console.warn(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="section" id="apply">
      <div className="container">
        <span className="section__label">03 · Issue Certificate</span>
        <h2 className="section__title">
          申请测试证书 <span style={{ color: 'var(--pika-yellow)' }}>/</span> Apply a Certificate
        </h2>
        <p className="section__subtitle">
          填写以下字段并完成人机验证，服务器将实时签发一份符合 X.509 规范的测试证书。
          Fill in the fields below and complete the captcha; a freshly issued X.509 cert will be
          delivered via a new tab.
        </p>

        <div className="form-wrapper fade-up" data-d="1">
          <Form<FormValues>
            form={form}
            layout="vertical"
            initialValues={{ ca_name: 'time', va_time: '2', in_code: 'CN' }}
            requiredMark="optional"
          >
            <div className="form-grid">
              <Form.Item
                className="fg-6"
                name="ca_name"
                label="CA 颁发机构 / Certificate Authority"
                rules={[{ required: true, message: '请选择颁发机构' }]}
              >
                <Select
                  size="large"
                  suffixIcon={<SafetyOutlined />}
                  options={CERT_PRODUCTS.map((p) => ({
                    value: p.value,
                    label: (
                      <span>
                        <strong>{p.label}</strong>
                        <Tag
                          bordered={false}
                          style={{
                            marginLeft: 8,
                            background: 'rgba(255,216,61,0.12)',
                            color: '#ffd83d',
                            fontSize: 11,
                          }}
                        >
                          {p.hint}
                        </Tag>
                      </span>
                    ),
                  }))}
                />
              </Form.Item>

              <Form.Item
                className="fg-6"
                name="va_time"
                label="有效时间 / Valid Range"
                rules={[{ required: true, message: '请选择有效时间' }]}
              >
                <Select size="large" options={VALID_RANGES} />
              </Form.Item>

              <Form.Item
                className="fg-6"
                name="in_mail"
                label="邮件地址 / Email"
                rules={[
                  { required: true, message: '请填写邮件地址' },
                  { type: 'email', message: '请填写有效的邮箱地址' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  placeholder="you@example.com"
                />
              </Form.Item>

              <Form.Item
                className="fg-3"
                name="in_code"
                label="国家 / Country (ISO-2)"
                rules={[
                  { required: true, message: '必填' },
                  { pattern: /^[A-Za-z]{2}$/, message: '必须为 2 位字母' },
                ]}
                normalize={(v) => (v ? String(v).toUpperCase() : v)}
              >
                <Input size="large" prefix={<GlobalOutlined />} maxLength={2} placeholder="CN" />
              </Form.Item>

              <Form.Item
                className="fg-3"
                name="in_main"
                label="省份 / State"
                rules={[{ required: true, message: '请填写省份' }]}
              >
                <Input size="large" prefix={<CompassOutlined />} placeholder="Guangdong" />
              </Form.Item>

              <Form.Item
                className="fg-4"
                name="in_subs"
                label="城市 / Location"
                rules={[{ required: true, message: '请填写城市' }]}
              >
                <Input size="large" prefix={<CompassOutlined />} placeholder="Shenzhen" />
              </Form.Item>

              <Form.Item
                className="fg-4"
                name="in_orgs"
                label="组织 / Organization"
                rules={[{ required: true, message: '请填写组织' }]}
              >
                <Input size="large" prefix={<BankOutlined />} placeholder="Pikachu Labs" />
              </Form.Item>

              <Form.Item
                className="fg-4"
                name="in_part"
                label="组织单元 / Organizational Unit"
                rules={[{ required: true, message: '请填写部门' }]}
              >
                <Input size="large" prefix={<BankOutlined />} placeholder="R&D" />
              </Form.Item>

              <Form.Item
                className="fg-6"
                name="in_data"
                label="描述信息 / Description（用于替代 Common Name）"
                tooltip="证书主体名称（CN）无法自定义，将使用此描述信息替代"
              >
                <Input size="large" prefix={<TagOutlined />} placeholder="Test Cert for …" />
              </Form.Item>

              <Form.Item
                className="fg-6"
                name="in_coms"
                label="可选域名列表 / SAN Domains（多个用英文逗号或分号分隔，支持通配符）"
              >
                <Input
                  size="large"
                  prefix={<GlobalOutlined />}
                  placeholder="*.example.com, api.example.com"
                />
              </Form.Item>
            </div>

            <Divider style={{ borderColor: 'var(--border)', margin: '28px 0 20px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--text-fade)',
                }}
              >
                Human Verification · 人机验证
              </span>
            </Divider>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 20,
                justifyContent: 'space-between',
              }}
            >
              <div ref={captchaRef} id="pika-captcha" />

              <Button
                type="primary"
                size="large"
                loading={submitting}
                icon={<RocketFilled />}
                onClick={onSubmit}
                style={{
                  height: 52,
                  paddingInline: 36,
                  borderRadius: 14,
                  fontSize: 15,
                  boxShadow: '0 10px 30px rgba(255,216,61,0.35)',
                }}
              >
                确认申请 · Submit Request
              </Button>
            </div>

            <Alert
              style={{ marginTop: 24 }}
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              message="隐私与安全提示 · Privacy Notice"
              description={
                <>
                  证书一旦创建即 <strong>无法吊销或撤回</strong>，私钥泄漏也没有办法禁用。
                  请妥善保管您的私钥文件。
                  <br />
                  Once issued, a certificate <strong>cannot</strong> be revoked. Please keep your
                  private key safe.
                </>
              }
            />
          </Form>
        </div>
      </div>
    </section>
  )
}

export default ApplyForm
