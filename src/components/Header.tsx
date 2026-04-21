import React from 'react'

const Header: React.FC = () => {
  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <a href="#top" className="brand" aria-label="Pikachu Test Root CA">
          <span className="brand__logo" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l2.4 5 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.8 9.6 7 12 2z"
                fill="#1a1200"
              />
            </svg>
          </span>
          <span>
            Pikachu <span style={{ color: '#ffd83d' }}>Test CA</span>
            <span className="brand__sub" style={{ display: 'block', marginTop: 2 }}>
              Public Test Root RSA
            </span>
          </span>
        </a>

        <nav className="nav" aria-label="主要导航">
          <a href="#rootca">Root CA</a>
          <a href="#subca">Sub CAs</a>
          <a href="#apply">Apply</a>
          <a href="#policy">Policy</a>
          <a
            href="https://github.com/PIKACHUIM/testca"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  )
}

export default Header
