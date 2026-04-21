import React, { useEffect, useRef, useState } from 'react'
import { Form, Input, Select, Button, App as AntdApp, Tag, Alert } from 'antd'
import {
  MailOutlined,
  GlobalOutlined,
  BankOutlined,
  CompassOutlined,
  TagOutlined,
  RocketFilled,
  InfoCircleOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  LockFilled,
  ReadOutlined,
  WarningFilled,
} from '@ant-design/icons'
import PageHead from '../components/PageHead'
import {
  CERT_PRODUCTS,
  VALID_RANGES,
  ISSUER_ENDPOINT,
  CAPTCHA_APP_ID,
  CAPTCHA_API_SERVER,
} from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'

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

const fieldsByStep: Record<number, (keyof FormValues)[]> = {
  0: ['ca_name', 'va_time'],
  1: ['in_mail', 'in_code', 'in_main', 'in_subs', 'in_orgs', 'in_part', 'in_data', 'in_coms'],
  2: [],
}

const ApplyPage: React.FC = () => {
  const { t } = useI18n()
  const [form] = Form.useForm<FormValues>()
  const caName = Form.useWatch('ca_name', form)
  const curProduct = CERT_PRODUCTS.find((p) => p.value === caName)
  const { message, modal } = AntdApp.useApp()
  const captchaRef = useRef<HTMLDivElement | null>(null)
  const captchaInstance = useRef<ReturnType<NonNullable<Window['_dx']>['Captcha']> | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)

  const STEPS: MessageKey[] = ['apply.step1', 'apply.step2', 'apply.step3']

  useEffect(() => {
    if (step !== 2) return
    let tries = 0
    const tick = () => {
      if (!captchaRef.current || captchaInstance.current) return
      if (window._dx?.Captcha) {
        captchaInstance.current = window._dx.Captcha(captchaRef.current, {
          appId: CAPTCHA_APP_ID,
          apiServer: CAPTCHA_API_SERVER,
          success: (token: string) => {
            setCaptchaToken(token)
            message.success(t('apply.captcha.pass'))
          },
        })
      } else if (tries < 20) {
        tries += 1
        setTimeout(tick, 300)
      }
    }
    tick()
  }, [step, message, t])

  useEffect(() => () => captchaInstance.current?.destroy?.(), [])

  const next = async () => {
    try {
      if (fieldsByStep[step]?.length) {
        await form.validateFields(fieldsByStep[step])
      }
      const nxt = Math.min(step + 1, STEPS.length - 1)
      setStep(nxt)
      setMaxStep((m) => Math.max(m, nxt))
    } catch (err) {
      console.warn(err)
    }
  }

  const prev = () => setStep((s) => Math.max(0, s - 1))
  const goto = (i: number) => { if (i <= maxStep) setStep(i) }

  const onSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!VALID_RANGES.some((r) => r.value === values.va_time)) {
        message.warning(t('apply.r.valid'))
        setStep(0)
        return
      }
      if (!captchaToken) {
        message.warning(t('apply.captcha.req'))
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
      window.open(`${ISSUER_ENDPOINT}?${params.toString()}`, '_blank', 'noopener,noreferrer')

      modal.success({
        title: t('apply.ok.title'),
        content: (
          <div>
            <p>{t('apply.ok.body')}</p>
            <Alert type="warning" showIcon icon={<InfoCircleOutlined />} message={t('apply.ok.warn')} />
          </div>
        ),
        okText: t('apply.ok.btn'),
      })

      setCaptchaToken('')
      captchaInstance.current?.reload?.()
    } catch (err) {
      console.warn(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <PageHead
        num={t('apply.num')}
        title={
          <>
            {t('apply.title.a')}<em>{t('apply.title.em')}</em>
          </>
        }
        desc={t('apply.desc')}
      />

      <div className="wiz">
        <div className="wiz__steps">
          {STEPS.map((key, i) => (
            <button
              key={key}
              type="button"
              className={`wiz__step${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
              onClick={() => goto(i)}
              disabled={i > maxStep}
            >
              <span className="num">
                {i < step ? <CheckCircleFilled style={{ fontSize: 13 }} /> : i + 1}
              </span>
              <span>
                <div className="cap">STEP · 0{i + 1}</div>
                <div className="label">{t(key)}</div>
              </span>
            </button>
          ))}
        </div>

        <div className="wiz__body">
          <Form<FormValues>
            form={form}
            layout="vertical"
            initialValues={{ ca_name: 'time', va_time: '2', in_code: 'CN' }}
            requiredMark="optional"
          >
            {/* Step 0 */}
            <div style={{ display: step === 0 ? 'block' : 'none' }}>
              <div className="fg">
                <Form.Item
                  className="fg-6"
                  name="ca_name"
                  label={t('apply.f.ca')}
                  rules={[{ required: true, message: t('apply.r.ca') }]}
                >
                  <Select
                    size="large"
                    options={CERT_PRODUCTS.map((p) => ({
                      value: p.value,
                      label: (
                        <span>
                          <strong>{p.label}</strong>
                          <Tag
                            bordered={false}
                            style={{
                              marginLeft: 8,
                              background: 'color-mix(in srgb, var(--pika) 14%, transparent)',
                              color: 'var(--pika)',
                              fontSize: 10.5,
                            }}
                          >
                            {t(p.hintKey)}
                          </Tag>
                        </span>
                      ),
                    }))}
                  />
                </Form.Item>

                <Form.Item
                  className="fg-6"
                  name="va_time"
                  label={t('apply.f.valid')}
                  rules={[{ required: true, message: t('apply.r.valid') }]}
                >
                  <Select size="large" options={VALID_RANGES} />
                </Form.Item>
              </div>

              <div
                className="card"
                style={{
                  marginTop: 18,
                  borderLeft: '3px solid var(--pika)',
                  background: 'color-mix(in srgb, var(--pika) 6%, var(--panel-2))',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontFamily: 'var(--ff-mono)',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--pika)',
                  }}
                >
                  <ReadOutlined />
                  <span>{t('apply.intro.title')}</span>
                  {curProduct && (
                    <Tag
                      bordered={false}
                      style={{
                        marginLeft: 'auto',
                        background: 'color-mix(in srgb, var(--pika) 14%, transparent)',
                        color: 'var(--pika)',
                        fontSize: 10.5,
                      }}
                    >
                      {t(curProduct.hintKey)}
                    </Tag>
                  )}
                </div>
                <h3
                  style={{
                    margin: '10px 0 6px',
                    fontFamily: 'var(--ff-display)',
                    fontSize: 17,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  {curProduct ? curProduct.label : t('apply.intro.title')}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--ink-2)',
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  {curProduct ? t(curProduct.useKey) : t('apply.intro.empty')}
                </p>
              </div>

              <div className="notice notice--danger" style={{ marginTop: 18 }}>
                <div className="notice__icon" aria-hidden><WarningFilled /></div>
                <div>
                  <h3 className="notice__title">{t('apply.notice.title')}</h3>
                  <p className="notice__body">{t('apply.notice.body')}</p>
                </div>
              </div>
            </div>

            {/* Step 1 */}
            <div style={{ display: step === 1 ? 'block' : 'none' }}>
              <div className="fg">
                <Form.Item
                  className="fg-6"
                  name="in_mail"
                  label={t('apply.f.email')}
                  rules={[
                    { required: true, message: t('apply.r.email') },
                    { type: 'email', message: t('apply.i.email') },
                  ]}
                >
                  <Input size="large" prefix={<MailOutlined />} placeholder="you@example.com" />
                </Form.Item>

                <Form.Item
                  className="fg-3"
                  name="in_code"
                  label={t('apply.f.country')}
                  rules={[
                    { required: true, message: t('apply.r.country') },
                    { pattern: /^[A-Za-z]{2}$/, message: t('apply.i.country') },
                  ]}
                  normalize={(v) => (v ? String(v).toUpperCase() : v)}
                >
                  <Input size="large" prefix={<GlobalOutlined />} maxLength={2} placeholder="CN" />
                </Form.Item>

                <Form.Item
                  className="fg-3"
                  name="in_main"
                  label={t('apply.f.state')}
                  rules={[{ required: true, message: t('apply.r.state') }]}
                >
                  <Input size="large" prefix={<CompassOutlined />} placeholder="Guangdong" />
                </Form.Item>

                <Form.Item
                  className="fg-4"
                  name="in_subs"
                  label={t('apply.f.city')}
                  rules={[{ required: true, message: t('apply.r.city') }]}
                >
                  <Input size="large" prefix={<CompassOutlined />} placeholder="Shenzhen" />
                </Form.Item>

                <Form.Item
                  className="fg-4"
                  name="in_orgs"
                  label={t('apply.f.org')}
                  rules={[{ required: true, message: t('apply.r.org') }]}
                >
                  <Input size="large" prefix={<BankOutlined />} placeholder="Pikachu Labs" />
                </Form.Item>

                <Form.Item
                  className="fg-4"
                  name="in_part"
                  label={t('apply.f.ou')}
                  rules={[{ required: true, message: t('apply.r.ou') }]}
                >
                  <Input size="large" prefix={<BankOutlined />} placeholder="R&D" />
                </Form.Item>

                <Form.Item
                  className="fg-6"
                  name="in_data"
                  label={t('apply.f.desc')}
                  tooltip={t('apply.f.desc.tip')}
                >
                  <Input size="large" prefix={<TagOutlined />} placeholder="Test cert for …" />
                </Form.Item>

                <Form.Item className="fg-6" name="in_coms" label={t('apply.f.san')}>
                  <Input size="large" prefix={<GlobalOutlined />} placeholder="*.example.com" />
                </Form.Item>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: step === 2 ? 'block' : 'none' }}>
              <div className="grid grid--2" style={{ marginBottom: 20 }}>
                <Sum label={t('apply.sum.ca')} value={productLabel(form.getFieldValue('ca_name'))} />
                <Sum label={t('apply.sum.valid')} value={rangeLabel(form.getFieldValue('va_time'))} />
                <Sum label={t('apply.sum.email')} value={form.getFieldValue('in_mail') || '—'} />
                <Sum
                  label={t('apply.sum.subject')}
                  value={
                    [
                      form.getFieldValue('in_code'),
                      form.getFieldValue('in_main'),
                      form.getFieldValue('in_subs'),
                      form.getFieldValue('in_orgs'),
                      form.getFieldValue('in_part'),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  }
                />
              </div>

              <div
                style={{
                  padding: 18,
                  border: '1px dashed var(--line-2)',
                  borderRadius: 10,
                  background: 'var(--panel-2)',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div ref={captchaRef} id="pika-captcha" />
              </div>

              <Alert
                style={{ marginTop: 18 }}
                type="warning"
                showIcon
                icon={<LockFilled />}
                message={t('apply.privacy.title')}
                description={t('apply.privacy.body')}
              />
            </div>
          </Form>
        </div>

        <div className="wiz__foot">
          <Button size="large" icon={<ArrowLeftOutlined />} onClick={prev} disabled={step === 0}>
            {t('apply.prev')}
          </Button>
          <div className="wiz__progress">{step + 1} / {STEPS.length}</div>
          {step < STEPS.length - 1 ? (
            <Button type="primary" size="large" onClick={next}>
              {t('apply.next')} <ArrowRightOutlined />
            </Button>
          ) : (
            <Button
              type="primary"
              size="large"
              icon={<RocketFilled />}
              loading={submitting}
              onClick={onSubmit}
            >
              {t('apply.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

const Sum: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="sum">
    <div className="sum__k">{label}</div>
    <div className="sum__v">{value}</div>
  </div>
)

const productLabel = (v: string) => CERT_PRODUCTS.find((p) => p.value === v)?.label ?? v
const rangeLabel = (v: string) => VALID_RANGES.find((r) => r.value === v)?.label ?? v

export default ApplyPage
