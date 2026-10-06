import React from 'react'
import SideRail from './components/SideRail'
import AppBar from './components/AppBar'
import OverviewPage from './pages/OverviewPage'
import RootCaPage from './pages/RootCaPage'
import SubCaPage from './pages/SubCaPage'
import ApplyPage from './pages/ApplyPage'
import RevokePage from './pages/RevokePage'
import CardCertPage from './pages/CardCertPage'
import DocsPage from './pages/DocsPage'
import CpsPage from './pages/CpsPage'
import PrivacyPage from './pages/PrivacyPage'
import LicensePage from './pages/LicensePage'
import { useHashRoute, type PageKey } from './hooks/useHashRoute'

const App: React.FC = () => {
  const [page, nav] = useHashRoute()

  const render = (k: PageKey) => {
    switch (k) {
      case 'root':
        return <RootCaPage />
      case 'sub':
        return <SubCaPage />
      case 'apply':
        return <ApplyPage />
      case 'revoke':
        return <RevokePage />
      case 'card':
        return <CardCertPage />
      case 'docs':
        return <DocsPage onNav={nav} />
      case 'cps':
        return <CpsPage />
      case 'privacy':
        return <PrivacyPage />
      case 'license':
        return <LicensePage />
      case 'overview':
      default:
        return <OverviewPage onNav={nav} />
    }
  }

  return (
    <div className="shell">
      <SideRail active={page} onNav={nav} />
      <AppBar page={page} />
      <main className="main" key={page}>
        {render(page)}
      </main>
    </div>
  )
}

export default App
