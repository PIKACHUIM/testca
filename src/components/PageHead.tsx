import React from 'react'

interface Props {
  num: string
  title: React.ReactNode
  desc?: React.ReactNode
  actions?: React.ReactNode
}

/**
 * Editorial 风格页头：序号 + 大号 serif 标题 + 精简描述
 */
const PageHead: React.FC<Props> = ({ num, title, desc, actions }) => (
  <header className="phead">
    <div>
      <div className="phead__num">{num}</div>
      <h1 className="phead__title">{title}</h1>
      {desc && <p className="phead__desc">{desc}</p>}
    </div>
    {actions && <div className="phead__actions">{actions}</div>}
  </header>
)

export default PageHead
