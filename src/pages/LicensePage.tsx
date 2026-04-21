import React from 'react'
import DocumentPage from './DocumentPage'
import { LICENSE_ZH, LICENSE_EN } from '../docs/license'

const LicensePage: React.FC = () => (
  <DocumentPage
    num="license.num"
    titleA="license.title.a"
    titleEm="license.title.em"
    desc="license.desc"
    sourceZh={LICENSE_ZH}
    sourceEn={LICENSE_EN}
    slug="license"
  />
)

export default LicensePage
