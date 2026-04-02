import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { MEDIA_COLS } from './config'
import Header from './components/Header'
import MediaTable from './components/MediaTable'
import MobileCardView from './components/MobileCardView'
import AddRowModal from './components/AddRowModal'
import Login from './components/Login'
import AuditLogPanel from './components/AuditLogPanel'
import USSLoader from './components/USSLoader'
import Toaster from './components/Toaster'
import { useToast } from './hooks/useToast'
import { useDebounce } from './hooks/useDebounce'
import ConfirmDialog from './components/ConfirmDialog'

// ── Helper: read cell value from new or legacy JSONB format ─────
// New format: { valor: "si / Claudia", notas: "..." }
// Legacy format: "si / Claudia"
export function getCellData(medios, colId) {
  const raw = medios?.[colId]
  if (!raw) return { valor: '', notas: '' }
  if (typeof raw === 'string') return { valor: raw, notas: '' }
  return { valor: raw.valor || '', notas: raw.notas || '' }
}

export function setCellData(medios, colId, valor, notas) {
  const existing = getCellData(medios, colId)
  const newNotas = notas !== undefined ? notas : existing.notas
  if (!valor && !newNotas) return { ...medios, [colId]: null }
  return { ...medios, [colId]: { valor: valor || '', notas: newNotas || '' } }
}

export function getRowProgress(medios) {
  const filled = MEDIA_COLS.filter(col => {
    const { valor } = getCellData(medios, col.id)
    return valor && valor !== 'no'
  }).length
  const total = MEDIA_COLS.length
  return { filled, total, pct: Math.round((filled / total) * 100) }
}

// ── Sort helper ─────────────────────────────────────────────────
function sortRows(rows, direction) {
  return [...rows].sort((a, b) => {
    const dateA = a.semana || ''
    const dateB = b.semana || ''
    const cmp = dateA.localeCompare(dateB)
    if (cmp !== 0) return direction === 'asc' ? cmp : -cmp
    return (a.nombre || '').localeCompare(b.nombre || '', 'es')
  })
}

