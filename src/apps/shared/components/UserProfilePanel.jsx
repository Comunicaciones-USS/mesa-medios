import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabase'
import { sha256 } from '../utils/crypto'

const ADMIN_EMAIL = 'leonardo.munoz@uss.cl'

const ACTION_STYLE = {
  login:  { bg: '#dbeafe', text: '#1e40af', label: 'Ingreso',   dot: '#3b82f6' },
  create: { bg: '#c6efce', text: '#276221', label: 'Agregó',    dot: '#16a34a' },
  update: { bg: '#fff2cc', text: '#7d5a00', label: 'Modificó',  dot: '#d97706' },
  delete: { bg: '#ffc7ce', text: '#8b0000', label: 'Eliminó',   dot: '#dc2626' },
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `hace ${mins}m`
  if (hours < 24) return `hace ${hours}h`
  if (days === 1) return 'ayer'
  if (days < 30)  return `hace ${days} días`
  const months = Math.floor(days / 30)
  return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
}

function formatDateFull(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

function parseDetails(details) {
  try { return JSON.parse(details) || {} } catch { return {} }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

// ── Panel admin de PINs (solo para ADMIN_EMAIL) ───────────────────
function PinAdminSection() {
  const [users,        setUsers]        = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [generating,   setGenerating]   = useState(null)   // email en proceso
  const [revealed,     setRevealed]     = useState(null)   // { pin, userName, userEmail }
  const [copied,       setCopied]       = useState(false)

  useEffect(() => {
    supabase
      .from('usuarios_autorizados')
      .select('email, nombre, pin_hash, activo')
      .order('nombre')
      .then(({ data }) => {
        setUsers(data || [])
        setLoadingUsers(false)
      })
  }, [])

  async function handleGeneratePin(user) {
    setGenerating(user.email)

    // Generar PIN de 6 dígitos usando CSPRNG
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    const pin = String((arr[0] % 900000) + 100000) // 100000–999999

    // Hashear
    const hash = await sha256(pin)

    // Guardar en DB
    const { error } = await supabase
      .from('usuarios_autorizados')
      .update({ pin_hash: hash, pin_updated_at: new Date().toISOString() })
      .eq('email', user.email)

    if (!error) {
      setUsers(prev => prev.map(u =>
        u.email === user.email ? { ...u, pin_hash: hash } : u
      ))
      setRevealed({ pin, userName: user.nombre, userEmail: user.email })
      setCopied(false)
    }
    setGenerating(null)
  }

  async function handleCopy() {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed.pin).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="profile-section pin-admin-section">
      <h3 className="profile-section-title">Gestión de PINs</h3>

      {loadingUsers ? (
        <div className="loading-state" style={{ padding: '20px 0' }}>
          <div className="spinner" /><span>Cargando usuarios...</span>
        </div>
      ) : (
        <div className="pin-admin-list">
          {users.map(user => (
            <div key={user.email} className="pin-admin-row">
              <div className="pin-admin-user-info">
                <span className="pin-admin-name">{user.nombre}</span>
                <span className="pin-admin-email">{user.email}</span>
              </div>
              <span className={`pin-status-badge ${user.pin_hash ? 'pin-badge-ok' : 'pin-badge-missing'}`}>
                {user.pin_hash ? 'PIN configurado' : 'Sin PIN'}
              </span>
              <button
                className="btn-secondary pin-gen-btn"
                onClick={() => handleGeneratePin(user)}
                disabled={generating === user.email}
              >
                {generating === user.email
                  ? 'Generando...'
                  : user.pin_hash ? 'Resetear PIN' : 'Generar PIN'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal one-shot — solo se muestra una vez y se cierra */}
      {revealed && (
        <div className="modal-backdrop" onClick={() => setRevealed(null)}>
          <div className="modal pin-reveal-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#0f2b41', color: '#fff' }}>
              <h2>PIN generado</h2>
              <button className="modal-close" onClick={() => setRevealed(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="pin-reveal-body">
              <p className="pin-reveal-user">
                PIN para <strong>{revealed.userName}</strong>
              </p>
              <div className="pin-reveal-code">{revealed.pin}</div>
              <p className="pin-reveal-warning">
                Copia este PIN y entrégalo al usuario por canal seguro.{' '}
                <strong>No se mostrará de nuevo.</strong>
              </p>
              <div className="pin-reveal-actions">
                <button className="btn-primary" onClick={handleCopy}>
                  {copied ? '✓ Copiado' : 'Copiar al portapapeles'}
                </button>
                <button className="btn-secondary" onClick={() => setRevealed(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UserProfilePanel({ userEmail, userName, onClose }) {
  const [logs,         setLogs]         = useState([])
  const [editorialRows, setEditorialRows] = useState([])
  const [loading,      setLoading]      = useState(true)
  const isMobile = useIsMobile()

  const initials = userName
    ? userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    async function fetchData() {
      const [logsRes, editorialRes] = await Promise.all([
        supabase.from('audit_logs')
          .select('*')
          .eq('user_email', userEmail)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('mesa_editorial_acciones')
          .select('id, responsable, status, created_at, completed_at')
          .ilike('responsable', userName),
      ])
      setLogs(logsRes.data || [])
      setEditorialRows(editorialRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [userEmail])

  const stats = useMemo(() => {
    const logins  = logs.filter(l => l.action === 'login')
    const creates = logs.filter(l => l.action === 'create')
    const updates = logs.filter(l => l.action === 'update')
    const deletes = logs.filter(l => l.action === 'delete')

    const firstLogin = logins.length > 0 ? logins[logins.length - 1].created_at : null
    const lastLogin  = logins.length > 0 ? logins[0].created_at : null

    // Acciones asignadas — ya vienen filtradas desde Supabase
    const assigned     = editorialRows
    const completadas  = assigned.filter(r => r.status === 'Completado')
    const enDesarrollo = assigned.filter(r => r.status === 'En desarrollo')
    const pendientes   = assigned.filter(r => r.status === 'Pendiente')
    const pctCompletado = assigned.length > 0
      ? Math.round((completadas.length / assigned.length) * 100)
      : 0

    const tiempos = completadas
      .filter(r => r.completed_at && r.created_at)
      .map(r => (new Date(r.completed_at) - new Date(r.created_at)) / 86400000)
    const tiempoPromedio = tiempos.length > 0
      ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length * 10) / 10
      : null

    // Actividad por día de la semana (últimos 30 días)
    const last30 = logs.filter(l => Date.now() - new Date(l.created_at).getTime() < 30 * 86400000)
    const dayActivity = [0, 0, 0, 0, 0, 0, 0]
    last30.forEach(l => { dayActivity[new Date(l.created_at).getDay()]++ })
    const maxActivity = Math.max(...dayActivity, 1)

    return {
      totalLogins: logins.length,
      totalCreates: creates.length,
      totalUpdates: updates.length,
      totalDeletes: deletes.length,
      firstLogin,
      lastLogin,
      assigned: assigned.length,
      completadas: completadas.length,
      enDesarrollo: enDesarrollo.length,
      pendientes: pendientes.length,
      pctCompletado,
      tiempoPromedio,
      dayActivity,
      maxActivity,
      recentLogs: logs.slice(0, 20),
    }
  }, [logs, editorialRows, userName])

  const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

  const panelBody = (
    <>
      {loading ? (
        <div className="loading-state" style={{ padding: '40px 0' }}>
          <div className="spinner" /><span>Cargando estadísticas...</span>
        </div>
      ) : (
        <div className="profile-body">

          {/* Stat cards */}
          <div className="profile-stats-grid">
            {[
              { value: stats.totalCreates, label: 'Creadas' },
              { value: stats.completadas,  label: 'Completadas' },
              { value: stats.totalUpdates, label: 'Modificadas' },
              { value: stats.totalDeletes, label: 'Eliminadas' },
            ].map(({ value, label }) => (
              <div key={label} className="profile-stat-card">
                <span className="profile-stat-value">{value}</span>
                <span className="profile-stat-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Acciones asignadas */}
          {stats.assigned > 0 && (
            <div className="profile-section">
              <h3 className="profile-section-title">Acciones asignadas</h3>
              <div className="profile-assigned-row">
                <span className="profile-assigned-total">{stats.assigned} acciones</span>
                <span className="profile-assigned-pct">{stats.pctCompletado}% completado</span>
              </div>
              <div className="profile-progress-track">
                <div
                  className="profile-progress-fill"
                  style={{ width: `${stats.pctCompletado}%` }}
                />
              </div>
              <div className="profile-assigned-breakdown">
                <span className="profile-chip profile-chip-green">{stats.completadas} completadas</span>
                <span className="profile-chip profile-chip-yellow">{stats.enDesarrollo} en desarrollo</span>
                <span className="profile-chip profile-chip-red">{stats.pendientes} pendientes</span>
              </div>
              {stats.tiempoPromedio !== null && (
                <p className="profile-tiempo">
                  Tiempo promedio de completado: <strong>{stats.tiempoPromedio} días</strong>
                </p>
              )}
            </div>
          )}

          {/* Heatmap semanal */}
          <div className="profile-section">
            <h3 className="profile-section-title">Actividad últimos 30 días</h3>
            <div className="profile-heatmap">
              {DAY_LABELS.map((day, i) => {
                const opacity = stats.dayActivity[i] / stats.maxActivity
                return (
                  <div key={i} className="profile-heatmap-col">
                    <div
                      className="profile-heatmap-cell"
                      style={{ opacity: Math.max(0.08, opacity) }}
                      title={`${day}: ${stats.dayActivity[i]} acciones`}
                    />
                    <span className="profile-heatmap-label">{day}</span>
                  </div>
                )
              })}
            </div>
            <p className="profile-login-dates">
              {stats.firstLogin && <>Primer acceso: {formatDateFull(stats.firstLogin)} · </>}
              {stats.lastLogin && <>Último: {timeAgo(stats.lastLogin)}</>}
            </p>
          </div>

          {/* Timeline actividad reciente */}
          <div className="profile-section">
            <h3 className="profile-section-title">Actividad reciente</h3>
            {stats.recentLogs.length === 0 ? (
              <p className="profile-empty">Sin actividad registrada.</p>
            ) : (
              <div className="profile-activity-table">
                {stats.recentLogs.map((log) => {
                  const style = ACTION_STYLE[log.action] || { label: log.action, bg: '#f1f5f9', text: '#475569' }
                  const d = parseDetails(log.details)
                  const desc = d.content_name || d.description || '—'
                  return (
                    <div key={log.id} className="profile-activity-row">
                      <span className="profile-timeline-badge" style={{ background: style.bg, color: style.text }}>
                        {style.label}
                      </span>
                      <span className="profile-activity-desc" title={desc}>{desc}</span>
                      <span className="profile-timeline-time">{timeAgo(log.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Panel admin — solo visible para Leonardo */}
          {userEmail === ADMIN_EMAIL && <PinAdminSection />}

        </div>
      )}
    </>
  )

  // ── Mobile: fullscreen ────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="logs-fullscreen profile-fullscreen">
        <div className="logs-fullscreen-header profile-fullscreen-header">
          <div className="profile-header-info">
            <div className="profile-avatar-lg">{initials}</div>
            <div>
              <div className="profile-name">{userName}</div>
              <div className="profile-email">{userEmail}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="logs-cards-scroll">
          {panelBody}
        </div>
      </div>
    )
  }

  // ── Desktop: modal ────────────────────────────────────────────
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal profile-panel">
        <div className="modal-header profile-panel-header">
          <div className="profile-header-info">
            <div className="profile-avatar-lg">{initials}</div>
            <div>
              <div className="profile-name">{userName}</div>
              <div className="profile-email-sm">{userEmail}</div>
              {stats.firstLogin && (
                <div className="profile-since">Miembro desde {formatDateFull(stats.firstLogin)}</div>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="logs-body">
          {panelBody}
        </div>
      </div>
    </div>
  )
}
