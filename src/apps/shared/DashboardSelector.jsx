import { useEffect, useState } from 'react'
import logoUSS from '../../assets/escudo-uss-horizontal-azul.svg'

export default function DashboardSelector({ userName, userEmail, onSelect, onLogout }) {
  const [lastUsed, setLastUsed] = useState(null)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => {
    const last = localStorage.getItem('uss_last_dashboard')
    setLastUsed(last)
    // Trigger fade+slide animation
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`selector-page ${visible ? 'selector-visible' : ''}`}>
      <div className="selector-container">

        {/* Header */}
        <div className="selector-header">
          <div className="selector-logo-wrap">
            <img
              src={logoUSS}
              alt="Universidad San Sebastián"
              className="selector-logo"
            />
          </div>
          <h1 className="selector-title">Sistema de Gestión USS</h1>
          <p className="selector-subtitle">Selecciona tu mesa de trabajo</p>
        </div>

        {/* Cards */}
        <div className="selector-cards">
          <button
            className="selector-card"
            onClick={() => onSelect('medios')}
          >
            <span className="selector-card-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="16" width="5" height="9" rx="1.5" fill="#ceb37c"/>
                <rect x="11" y="10" width="5" height="15" rx="1.5" fill="#0f2b41"/>
                <rect x="19" y="4" width="5" height="21" rx="1.5" fill="#ceb37c" opacity="0.6"/>
                <path d="M4 20L10 14L16 17L24 9" stroke="#0f2b41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="selector-card-title">Mesa de Medios</span>
            <p className="selector-card-desc">Gestión de campañas y contenidos</p>
            {lastUsed === 'medios' && (
              <span className="selector-last-badge">Último usado</span>
            )}
          </button>

          <button
            className="selector-card"
            onClick={() => onSelect('editorial')}
          >
            <span className="selector-card-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="5" y="3" width="18" height="22" rx="3" fill="#f0f4f8" stroke="#0f2b41" strokeWidth="1.5"/>
                <path d="M9 9h10M9 13h10M9 17h6" stroke="#0f2b41" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="21" cy="21" r="4.5" fill="#ceb37c"/>
                <path d="M19.5 21h3M21 19.5v3" stroke="#0f2b41" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="selector-card-title">Mesa Editorial</span>
            <p className="selector-card-desc">Plan comunicacional y acciones por eje</p>
            {lastUsed === 'editorial' && (
              <span className="selector-last-badge">Último usado</span>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="selector-footer">
          <span className="selector-user">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 12c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {userName}
          </span>
          <span className="selector-separator">·</span>
          <button className="selector-logout" onClick={onLogout}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M4.5 2H2.5a1 1 0 00-1 1v7a1 1 0 001 1h2M8.5 9l2.5-2.5L8.5 4M5 6.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
