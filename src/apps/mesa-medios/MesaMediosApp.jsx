import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../shared/utils/supabase'
import { MEDIA_COLS } from './config'
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

function sortRows(rows, direction) {
  return [...rows].sort((a, b) => {
    const dateA = a.semana || ''
    const dateB = b.semana || ''
    const cmp = dateA.localeCompare(dateB)
    if (cmp !== 0) return direction === 'asc' ? cmp : -cmp
    return (a.nombre || '').localeCompare(b.nombre || '', 'es')
  })
}

export default function MesaMediosApp({ session, userName, onLogout, onBackToSelector }) {
  const [rows,          setRows]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [showLogs,      setShowLogs]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterInput,   setFilterInput]   = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [sortDir,       setSortDir]       = useState('asc')
  const { toasts, addToast, removeToast } = useToast()

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
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'Escape') {
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
    return sortRows(result, sortDir)
  }, [rows, filterText, sortDir])

  async function handleAddRow({ nombre, semana }) {
    const { data, error } = await supabase
      .from('contenidos').insert([{ nombre, semana, medios: {} }]).select().single()
    if (error) { addToast('Error al agregar el contenido. Intenta nuevamente.', 'error'); return }
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
    setConfirmDelete({ id: rowId, nombre: row?.nombre || 'este contenido' })
  }

  async function handleDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.filter(r => r.id !== rowId))
    const { error } = await supabase.from('contenidos').delete().eq('id', rowId)
    if (error) { addToast('Error al eliminar el contenido.', 'error'); fetchRows(); return }
    await logAction('ELIMINAR', rowId, row?.nombre, `Eliminó "${row?.nombre}"`)
  }

  return (
    <div className="app">
      <Header
        userName={userName}
        userEmail={session.user.email}
        onAdd={() => setShowModal(true)}
        onLogout={onLogout}
        onShowLogs={() => setShowLogs(true)}
        onBackToSelector={onBackToSelector}
      />

      <div className="filter-bar">
        <div className="filter-search">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input type="text" placeholder="Filtrar contenidos..." value={filterInput}
            onChange={e => setFilterInput(e.target.value)} className="filter-input" />
          {filterInput && (
            <button className="filter-clear" onClick={() => setFilterInput('')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <button className="sort-btn" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          title={sortDir === 'asc' ? 'Más antigua primero' : 'Más reciente primero'}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M4 4l3-2.5L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sortDir === 'asc' ? 1 : 0.3 }} />
            <path d="M4 10l3 2.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sortDir === 'desc' ? 1 : 0.3 }} />
          </svg>
          <span>Fecha</span>
        </button>
        {filterInput && <span className="filter-count">{displayRows.length} de {rows.length}</span>}
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><span>Cargando datos...</span></div>}
      {error && <div className="error-state"><strong>Error de conexión:</strong> {error}</div>}

      {!loading && !error && (
        <>
          <div className="desktop-only">
            <MediaTable rows={displayRows} onCellChange={handleCellChange} onFieldChange={handleFieldChange}
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
      {confirmDelete && (
        <ConfirmDialog nombre={confirmDelete.nombre}
          onConfirm={() => { handleDeleteRow(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)} />
      )}
      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
