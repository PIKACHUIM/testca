import React from 'react'
import DocumentPage from './DocumentPage'
import { PRIVACY_ZH, PRIVACY_EN } from '../docs/privacy'

const PrivacyPage: React.FC = () => (
  <DocumentPage
    num="privacy.num"
    titleA="privacy.title.a"
    titleEm="privacy.title.em"
    desc="privacy.desc"
    sourceZh={PRIVACY_ZH}
    sourceEn={PRIVACY_EN}
    slug="privacy"
  />
)

export default PrivacyPage
