import React, { useMemo, useState } from 'react'
import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import PageHead from '../components/PageHead'
import CaCard from '../components/CaCard'
import { SUB_CAS } from '../data/constants'
import { useI18n } from '../i18n/I18nProvider'

const SubCaPage: React.FC = () => {
  const { t } = useI18n()
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    if (!q.trim()) return SUB_CAS
    const k = q.toLowerCase()
    return SUB_CAS.filter(
      (c) =>
        c.id.toLowerCase().includes(k) ||
        c.cn.toLowerCase().includes(k) ||
        c.cnEn.toLowerCase().includes(k),
    )
  }, [q])

  return (
    <div className="page">
      <PageHead
        num={t('sub.num')}
        title={
          <>
            {t('sub.title.a')}
            <em>{t('sub.title.em')}</em>
          </>
        }
        desc={t('sub.desc')}
        actions={
          <Input
            allowClear
            size="large"
            placeholder={t('sub.search')}
            prefix={<SearchOutlined />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260 }}
          />
        }
      />

      <div className="grid grid--auto">
        {list.map((c) => (
          <CaCard key={c.id} item={c} />
        ))}
      </div>

      {list.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: 'var(--ink-3)',
            fontFamily: 'var(--ff-mono)',
            fontSize: 12,
            letterSpacing: '0.15em',
          }}
        >
          — {t('sub.empty')} —
        </div>
      )}
    </div>
  )
}

export default SubCaPage
