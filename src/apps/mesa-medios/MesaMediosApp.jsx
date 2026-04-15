import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../shared/utils/supabase'
import { MEDIA_COLS, GROUPS, getGroupCols } from './config'
import { getCellData, setCellData, getRowProgress } from './utils'
import Header from './components/Header'
import MediaTable from './components/MediaTable'
import MobileCardView from './components/MobileCardView'
import AddRowModal from './components/AddRowModal'
import AuditLogPanel from './components/AuditLogPanel'
import Toaster from '../shared/components/Toaster'
import { useToast } from '../shared/hooks/useToast'
import { useDebounce } from '../shared/hooks/useDebounce'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import UserProfilePanel from '../shared/components/UserProfilePanel'

function sortRows(rows, direction) {
  return [...rows].sort((a, b) => {
    const dateA = a.semana || ''
    const dateB = b.semana || ''
    const cmp = dateA.localeCompare(dateB)
    if (cmp !== 0) return direction === 'asc' ? cmp : -cmp
    return (a.nombre || '').localeCompare(b.nombre || '', 'es')
  })
}

export default function MesaMediosApp({ session, userName, onLogout, onBackToSelector, onSwitchDashboard, otherDashboardName }) {
  const [rows,          setRows]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [showLogs,      setShowLogs]      = useState(false)
  const [showProfile,   setShowProfile]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterInput,   setFilterInput]   = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [sortDir,       setSortDir]       = useState('asc')
  const { toasts, addToast, removeToast } = useToast()

  // Filtros verticales (filas)
  const [filterStatus,    setFilterStatus]    = useState('all')
  const [filterDateRange, setFilterDateRange] = useState({ from: '', to: '' })

  // Filtros horizontales (columnas)
  const [filterGroup,      setFilterGroup]      = useState('all')
  const [filterCellStatus, setFilterCellStatus] = useState('all')

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('contenidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contenidos' }, (payload) => {
        if (payload.eventType === 'INSERT')  setRows(prev => [...prev, payload.new])
        else if (payload.eventType === 'UPDATE') setRows(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        else if (payload.eventType === 'DELETE') setRows(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .subscribe()
    fetchRows()
    return () => supabase.removeChannel(channel)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable
      if (e.key === 'Escape') {
        if (showProfile)   { setShowProfile(false);  return }
        if (confirmDelete) { setConfirmDelete(null); return }
        if (showModal)     { setShowModal(false);    return }
        if (showLogs)      { setShowLogs(false);     return }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.filter-input')?.focus()
        return
      }
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
      .from('contenidos').select('*')
      .order('semana', { ascending: true })
      .order('nombre', { ascending: true })
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }

  async function logAction(accion, contenidoId, contenidoNombre, detalle = '') {
    if (!session) return
    const actionMap = { AGREGAR: 'create', MODIFICAR: 'update', ELIMINAR: 'delete', LOGIN: 'login' }
    await supabase.from('audit_logs').insert([{
      mesa_type:  'medios',
      user_email: session.user.email,
      action:     actionMap[accion] || accion.toLowerCase(),
      table_name: 'mesa_medios_contenidos',
      record_id:  contenidoId || null,
      details:    JSON.stringify({ content_name: contenidoNombre || null, description: detalle || null }),
    }])
  }

  const displayRows = useMemo(() => {
    let result = rows
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      result = result.filter(r => r.nombre?.toLowerCase().includes(q))
    }
    if (filterDateRange.from) result = result.filter(r => r.semana >= filterDateRange.from)
    if (filterDateRange.to) result = result.filter(r => r.semana <= filterDateRange.to)
    if (filterStatus === 'filled') result = result.filter(r => getRowProgress(r.medios).pct === 100)
    else if (filterStatus === 'empty') result = result.filter(r => getRowProgress(r.medios).pct === 0)
    else if (filterStatus === 'partial') result = result.filter(r => { const p = getRowProgress(r.medios).pct; return p > 0 && p < 100 })
    if (filterCellStatus !== 'all') {
      const targetCols = filterGroup === 'all' ? MEDIA_COLS : MEDIA_COLS.filter(c => c.group === filterGroup)
      result = result.filter(r => targetCols.some(col => {
        const { valor } = getCellData(r.medios, col.id)
        if (filterCellStatus === 'si') return valor?.toLowerCase().startsWith('si')
        if (filterCellStatus === 'pd') return valor?.toLowerCase().startsWith('pd')
        if (filterCellStatus === 'no') return valor?.toLowerCase() === 'no'
        if (filterCellStatus === 'empty') return !valor
        return true
      }))
    }
    return sortRows(result, sortDir)
  }, [rows, filterText, sortDir, filterStatus, filterDateRange, filterGroup, filterCellStatus])

  const visibleCols = useMemo(() => {
    if (filterGroup === 'all') return MEDIA_COLS
    return MEDIA_COLS.filter(c => c.group === filterGroup)
  }, [filterGroup])

  async function handleAddRow({ nombre, semana }) {
    const { data, error } = await supabase
      .from('contenidos').insert([{ nombre, semana, medios: {} }]).select().single()
    if (error) { addToast('Error al agregar el tema. Intenta nuevamente.', 'error'); return }
    await logAction('AGREGAR', data.id, nombre, `Agregó "${nombre}"`)
    setShowModal(false)
  }

  async function handleCellChange(rowId, colId, value, notas) {
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    const { valor: oldValue, notas: oldNotas } = getCellData(row.medios, colId)
    if (oldValue === value && oldNotas === notas) return
    const newMedios = setCellData(row.medios, colId, value, notas)
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, medios: newMedios } : r))
    const { error } = await supabase.from('contenidos').update({ medios: newMedios }).eq('id', rowId)
    if (error) { addToast('Error al guardar. Los datos se recargarán.', 'error'); fetchRows(); return }
    const detalle = value ? `"${colId}" → "${value}"${notas ? ' (con notas)' : ''}` : `Limpió "${colId}"`
    await logAction('MODIFICAR', rowId, row.nombre, detalle)
  }

  async function handleFieldChange(rowId, field, value) {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
    const { error } = await supabase.from('contenidos').update({ [field]: value }).eq('id', rowId)
    if (error) { addToast('Error al guardar el campo. Los datos se recargarán.', 'error'); fetchRows(); return }
    await logAction('MODIFICAR', rowId, row?.nombre, `Cambió "${field}" → "${value}"`)
  }

  function requestDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    setConfirmDelete({ id: rowId, nombre: row?.nombre || 'este tema' })
  }

  async function handleDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.filter(r => r.id !== rowId))
    const { error } = await supabase.from('contenidos').delete().eq('id', rowId)
    if (error) { addToast('Error al eliminar el tema.', 'error'); fetchRows(); return }
    await logAction('ELIMINAR', rowId, row?.nombre, `Eliminó "${row?.nombre}"`)
  }

  const hasActiveFilters = filterInput || filterStatus !== 'all' || filterGroup !== 'all' || filterCellStatus !== 'all' || filterDateRange.from || filterDateRange.to

  return (
    <div className="app app-fill-height">
      <Header
        userName={userName}
        userEmail={session.user.email}
        onAdd={() => setShowModal(true)}
        onLogout={onLogout}
        onShowLogs={() => setShowLogs(true)}
        onBackToSelector={onBackToSelector}
        onShowProfile={() => setShowProfile(true)}
        onSwitchDashboard={onSwitchDashboard}
        otherDashboardName={otherDashboardName}
      />

      <div className="medios-filter-bar">
        {/* Fila 1: Buscador + Fechas + Orden */}
        <div className="medios-filter-row">
          <div className="filter-search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input type="text" placeholder="Buscar temas..." value={filterInput}
              onChange={e => setFilterInput(e.target.value)} className="filter-input" />
            {filterInput && (
              <button className="filter-clear" onClick={() => setFilterInput('')}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <div className="filter-date-range">
            <input type="date" value={filterDateRange.from} onChange={e => setFilterDateRange(p => ({ ...p, from: e.target.value }))} className="filter-date-input" title="Desde" />
            <span className="filter-date-sep">→</span>
            <input type="date" value={filterDateRange.to} onChange={e => setFilterDateRange(p => ({ ...p, to: e.target.value }))} className="filter-date-input" title="Hasta" />
            {(filterDateRange.from || filterDateRange.to) && (
              <button className="filter-clear-sm" onClick={() => setFilterDateRange({ from: '', to: '' })}>✕</button>
            )}
          </div>
          <button className="sort-btn" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M4 4l3-2.5L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sortDir === 'asc' ? 1 : 0.3 }} />
              <path d="M4 10l3 2.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sortDir === 'desc' ? 1 : 0.3 }} />
            </svg>
            <span>Fecha</span>
          </button>
        </div>

        {/* Fila 2: Pills */}
        <div className="medios-filter-pills-row">
          <div className="filter-pills">
            {[{ value: 'all', label: 'Todos' }, { value: 'filled', label: 'Completos' }, { value: 'partial', label: 'En progreso' }, { value: 'empty', label: 'Vacíos' }].map(f => (
              <button key={f.value} className={`pill ${filterStatus === f.value ? 'pill-active' : ''}`} onClick={() => setFilterStatus(f.value)}>{f.label}</button>
            ))}
          </div>
          <div className="filter-pills-divider" />
          <div className="filter-pills">
            <button className={`pill ${filterGroup === 'all' ? 'pill-active' : ''}`} onClick={() => setFilterGroup('all')}>Todos los medios</button>
            {GROUPS.map(g => (
              <button key={g.id} className={`pill ${filterGroup === g.id ? 'pill-active' : ''}`} onClick={() => setFilterGroup(filterGroup === g.id ? 'all' : g.id)}>{g.label}</button>
            ))}
          </div>
          <div className="filter-pills-divider" />
          <div className="filter-pills">
            {[{ value: 'all', label: 'Todas las celdas' }, { value: 'si', label: '✓ Confirmado' }, { value: 'pd', label: '◉ Por definir' }, { value: 'no', label: '✕ No aplica' }, { value: 'empty', label: '○ Vacías' }].map(f => (
              <button key={f.value} className={`pill ${filterCellStatus === f.value ? 'pill-active' : ''}`} onClick={() => setFilterCellStatus(f.value)}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Indicador activo */}
        {hasActiveFilters && (
          <div className="medios-filter-active">
            <span className="filter-count">{displayRows.length} de {rows.length} temas</span>
            {filterGroup !== 'all' && <span className="filter-count">· {visibleCols.length} columnas</span>}
            <button className="filter-reset" onClick={() => { setFilterInput(''); setFilterStatus('all'); setFilterGroup('all'); setFilterCellStatus('all'); setFilterDateRange({ from: '', to: '' }) }}>Limpiar filtros</button>
          </div>
        )}
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><span>Cargando datos...</span></div>}
      {error && <div className="error-state"><strong>Error de conexión:</strong> {error}</div>}

      {!loading && !error && (
        <>
          <div className="desktop-only">
            <MediaTable rows={displayRows} visibleCols={visibleCols} onCellChange={handleCellChange} onFieldChange={handleFieldChange}
              onDeleteRow={requestDeleteRow} totalRows={rows.length} filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')} onAdd={() => setShowModal(true)} />
          </div>
          <div className="mobile-only">
            <MobileCardView rows={displayRows} onCellChange={handleCellChange} onFieldChange={handleFieldChange}
              onDeleteRow={requestDeleteRow} totalRows={rows.length} filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')} onAdd={() => setShowModal(true)} />
          </div>
          <div className="shortcuts-hint desktop-only">
            <span><kbd>Esc</kbd> cerrar</span><span>·</span>
            <span><kbd>Ctrl+K</kbd> buscar</span><span>·</span>
            <span><kbd>N</kbd> nuevo</span>
          </div>
        </>
      )}

      {showModal && <AddRowModal onConfirm={handleAddRow} onClose={() => setShowModal(false)} existingNames={rows.map(r => r.nombre).filter(Boolean)} />}
      {showLogs && <AuditLogPanel onClose={() => setShowLogs(false)} mesaType="medios" />}
      {showProfile && <UserProfilePanel userEmail={session.user.email} userName={userName} onClose={() => setShowProfile(false)} />}
      {confirmDelete && (
        <ConfirmDialog nombre={confirmDelete.nombre}
          onConfirm={() => { handleDeleteRow(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)} />
      )}
      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
