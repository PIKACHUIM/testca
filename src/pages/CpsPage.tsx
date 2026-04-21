import React from 'react'
import DocumentPage from './DocumentPage'
import { CPS_ZH, CPS_EN } from '../docs/cps'

const CpsPage: React.FC = () => (
  <DocumentPage
    num="cps.num"
    titleA="cps.title.a"
    titleEm="cps.title.em"
    desc="cps.desc"
    sourceZh={CPS_ZH}
    sourceEn={CPS_EN}
    slug="cps"
  />
)

export default CpsPage