export default function App() {
  const [session,      setSession]      = useState(null)
  const [authorized,   setAuthorized]   = useState(null)
  const [userName,     setUserName]     = useState('')
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [showModal,    setShowModal]    = useState(false)
  const [showLogs,     setShowLogs]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // null | { id, nombre }

  // ── Filter & sort state ─────────────────────────────────────
  const [filterInput,  setFilterInput]  = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [sortDir,      setSortDir]      = useState('asc') // 'asc' | 'desc'

  // ── Toast notifications ───────────────────────────────────────
  const { toasts, addToast, removeToast } = useToast()

  // ── Auth state ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkAuthorized(session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkAuthorized(session.user.email)
      else { setAuthorized(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkAuthorized(email) {
    // Minimum delay to show loader animation
    const [data] = await Promise.all([
      supabase
        .from('usuarios_autorizados')
        .select('email, nombre')
        .eq('email', email.toLowerCase())
        .eq('activo', true)
        .single()
        .then(res => res.data),
      new Promise(resolve => setTimeout(resolve, 400))
    ])

    if (data) {
      setAuthorized(true)
      setUserName(data.nombre || email)
      await logAction('LOGIN', null, null, `Inició sesión`)
      fetchRows()
    } else {
      setAuthorized(false)
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setRows([])
    setAuthorized(null)
    setUserName('')
  }

  // ── Logging ───────────────────────────────────────────────────
  async function logAction(accion, contenidoId, contenidoNombre, detalle = '') {
    if (!session) return
    await supabase.from('logs').insert([{
      user_email:       session.user.email,
      user_nombre:      userName || session.user.email,
      accion,
      contenido_id:     contenidoId,
      contenido_nombre: contenidoNombre,
      detalle,
    }])
  }

  // ── Data fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!authorized) return
    const channel = supabase
      .channel('contenidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contenidos' }, (payload) => {
        if (payload.eventType === 'INSERT')
          setRows(prev => [...prev, payload.new])
        else if (payload.eventType === 'UPDATE')
          setRows(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        else if (payload.eventType === 'DELETE')
          setRows(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [authorized])

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // Escape — cierra modales en orden de prioridad
      if (e.key === 'Escape') {
        if (confirmDelete) { setConfirmDelete(null); return }
        if (showModal)     { setShowModal(false);    return }
        if (showLogs)      { setShowLogs(false);     return }
      }

      // Ctrl/Cmd + K — focus en búsqueda
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.filter-input')?.focus()
        return
      }

      // N — nuevo contenido (solo si no hay input enfocado y no hay modal abierto)
      if (e.key.toLowerCase() === 'n' && !inInput && !showModal && !showLogs && !confirmDelete) {
        setShowModal(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmDelete, showModal, showLogs])

  async function fetchRows() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contenidos')
      .select('*')
      .order('semana', { ascending: true })
      .order('nombre', { ascending: true })
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }

  // ── Filtered + sorted rows ────────────────────────────────────
  const displayRows = useMemo(() => {
    let result = rows
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      result = result.filter(r => r.nombre?.toLowerCase().includes(q))
    }
    return sortRows(result, sortDir)
  }, [rows, filterText, sortDir])

  // ── CRUD + logging ────────────────────────────────────────────
  async function handleAddRow({ nombre, semana }) {
    const { data, error } = await supabase
      .from('contenidos')
      .insert([{ nombre, semana, medios: {} }])
      .select()
      .single()
    if (error) { addToast('Error al agregar el contenido. Intenta nuevamente.', 'error'); return }
    await logAction('AGREGAR', data.id, nombre, `Agregó "${nombre}"`)
    setShowModal(false)
  }

  async function handleCellChange(rowId, colId, value, notas) {
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    
    // Check if values actually changed
    const { valor: oldValue, notas: oldNotas } = getCellData(row.medios, colId)
    const valueChanged = oldValue !== value
    const notasChanged = oldNotas !== notas
    
    // If nothing changed, don't save or log
    if (!valueChanged && !notasChanged) return
    
    const newMedios = setCellData(row.medios, colId, value, notas)
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, medios: newMedios } : r))
    const { error } = await supabase
      .from('contenidos').update({ medios: newMedios }).eq('id', rowId)
    if (error) { addToast('Error al guardar. Los datos se recargarán.', 'error'); fetchRows(); return }
    
    // Build detailed log message
    const detalle = value
      ? `"${colId}" → "${value}"${notas ? ' (con notas)' : ''}`
      : `Limpió "${colId}"`
    await logAction('MODIFICAR', rowId, row.nombre, detalle)
  }

  async function handleFieldChange(rowId, field, value) {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
    const { error } = await supabase
      .from('contenidos').update({ [field]: value }).eq('id', rowId)
    if (error) { addToast('Error al guardar el campo. Los datos se recargarán.', 'error'); fetchRows(); return }
    await logAction('MODIFICAR', rowId, row?.nombre, `Cambió "${field}" → "${value}"`)
  }

  function requestDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    setConfirmDelete({ id: rowId, nombre: row?.nombre || 'este contenido' })
  }

  async function handleDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.filter(r => r.id !== rowId))
    const { error } = await supabase.from('contenidos').delete().eq('id', rowId)
    if (error) { addToast('Error al eliminar el contenido.', 'error'); fetchRows(); return }
    await logAction('ELIMINAR', rowId, row?.nombre, `Eliminó "${row?.nombre}"`)
  }

  // ── Render states ─────────────────────────────────────────────
  if (!session) return <Login />

  if (authorized === null) return (
    <div className="fullscreen-center">
      <USSLoader />
      <span>Verificando acceso...</span>
    </div>
  )

  if (authorized === false) return (
    <div className="fullscreen-center">
      <div className="not-authorized">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#9C0006" strokeWidth="2" fill="#FFC7CE" />
          <path d="M24 14v12M24 32v2" stroke="#9C0006" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h2>Acceso denegado</h2>
        <p>Tu correo <strong>{session.user.email}</strong> no está en la lista de usuarios autorizados.</p>
        <p>Contactá al administrador del sistema.</p>
        <button className="btn-add" onClick={handleLogout}>Volver</button>
      </div>
    </div>
  )

  return (
    <div className="app">
      <Header
        userName={userName}
        userEmail={session.user.email}
        onAdd={() => setShowModal(true)}
        onLogout={handleLogout}
        onShowLogs={() => setShowLogs(true)}
      />

      {/* ── Filter & sort bar ── */}
      <div className="filter-bar">
        <div className="filter-search">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Filtrar contenidos..."
            value={filterInput}
            onChange={e => setFilterInput(e.target.value)}
            className="filter-input"
          />
          {filterInput && (
            <button className="filter-clear" onClick={() => setFilterInput('')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <button
          className="sort-btn"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          title={sortDir === 'asc' ? 'Más antigua primero' : 'Más reciente primero'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M4 4l3-2.5L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: sortDir === 'asc' ? 1 : 0.3 }} />
            <path d="M4 10l3 2.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: sortDir === 'desc' ? 1 : 0.3 }} />
          </svg>
          <span>Fecha</span>
        </button>
        {filterInput && (
          <span className="filter-count">{displayRows.length} de {rows.length}</span>
        )}
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <span>Cargando datos...</span>
        </div>
      )}

      {error && (
        <div className="error-state">
          <strong>Error de conexión:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="desktop-only">
            <MediaTable
              rows={displayRows}
              onCellChange={handleCellChange}
              onFieldChange={handleFieldChange}
              onDeleteRow={requestDeleteRow}
              totalRows={rows.length}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal(true)}
            />
          </div>
          <div className="mobile-only">
            <MobileCardView
              rows={displayRows}
              onCellChange={handleCellChange}
              onFieldChange={handleFieldChange}
              onDeleteRow={requestDeleteRow}
              totalRows={rows.length}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal(true)}
            />
          </div>
          <div className="shortcuts-hint desktop-only">
            <span><kbd>Esc</kbd> cerrar</span>
            <span>·</span>
            <span><kbd>Ctrl+K</kbd> buscar</span>
            <span>·</span>
            <span><kbd>N</kbd> nuevo</span>
          </div>
        </>
      )}

      {showModal && (
        <AddRowModal onConfirm={handleAddRow} onClose={() => setShowModal(false)} />
      )}

      {showLogs && (
        <AuditLogPanel onClose={() => setShowLogs(false)} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          nombre={confirmDelete.nombre}
          onConfirm={() => { handleDeleteRow(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
