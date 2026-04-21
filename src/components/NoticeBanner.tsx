import React from 'react'
import { WarningFilled, AlertFilled } from '@ant-design/icons'

const NoticeBanner: React.FC = () => {
  return (
    <section className="section" style={{ paddingBlock: '24px' }}>
      <div className="container">
        <div className="notice fade-up" data-d="1">
          <div className="notice__icon" aria-hidden>
            <WarningFilled />
          </div>
          <div>
            <h3 className="notice__title">仅用于测试 · For Testing Purposes Only</h3>
            <p className="notice__body">
              此 CA 机构签出的时间戳和证书<strong style={{ color: '#ffe884' }}>不会校验真实性</strong>，任何人均可随意生成任意时间戳与未经验证的证书。
              <br />
              The timestamps and certificates issued by this CA will <strong>NOT</strong> be verified.
              Anyone can generate timestamps and unverified certificates freely.
            </p>
          </div>
        </div>
        <div className="notice fade-up" data-d="2">
          <div
            className="notice__icon"
            aria-hidden
            style={{
              color: '#ffd83d',
              background: 'rgba(255,216,61,0.12)',
              borderColor: 'rgba(255,216,61,0.3)',
            }}
          >
            <AlertFilled />
          </div>
          <div>
            <h3 className="notice__title" style={{ color: '#ffd83d' }}>
              不可用于生产环境 · Do Not Use in Production
            </h3>
            <p className="notice__body">
              签发的证书仅供测试、研究与学习使用，不应在生产系统、正式签名或重要场合中使用。
              <br />
              Issued certificates are for testing & research only. They must not be used in
              production systems or for formal signing purposes.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default NoticeBanner
