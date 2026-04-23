import { useState, useEffect, useRef } from 'react'
import logoUSS from '../../../assets/escudo-uss-horizontal-blanco.svg'

export default function HeaderEditorial({ userName, userEmail, onLogout, onBackToSelector, onShowLogs, onShowProfile, onSwitchDashboard, otherDashboardName }) {
  const initials = userName
    ? userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!showMenu) return
    const handle = (e) => { if (!menuRef.current?.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showMenu])

  return (
    <header className="header header-editorial">
      <div className="header-row-top">
        <div className="header-left">
          {onBackToSelector && (
            <button className="btn-back-selector" onClick={onBackToSelector} title="Volver al selector" aria-label="Volver al selector de mesas">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div className="header-logo">
            <img src={logoUSS} alt="USS" className="header-logo-img" />
          </div>
          <div className="header-divider" />
          <div>
            <h1 className="header-title">Mesa Editorial <span className="header-title-suffix">USS</span></h1>
            <p className="header-subtitle">Plan comunicacional y acciones por eje</p>
          </div>
        </div>
        <div className="header-user">
          {/* Desktop: profile trigger + logout */}
          <div className="user-menu header-desktop-user">
            <button className="user-profile-trigger" onClick={onShowProfile} title={`Ver perfil de ${userName}`}>
              <div className="user-avatar">{initials}</div>
              <div className="user-info">
                <span className="user-name">{userName}</span>
                <span className="user-email">{userEmail}</span>
              </div>
              <svg className="user-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="user-menu-divider" />
            <button className="btn-logout" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M5.5 2H3a1 1 0 00-1 1v9a1 1 0 001 1h2.5M10 10l3-2.5L10 5M6 7.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Mobile: avatar + dropdown */}
          <div className="mobile-avatar-wrap" ref={menuRef}>
            <button className="mobile-avatar-btn" onClick={() => setShowMenu(v => !v)} aria-label="Menú de usuario">
              <div className="user-avatar">{initials}</div>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 2, opacity: 0.75 }}>
                <path d={showMenu ? 'M3 7l3-3 3 3' : 'M3 5l3 3 3-3'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showMenu && (
              <div className="mobile-avatar-dropdown">
                <button className="mobile-avatar-item" onClick={() => { onShowProfile(); setShowMenu(false) }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Ver perfil
                </button>
                <button className="mobile-avatar-item" onClick={() => { onShowLogs(); setShowMenu(false) }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <rect x="1.5" y="1.5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Actividad
                </button>
                {onSwitchDashboard && otherDashboardName && (
                  <button className="mobile-avatar-item" onClick={() => { onSwitchDashboard(); setShowMenu(false) }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7h12M9 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {otherDashboardName}
                  </button>
                )}
                <div className="mobile-avatar-divider" />
                <button className="mobile-avatar-item mobile-avatar-item--danger" onClick={() => { onLogout(); setShowMenu(false) }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M5.5 2H3a1 1 0 00-1 1v9a1 1 0 001 1h2.5M10 10l3-2.5L10 5M6 7.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="header-row-actions">
        <div className="realtime-badge"><span className="realtime-dot" /><span>En vivo</span></div>
        <button className="btn-logs" onClick={onShowLogs} title="Ver registro de actividad" aria-label="Ver registro de actividad">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          <span>Actividad</span>
        </button>
        {onSwitchDashboard && otherDashboardName && (
          <button className="btn-switch-mesa" onClick={onSwitchDashboard} title={`Ir a ${otherDashboardName}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M9 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{otherDashboardName}</span>
          </button>
        )}
      </div>
    </header>
  )
}
