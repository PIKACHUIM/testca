import React from 'react'
import {
  DownloadOutlined,
  SafetyCertificateFilled,
  FilePdfOutlined,
  FileZipOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { ROOT_CA, SUB_CAS, withBase, type CaItem } from '../data/constants'

const Chip: React.FC<{
  href: string
  children: React.ReactNode
  icon?: React.ReactNode
  accent?: boolean
  ghost?: boolean
  download?: boolean
}> = ({ href, children, icon, accent, ghost, download }) => (
  <a
    className={`dl-chip${accent ? ' dl-chip--accent' : ''}${ghost ? ' dl-chip--ghost' : ''}`}
    href={href}
    download={download}
    target={download ? undefined : '_blank'}
    rel="noreferrer"
  >
    {icon}
    {children}
  </a>
)

const CaCard: React.FC<{ item: CaItem }> = ({ item }) => {
  const isRoot = item.tone === 'root'
  return (
    <article className={`ca-card fade-up${isRoot ? ' is-root' : ''}`} data-d="1">
      <span className="ca-card__badge">{isRoot ? 'ROOT · RSA-4096' : 'INTERMEDIATE'}</span>

      <div>
        <SafetyCertificateFilled
          style={{
            fontSize: 28,
            color: isRoot ? 'var(--pika-yellow)' : 'var(--neon-cyan)',
            marginBottom: 12,
          }}
        />
        <h3 className="ca-card__name">
          {item.cn}
          <span className="en">{item.cnEn}</span>
        </h3>
      </div>

      <p className="ca-card__desc">{item.description}</p>

      <div className="ca-card__meta">
        {item.crlRange && <span>CRL · {item.crlRange}</span>}
        <span>ID · {item.id.toUpperCase()}</span>
      </div>

      <div className="ca-card__downloads">
        {item.formats.map((f) => (
          <Chip
            key={f}
            href={withBase(`${item.dir}/${item.id}.${f}`)}
            icon={<DownloadOutlined />}
            download
            accent={f === 'cer'}
          >
            .{f}
          </Chip>
        ))}
        {item.crlFile && (
          <Chip href={withBase(item.crlFile)} icon={<LinkOutlined />} ghost>
            CRL
          </Chip>
        )}
        {item.ocsp && (
          <Chip href={item.ocsp} icon={<LinkOutlined />} ghost>
            OCSP
          </Chip>
        )}
      </div>
    </article>
  )
}

const CaSection: React.FC = () => {
  return (
    <>
      <section className="section" id="rootca">
        <div className="container">
          <span className="section__label">01 · Root CA</span>
          <h2 className="section__title">根证书 / Root Certificate Authority</h2>
          <p className="section__subtitle">
            请首先将根证书安装到受信任的根证书颁发机构存储区，随后即可信任由各中间 CA 签发的测试证书链。
            Install the root CA into your trusted root store to validate all subordinate certificates.
          </p>

          <div className="ca-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <CaCard item={ROOT_CA} />

            <article className="ca-card fade-up is-root" data-d="2">
              <span className="ca-card__badge">POLICY · CPS</span>
              <div>
                <FilePdfOutlined
                  style={{ fontSize: 28, color: 'var(--pika-yellow)', marginBottom: 12 }}
                />
                <h3 className="ca-card__name">
                  证书策略声明（CPS）
                  <span className="en">Certification Practice Statement</span>
                </h3>
              </div>
              <p className="ca-card__desc">
                描述证书颁发、验证、吊销策略与适用范围。使用本服务前请仔细阅读。
              </p>
              <div className="ca-card__meta">
                <span>PDF · HTML · MD</span>
              </div>
              <div className="ca-card__downloads">
                <Chip href={withBase('CPS-CN.pdf')} icon={<FilePdfOutlined />} accent>
                  中文 PDF
                </Chip>
                <Chip href={withBase('CPS-EN.pdf')} icon={<FilePdfOutlined />}>
                  English PDF
                </Chip>
                <Chip href={withBase('CPS-CN.html')} ghost icon={<LinkOutlined />}>
                  中文 HTML
                </Chip>
                <Chip href={withBase('CPS-EN.html')} ghost icon={<LinkOutlined />}>
                  EN HTML
                </Chip>
                <Chip href={withBase('Setupca.zip')} icon={<FileZipOutlined />}>
                  Setup.zip
                </Chip>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="subca">
        <div className="container">
          <span className="section__label">02 · Intermediate CAs</span>
          <h2 className="section__title">中间证书 · Sub CA 清单</h2>
          <p className="section__subtitle">
            面向不同业务场景的中间子 CA，每个类别下可申请对应类型的终端证书。
            Choose a Sub CA based on your signing / encryption scenario.
          </p>

          <div className="ca-grid">
            {SUB_CAS.map((c) => (
              <CaCard key={c.id} item={c} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default CaSection
