import { useState, useEffect } from 'react'
import { supabase } from '../../shared/utils/supabase'

const ACTION_STYLE = {
  LOGIN:     { bg: '#dbeafe', text: '#1e40af', label: 'Ingreso' },
  AGREGAR:   { bg: '#c6efce', text: '#276221', label: 'Agregó' },
  MODIFICAR: { bg: '#fff2cc', text: '#7d5a00', label: 'Modificó' },
  ELIMINAR:  { bg: '#ffc7ce', text: '#8b0000', label: 'Eliminó' },
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

export default function AuditLogPanel({ onClose, mesaType }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('TODOS')
  const isMobile = useIsMobile()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    async function fetchLogs() {
      let query = supabase.from('audit_logs').select('*')
      if (mesaType) query = query.eq('mesa_type', mesaType)
      const { data } = await query.order('created_at', { ascending: false }).limit(200)
      setLogs(data || [])
      setLoading(false)
    }
    fetchLogs()
  }, [mesaType])

  const filtered = filter === 'TODOS'
    ? logs
    : logs.filter(l => l.accion === filter)

  function formatDate(iso) {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  function formatDateShort(iso) {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const filterButtons = (
    <div className="logs-filters">
      {['TODOS', 'AGREGAR', 'MODIFICAR', 'ELIMINAR'].map(f => (
        <button
          key={f}
          className={`filter-btn ${filter === f ? 'active' : ''}`}
          onClick={() => setFilter(f)}
        >
          {f === 'TODOS' ? 'Todos' : ACTION_STYLE[f]?.label || f}
        </button>
      ))}
    </div>
  )

  // ── Mobile: fullscreen panel ──────────────────────────────────
  if (isMobile) {
    return (
      <div className="logs-fullscreen">
        <div className="logs-fullscreen-header">
          <h2>Actividad</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {filterButtons}

        <div className="logs-cards-scroll">
          {loading ? (
            <div className="loading-state"><div className="spinner" /><span>Cargando...</span></div>
          ) : filtered.length === 0 ? (
            <div className="mobile-empty"><p>No hay registros.</p></div>
          ) : (
            <div className="logs-cards">
              {filtered.map(log => {
                const style = ACTION_STYLE[log.accion] || { bg: '#f0f4fb', text: '#1a2b3c', label: log.accion }
                return (
                  <div key={log.id} className="log-card">
                    <div className="log-card-top">
                      <span className="log-badge" style={{ background: style.bg, color: style.text }}>
                        {style.label}
                      </span>
                      <span className="log-card-date">{formatDateShort(log.created_at)}</span>
                    </div>
                    <div className="log-card-user">{log.user_nombre}</div>
                    {log.contenido_nombre && (
                      <div className="log-card-contenido">{log.contenido_nombre}</div>
                    )}
                    {log.detalle && (
                      <div className="log-card-detalle">{log.detalle}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Desktop: modal with table ─────────────────────────────────
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal logs-modal">
        <div className="modal-header">
          <h2>Registro de actividad</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {filterButtons}

        <div className="logs-body">
          {loading ? (
            <div className="loading-state"><div className="spinner" /><span>Cargando...</span></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p>No hay registros aún.</p>
            </div>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Contenido</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const style = ACTION_STYLE[log.accion] || { bg: '#f0f4fb', text: '#1a2b3c', label: log.accion }
                  return (
                    <tr key={log.id}>
                      <td className="log-date">{formatDate(log.created_at)}</td>
                      <td className="log-user">
                        <div className="log-user-name">{log.user_nombre}</div>
                        <div className="log-user-email">{log.user_email}</div>
                      </td>
                      <td>
                        <span className="log-badge" style={{ background: style.bg, color: style.text }}>
                          {style.label}
                        </span>
                      </td>
                      <td className="log-contenido">{log.contenido_nombre || '—'}</td>
                      <td className="log-detalle">{log.detalle || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
