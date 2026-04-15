import logoUSS from '../../../assets/escudo-uss-horizontal-blanco.svg'

export default function Header({ userName, userEmail, onAdd, onLogout, onShowLogs, onBackToSelector, onShowProfile, onSwitchDashboard, otherDashboardName }) {
  const initials = userName
    ? userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="header">
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
            <img src={logoUSS} alt="USS" className="header-logo-img" />
          </div>
          <div className="header-divider" />
          <div>
            <h1 className="header-title">Mesa de Medios USS</h1>
            <p className="header-subtitle">Planificación de contenidos y medios</p>
          </div>
        </div>
        <div className="header-user">
          <div className="user-menu">
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
            <button className="btn-logout" onClick={onLogout} title="Cerrar sesión">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M5.5 2H3a1 1 0 00-1 1v9a1 1 0 001 1h2.5M10 10l3-2.5L10 5M6 7.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="header-row-actions">
        <div className="realtime-badge"><span className="realtime-dot" /><span>En vivo</span></div>
        <button className="btn-logs" onClick={onShowLogs} title="Ver registro de actividad">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="1.5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
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
        <button className="btn-add" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <span>Agregar tema</span>
        </button>
      </div>
    </header>
  )
}
