import React from 'react'

const Footer: React.FC = () => {
  return (
    <footer className="footer" id="policy">
      <div className="container footer__row">
        <div>
          <div style={{ color: 'var(--text-dim)' }}>
            © {new Date().getFullYear()} Pikachu Trust Network CA · For testing purposes only.
          </div>
          <div style={{ marginTop: 6 }}>
            Not affiliated with The Pokémon Company. Powered by Vite · React · Ant Design.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <a href="./CPS-CN.pdf">CPS · 中文</a>
          <a href="./CPS-EN.pdf">CPS · EN</a>
          <a href="./legacy.html">Legacy HTML</a>
          <a href="https://github.com/PIKACHUIM/testca" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
