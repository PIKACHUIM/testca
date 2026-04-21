import React from 'react'
import { Button, Space } from 'antd'
import { DownloadOutlined, ThunderboltFilled } from '@ant-design/icons'

const FINGERPRINT = [
  { h: '─── ROOT CA FINGERPRINT ───────────────────', c: 'cy' as const },
  { h: 'SHA256   9a:1f:cc:38:b0:7e:21:45:6c:8d:77:e0', c: 'hl' as const },
  { h: '         ba:2c:44:8f:19:d7:36:6e:4b:50:f1:ac', c: 'hl' as const },
  { h: '         e8:79:2d:55:0f:36:31:12', c: 'hl' as const },
  { h: 'SUBJECT  CN=Pikachu Public Test Root RSA', c: '' as const },
  { h: '         O =Pikachu Trust Network CA', c: '' as const },
  { h: '         OU=Pikachu Certification Authority', c: '' as const },
  { h: 'ISSUER   — self-signed', c: 'vi' as const },
  { h: 'VALID    2025-01-01  →  2050-01-01', c: 'cy' as const },
  { h: 'KEY      RSA-4096  ·  PKCS #1 v1.5', c: '' as const },
  { h: 'OCSP     https://test.ocsps.us.kg', c: 'vi' as const },
  { h: '─── END ───────────────────────────────────', c: 'cy' as const },
]

const Hero: React.FC = () => {
  return (
    <section className="section hero" id="top">
      <div className="container hero__grid">
        <div className="fade-up" data-d="1">
          <span className="hero__eyebrow">
            <span className="dot" aria-hidden />
            Test Only · Non-Production
          </span>

          <h1 className="hero__title">
            Pikachu
            <br />
            <span className="accent">Public Test</span>
            <br />
            Root CA · RSA
            <span className="muted">
              公共测试根证书 / 在线验证服务 / 支持时间戳 · 代码 · UEFI · mTLS 签名
            </span>
          </h1>

          <p className="hero__lede">
            本 CA 机构签发的时间戳与证书<strong style={{ color: '#ffd83d' }}>不会校验真实性与申请来源身份</strong>，
            任何人均可以随意生成任意时间戳与未经验证的证书，仅用于开发 / 研究 / 测试用途。
          </p>

          <div className="hero__cta">
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltFilled />}
              href="#apply"
              style={{ height: 48, paddingInline: 26, borderRadius: 12 }}
            >
              申请测试证书
            </Button>
            <Button
              size="large"
              icon={<DownloadOutlined />}
              href="#rootca"
              style={{ height: 48, paddingInline: 24, borderRadius: 12 }}
            >
              下载根证书
            </Button>
          </div>

          <Space size={28} style={{ marginTop: 36 }} wrap>
            <Stat label="Root CA" value="RSA-4096" />
            <Stat label="Valid" value="2025 → 2050" />
            <Stat label="Sub CAs" value="8" />
            <Stat label="OCSP" value="ONLINE" tone="ok" />
          </Space>
        </div>

        <div className="hero__card fade-up" data-d="2" aria-hidden>
          <div className="hero__fingerprint">
            {FINGERPRINT.map((l, i) => (
              <div key={i} className={l.c}>
                {l.h}
              </div>
            ))}
          </div>
          <div className="hero__meta">
            <span>TLS · CODE · TSA · UEFI · MTLS</span>
            <span className="ok">● VERIFIED</span>
          </div>
        </div>
      </div>
    </section>
  )
}

const Stat: React.FC<{ label: string; value: string; tone?: 'ok' }> = ({
  label,
  value,
  tone,
}) => (
  <div>
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--text-fade)',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        fontWeight: 600,
        marginTop: 2,
        color: tone === 'ok' ? 'var(--neon-lime)' : 'var(--text)',
        letterSpacing: '-0.01em',
      }}
    >
      {value}
    </div>
  </div>
)

export default Hero
