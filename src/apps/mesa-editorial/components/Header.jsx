export default function HeaderEditorial({ userName, userEmail, onLogout, onBackToSelector }) {
  const initials = userName
    ? userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="header header-editorial">
      <div className="header-row-top">
        <div className="header-left">
          {onBackToSelector && (
            <button className="btn-back-selector" onClick={onBackToSelector} title="Volver al selector">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div className="header-logo">
            <img src="/mesa-medios/escudo-uss-horizontal-blanco.svg" alt="USS" className="header-logo-img" />
          </div>
          <div className="header-divider" />
          <div>
            <h1 className="header-title">Mesa Editorial USS</h1>
            <p className="header-subtitle">Plan comunicacional y acciones por eje</p>
          </div>
        </div>
        <div className="header-user">
          <div className="user-menu">
            <div className="user-avatar" title={`${userName} (${userEmail})`}>{initials}</div>
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-email">{userEmail}</span>
            </div>
            <button className="btn-logout" onClick={onLogout} title="Cerrar sesión">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M5.5 2H3a1 1 0 00-1 1v9a1 1 0 001 1h2.5M10 10l3-2.5L10 5M6 7.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
