import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../shared/utils/supabase'
import { EJES } from './config'
import { useToast } from '../shared/hooks/useToast'
import { useDebounce } from '../shared/hooks/useDebounce'
import HeaderEditorial from './components/Header'
import EditorialTable from './components/EditorialTable'
import MobileCardViewEditorial from './components/MobileCardView'
import AddActionModal from './components/AddActionModal'
import AuditLogPanel from '../mesa-medios/components/AuditLogPanel'
import Toaster from '../shared/components/Toaster'
import ConfirmDialog from '../shared/components/ConfirmDialog'

const TABLE = 'mesa_editorial_acciones'

export default function MesaEditorialApp({ session, userName, onLogout, onBackToSelector }) {
  const [rows,          setRows]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [showLogs,      setShowLogs]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Filters
  const [filterInput,  setFilterInput]  = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [filterEje,    setFilterEje]    = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const { toasts, addToast, removeToast } = useToast()

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('editorial-acciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'INSERT')       setRows(prev => [...prev, payload.new])
        else if (payload.eventType === 'UPDATE')  setRows(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        else if (payload.eventType === 'DELETE')  setRows(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .subscribe()
    fetchRows()
    logAction('LOGIN', null, null, 'Ingresó a Mesa Editorial')
    return () => supabase.removeChannel(channel)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'Escape') {
        if (confirmDelete) { setConfirmDelete(null); return }
        if (showModal)     { setShowModal(false);    return }
        if (showLogs)      { setShowLogs(false);     return }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.editorial-filter-input')?.focus()
        return
      }
      if (e.key.toLowerCase() === 'n' && !inInput && !showModal && !confirmDelete) {
        setShowModal(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmDelete, showModal, showLogs])

  async function fetchRows() {
    setLoading(true)
    const { data, error } = await supabase
      .from(TABLE).select('*').order('eje').order('created_at')
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }

  async function logAction(accion, itemId, itemNombre, detalle = '') {
    if (!session) return
    await supabase.from('logs').insert([{
      user_email:       session.user.email,
      user_nombre:      userName || session.user.email,
      accion,
      contenido_id:     itemId,
      contenido_nombre: itemNombre,
      detalle,
    }])
  }

  // useMemo for filtered rows
  const displayRows = useMemo(() => {
    let result = rows
    if (filterEje !== 'all')    result = result.filter(r => r.eje === filterEje)
    if (filterStatus !== 'all') result = result.filter(r => r.status === filterStatus)
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      result = result.filter(r =>
        r.tema?.toLowerCase().includes(q) ||
        r.accion?.toLowerCase().includes(q) ||
        r.responsable?.toLowerCase().includes(q)
      )
    }
    return result
  }, [rows, filterEje, filterStatus, filterText])

  // KPI computed values
  const kpi = useMemo(() => {
    const completadas  = rows.filter(r => r.status === 'Completado').length
    const enDesarrollo = rows.filter(r => r.status === 'En desarrollo').length
    const pendientes   = rows.filter(r => r.status === 'Pendiente').length
    const pct = rows.length > 0 ? Math.round((completadas / rows.length) * 100) : 0
    return { total: rows.length, completadas, enDesarrollo, pendientes, pct }
  }, [rows])

  async function handleAddRow(data) {
    const { data: inserted, error } = await supabase.from(TABLE).insert([data]).select().single()
    if (error) { addToast('Error al agregar la acción. Intenta nuevamente.', 'error'); return }
    await logAction('AGREGAR', inserted.id, data.accion, `Agregó "${data.accion}"`)
    setShowModal(false)
  }

  async function handleCellChange(rowId, field, value) {
    const row = rows.find(r => r.id === rowId)
    if (!row || row[field] === value) return
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
    const { error } = await supabase.from(TABLE).update({ [field]: value }).eq('id', rowId)
    if (error) { addToast('Error al guardar. Los datos se recargarán.', 'error'); fetchRows(); return }
    await logAction('MODIFICAR', rowId, row.accion, `"${field}" → "${value}"`)
  }

  function requestDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    setConfirmDelete({ id: rowId, nombre: row?.accion || 'esta acción' })
  }

  async function handleDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.filter(r => r.id !== rowId))
    const { error } = await supabase.from(TABLE).delete().eq('id', rowId)
    if (error) { addToast('Error al eliminar la acción.', 'error'); fetchRows(); return }
    await logAction('ELIMINAR', rowId, row?.accion, `Eliminó "${row?.accion}"`)
  }

  return (
    <div className="app app-editorial">
      <HeaderEditorial
        userName={userName}
        userEmail={session.user.email}
        onLogout={onLogout}
        onBackToSelector={onBackToSelector}
        onShowLogs={() => setShowLogs(true)}
        onAdd={() => setShowModal(true)}
      />

      {/* ── KPI Bar ── */}
      <div className="editorial-kpi-bar">
        <span className="kpi-item"><strong>{kpi.total}</strong> acciones</span>
        <span className="kpi-dot" style={{ background: '#16A34A' }} />
        <span className="kpi-item"><strong>{kpi.completadas}</strong> completadas</span>
        <span className="kpi-dot" style={{ background: '#D97706' }} />
        <span className="kpi-item"><strong>{kpi.enDesarrollo}</strong> en desarrollo</span>
        <span className="kpi-dot" style={{ background: '#DC2626' }} />
        <span className="kpi-item"><strong>{kpi.pendientes}</strong> pendientes</span>
        <span className="kpi-sep" />
        <span className="kpi-pct"><strong>{kpi.pct}%</strong> avance</span>
        <div className="kpi-actions">
          <button className="btn-add btn-add-sm" onClick={() => setShowModal(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Nueva acción
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="editorial-filter-bar">
        <div className="filter-search">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Buscar tema, acción, responsable..."
            value={filterInput}
            onChange={e => setFilterInput(e.target.value)}
            className="editorial-filter-input filter-input"
          />
          {filterInput && (
            <button className="filter-clear" onClick={() => setFilterInput('')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter by eje */}
        <div className="filter-pills">
          <button className={`pill ${filterEje === 'all' ? 'pill-active' : ''}`} onClick={() => setFilterEje('all')}>
            Todos los ejes
          </button>
          {EJES.map(eje => (
            <button
              key={eje.id}
              className={`pill ${filterEje === eje.label ? 'pill-active' : ''}`}
              style={filterEje === eje.label ? { background: eje.color, color: 'white', borderColor: eje.color } : {}}
              onClick={() => setFilterEje(filterEje === eje.label ? 'all' : eje.label)}
            >
              {eje.label}
            </button>
          ))}
        </div>

        {/* Filter by status */}
        <div className="filter-pills">
          {['all', 'Pendiente', 'En desarrollo', 'Completado'].map(s => (
            <button
              key={s}
              className={`pill ${filterStatus === s ? 'pill-active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? 'Todos los status' : s}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><span>Cargando acciones...</span></div>}
      {error && <div className="error-state"><strong>Error de conexión:</strong> {error}</div>}

      {!loading && !error && (
        <>
          <div className="desktop-only">
            <EditorialTable
              rows={displayRows}
              onCellChange={handleCellChange}
              onDeleteRow={requestDeleteRow}
              totalRows={rows.length}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal(true)}
            />
          </div>
          <div className="mobile-only">
            <MobileCardViewEditorial
              rows={displayRows}
              onCellChange={handleCellChange}
              onDeleteRow={requestDeleteRow}
              totalRows={rows.length}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal(true)}
            />
          </div>
          <div className="shortcuts-hint desktop-only">
            <span><kbd>Esc</kbd> cerrar</span><span>·</span>
            <span><kbd>Ctrl+K</kbd> buscar</span><span>·</span>
            <span><kbd>N</kbd> nueva acción</span>
          </div>
        </>
      )}

      {showModal && <AddActionModal onConfirm={handleAddRow} onClose={() => setShowModal(false)} />}
      {showLogs && <AuditLogPanel onClose={() => setShowLogs(false)} />}
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
