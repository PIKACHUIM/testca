import React from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import NoticeBanner from './components/NoticeBanner'
import CaSection from './components/CaSection'
import ApplyForm from './components/ApplyForm'
import Footer from './components/Footer'

const App: React.FC = () => {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <NoticeBanner />
        <CaSection />
        <ApplyForm />
      </main>
      <Footer />
    </>
  )
}

export default App
