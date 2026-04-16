import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../shared/utils/supabase'
import { MEDIA_COLS, GROUPS } from './config'
import { getCellData, setCellData } from './utils'
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

export default function MesaMediosApp({ session, userName, onLogout, onBackToSelector, onSwitchDashboard, otherDashboardName }) {
  const [temas,         setTemas]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  // showModal: null | 'new' | { temaId, temaNombre, existingDates[] }
  const [showModal,     setShowModal]     = useState(null)
  const [showLogs,      setShowLogs]      = useState(false)
  const [showProfile,   setShowProfile]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterInput,   setFilterInput]   = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [sortDir,       setSortDir]       = useState('asc')
  const { toasts, addToast, removeToast } = useToast()

  // Filtros verticales
  const [filterDateRange, setFilterDateRange] = useState({ from: '', to: '' })

  // Filtros horizontales
  const [filterGroup,      setFilterGroup]      = useState('all')
  const [filterCellStatus, setFilterCellStatus] = useState('all')

  // Collapsed column groups
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  // Expanded temas
  const [expandedTemas, setExpandedTemas] = useState(new Set())

  function toggleGroup(groupId) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  function toggleTema(temaId) {
    setExpandedTemas(prev => {
      const next = new Set(prev)
      if (next.has(temaId)) next.delete(temaId)
      else next.add(temaId)
      return next
    })
  }

  // Realtime subscriptions
  useEffect(() => {
    const chTemas = supabase
      .channel('temas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'temas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTemas(prev => [...prev, { ...payload.new, planificaciones: [] }])
        } else if (payload.eventType === 'UPDATE') {
          setTemas(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t))
        } else if (payload.eventType === 'DELETE') {
          setTemas(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()

    const chContenidos = supabase
      .channel('contenidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contenidos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const p = payload.new
          setTemas(prev => prev.map(t =>
            t.id === p.tema_id ? { ...t, planificaciones: [...t.planificaciones, p] } : t
          ))
        } else if (payload.eventType === 'UPDATE') {
          setTemas(prev => prev.map(t => ({
            ...t,
            planificaciones: t.planificaciones.map(p => p.id === payload.new.id ? payload.new : p)
          })))
        } else if (payload.eventType === 'DELETE') {
          setTemas(prev => prev.map(t => ({
            ...t,
            planificaciones: t.planificaciones.filter(p => p.id !== payload.old.id)
          })))
        }
      })
      .subscribe()

    fetchData()
    return () => {
      supabase.removeChannel(chTemas)
      supabase.removeChannel(chContenidos)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable
      if (e.key === 'Escape') {
        if (showProfile)   { setShowProfile(false);  return }
        if (confirmDelete) { setConfirmDelete(null); return }
        if (showModal)     { setShowModal(null);     return }
        if (showLogs)      { setShowLogs(false);     return }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.filter-input')?.focus()
        return
      }
      if (e.key.toLowerCase() === 'n' && !inInput && !showModal && !showLogs && !confirmDelete) {
        setShowModal('new')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmDelete, showModal, showLogs])

  async function fetchData() {
    setLoading(true)
    const [{ data: temasData, error: tErr }, { data: planifs, error: pErr }] = await Promise.all([
      supabase.from('temas').select('*').order('nombre'),
      supabase.from('contenidos').select('*').order('semana').order('nombre'),
    ])
    if (tErr || pErr) { setError((tErr || pErr).message); setLoading(false); return }

    const tree = (temasData || []).map(tema => ({
      ...tema,
      planificaciones: (planifs || []).filter(p => p.tema_id === tema.id),
    }))
    setTemas(tree)

    // Auto-expandir temas con 0 ó 1 planificaciones (solo en la carga inicial)
    setExpandedTemas(prev => {
      if (prev.size > 0) return prev
      return new Set(tree.filter(t => t.planificaciones.length <= 1).map(t => t.id))
    })

    setLoading(false)
  }

  async function logAction(accion, contenidoId, contenidoNombre, detalle = '') {
    if (!session) return
    const actionMap = { AGREGAR: 'create', MODIFICAR: 'update', ELIMINAR: 'delete' }
    await supabase.from('audit_logs').insert([{
      mesa_type:  'medios',
      user_email: session.user.email,
      action:     actionMap[accion] || accion.toLowerCase(),
      table_name: 'mesa_medios_contenidos',
      record_id:  contenidoId || null,
      details:    JSON.stringify({ content_name: contenidoNombre || null, description: detalle || null }),
    }])
  }

  const displayTemas = useMemo(() => {
    let result = temas.map(tema => {
      let planifs = [...tema.planificaciones]

      // Filtro por rango de fecha sobre planificaciones
      if (filterDateRange.from) planifs = planifs.filter(p => p.semana && p.semana >= filterDateRange.from)
      if (filterDateRange.to)   planifs = planifs.filter(p => p.semana && p.semana <= filterDateRange.to)

      // Filtro por estado de celda sobre planificaciones
      if (filterCellStatus !== 'all') {
        const targetCols = filterGroup === 'all' ? MEDIA_COLS : MEDIA_COLS.filter(c => c.group === filterGroup)
        planifs = planifs.filter(p => targetCols.some(col => {
          const { valor } = getCellData(p.medios, col.id)
          if (filterCellStatus === 'si')    return valor?.toLowerCase().startsWith('si')
          if (filterCellStatus === 'pd')    return valor?.toLowerCase().startsWith('pd')
          if (filterCellStatus === 'no')    return valor?.toLowerCase() === 'no'
          if (filterCellStatus === 'empty') return !valor
          return true
        }))
      }

      // Ordenar planificaciones por fecha
      planifs.sort((a, b) => (a.semana || '').localeCompare(b.semana || ''))
      return { ...tema, planificaciones: planifs }
    })

    // Filtro de texto sobre nombre del tema
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      result = result.filter(t => t.nombre?.toLowerCase().includes(q))
    }

    // Si hay filtros de planificacion activos, ocultar temas sin resultados
    if (filterDateRange.from || filterDateRange.to || filterCellStatus !== 'all') {
      result = result.filter(t => t.planificaciones.length > 0)
    }

    // Ordenar temas por fecha más temprana de sus planificaciones
    result = [...result].sort((a, b) => {
      const dateA = a.planificaciones[0]?.semana || '9999-99-99'
      const dateB = b.planificaciones[0]?.semana || '9999-99-99'
      const cmp = dateA.localeCompare(dateB)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [temas, filterText, sortDir, filterDateRange, filterGroup, filterCellStatus])

  const visibleCols = useMemo(() => {
    if (filterGroup === 'all') return MEDIA_COLS
    return MEDIA_COLS.filter(c => c.group === filterGroup)
  }, [filterGroup])

  // handleAddRow: crea tema (si es nuevo) + planificación
  async function handleAddRow({ nombre, semana, temaId }) {
    let targetTemaId = temaId
    if (!targetTemaId) {
      const { data: newTema, error } = await supabase
        .from('temas').insert([{ nombre, origen: 'medios' }]).select().single()
      if (error) { addToast('Error al crear el tema. Intenta nuevamente.', 'error'); return }
      targetTemaId = newTema.id
    }
    const { data, error } = await supabase
      .from('contenidos').insert([{ nombre, semana, medios: {}, tema_id: targetTemaId }]).select().single()
    if (error) { addToast('Error al agregar la planificación. Intenta nuevamente.', 'error'); return }
    await logAction('AGREGAR', data.id, nombre, `Agregó "${nombre}"`)
    setShowModal(null)
  }

  // handleCellChange: actualiza una celda de una planificación
  async function handleCellChange(planifId, colId, value, notas) {
    let planif = null
    let tema = null
    for (const t of temas) {
      const p = t.planificaciones.find(p => p.id === planifId)
      if (p) { planif = p; tema = t; break }
    }
    if (!planif) return
    const { valor: oldValue, notas: oldNotas } = getCellData(planif.medios, colId)
    if (oldValue === value && oldNotas === notas) return
    const newMedios = setCellData(planif.medios, colId, value, notas)
    setTemas(prev => prev.map(t => t.id === tema.id ? {
      ...t,
      planificaciones: t.planificaciones.map(p => p.id === planifId ? { ...p, medios: newMedios } : p)
    } : t))
    const { error } = await supabase.from('contenidos').update({ medios: newMedios }).eq('id', planifId)
    if (error) { addToast('Error al guardar. Los datos se recargarán.', 'error'); fetchData(); return }
    const detalle = value ? `"${colId}" → "${value}"${notas ? ' (con notas)' : ''}` : `Limpió "${colId}"`
    await logAction('MODIFICAR', planifId, tema.nombre, detalle)
  }

  // handleFieldChange: edita campo de planificación (p.ej. semana)
  async function handleFieldChange(planifId, field, value) {
    let tema = null
    for (const t of temas) {
      if (t.planificaciones.some(p => p.id === planifId)) { tema = t; break }
    }
    setTemas(prev => prev.map(t => t.id === tema?.id ? {
      ...t,
      planificaciones: t.planificaciones.map(p => p.id === planifId ? { ...p, [field]: value } : p)
    } : t))
    const { error } = await supabase.from('contenidos').update({ [field]: value }).eq('id', planifId)
    if (error) { addToast('Error al guardar el campo. Los datos se recargarán.', 'error'); fetchData(); return }
    await logAction('MODIFICAR', planifId, tema?.nombre, `Cambió "${field}" → "${value}"`)
  }

  function requestDeleteRow(planifId) {
    let nombre = 'planificación'
    for (const t of temas) {
      const p = t.planificaciones.find(p => p.id === planifId)
      if (p) {
        const dateStr = p.semana
          ? new Date(p.semana + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : 'sin fecha'
        nombre = `planificación del ${dateStr} en "${t.nombre}"`
        break
      }
    }
    setConfirmDelete({ type: 'planif', id: planifId, nombre })
  }

  function requestDeleteTema(temaId) {
    const tema = temas.find(t => t.id === temaId)
    if (!tema) return
    setConfirmDelete({
      type: 'tema',
      id: temaId,
      nombre: tema.nombre || 'Sin nombre',
      n: tema.planificaciones.length,
      fromEditorial: tema.origen === 'editorial',
    })
  }

  async function handleDeleteRow(planifId) {
    let tema = null
    for (const t of temas) {
      if (t.planificaciones.some(p => p.id === planifId)) { tema = t; break }
    }
    const { error } = await supabase.from('contenidos').delete().eq('id', planifId)
    if (error) { addToast('Error al eliminar.', 'error'); fetchData(); return }
    setTemas(prev => prev.map(t =>
      t.id === tema?.id
        ? { ...t, planificaciones: t.planificaciones.filter(p => p.id !== planifId) }
        : t
    ))
    await logAction('ELIMINAR', planifId, tema?.nombre)
  }

  async function handleDeleteTema(temaId) {
    const tema = temas.find(t => t.id === temaId)
    const { error } = await supabase.from('temas').delete().eq('id', temaId)
    if (error) { addToast('Error al eliminar el tema.', 'error'); return }
    setTemas(prev => prev.filter(t => t.id !== temaId))
    await logAction('ELIMINAR', temaId, tema?.nombre, 'Eliminó tema completo')
  }

  async function handleRenameTema(temaId, nombre) {
    setTemas(prev => prev.map(t => t.id === temaId ? { ...t, nombre } : t))
    const { error } = await supabase.from('temas').update({ nombre }).eq('id', temaId)
    if (error) { addToast('Error al renombrar el tema.', 'error'); fetchData(); return }
    await logAction('MODIFICAR', temaId, nombre, `Renombró tema → "${nombre}"`)
  }

  function handleOpenAddPlanificacion(temaId) {
    const tema = temas.find(t => t.id === temaId)
    if (!tema) return
    setShowModal({
      temaId: tema.id,
      temaNombre: tema.nombre,
      existingDates: tema.planificaciones.map(p => p.semana).filter(Boolean),
    })
  }

  const hasActiveFilters = filterInput || filterGroup !== 'all' || filterCellStatus !== 'all' || filterDateRange.from || filterDateRange.to
  const totalPlanifs = temas.reduce((acc, t) => acc + t.planificaciones.length, 0)
  const displayPlanifs = displayTemas.reduce((acc, t) => acc + t.planificaciones.length, 0)

  return (
    <div className="app">
      <Header
        userName={userName}
        userEmail={session.user.email}
        onAdd={() => setShowModal('new')}
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
            <button className={`pill ${filterGroup === 'all' ? 'pill-active' : ''}`} onClick={() => setFilterGroup('all')}>Todos los medios</button>
            {GROUPS.map(g => (
              <button key={g.id} className={`pill ${filterGroup === g.id ? 'pill-active' : ''}`} onClick={() => {
                const next = filterGroup === g.id ? 'all' : g.id
                setFilterGroup(next)
                if (next !== 'all') setCollapsedGroups(prev => { const s = new Set(prev); s.delete(next); return s })
              }}>{g.label}</button>
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
            <span className="filter-count">{displayTemas.length} de {temas.length} temas · {displayPlanifs} de {totalPlanifs} fechas</span>
            {filterGroup !== 'all' && <span className="filter-count"> · {visibleCols.length} columnas</span>}
            <button className="filter-reset" onClick={() => { setFilterInput(''); setFilterGroup('all'); setFilterCellStatus('all'); setFilterDateRange({ from: '', to: '' }) }}>Limpiar filtros</button>
          </div>
        )}
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><span>Cargando datos...</span></div>}
      {error && <div className="error-state"><strong>Error de conexión:</strong> {error}</div>}

      {!loading && !error && (
        <>
          <div className="desktop-only">
            <MediaTable
              temas={displayTemas}
              visibleCols={visibleCols}
              onCellChange={handleCellChange}
              onFieldChange={handleFieldChange}
              onDeleteRow={requestDeleteRow}
              onDeleteTema={requestDeleteTema}
              onRenameTema={handleRenameTema}
              onAddPlanificacion={handleOpenAddPlanificacion}
              totalTemas={temas.length}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal('new')}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              expandedTemas={expandedTemas}
              onToggleTema={toggleTema}
            />
          </div>
          <div className="mobile-only">
            <MobileCardView
              temas={displayTemas}
              onCellChange={handleCellChange}
              onFieldChange={handleFieldChange}
              onDeleteRow={requestDeleteRow}
              onAddPlanificacion={handleOpenAddPlanificacion}
              totalTemas={temas.length}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal('new')}
            />
          </div>
          <div className="shortcuts-hint desktop-only">
            <span><kbd>Esc</kbd> cerrar</span><span>·</span>
            <span><kbd>Ctrl+K</kbd> buscar</span><span>·</span>
            <span><kbd>N</kbd> nuevo</span>
          </div>
        </>
      )}

      {/* Modales */}
      {showModal === 'new' && (
        <AddRowModal
          temas={temas}
          onConfirm={handleAddRow}
          onClose={() => setShowModal(null)}
        />
      )}
      {showModal && typeof showModal === 'object' && (
        <AddRowModal
          prefillTema={{ id: showModal.temaId, nombre: showModal.temaNombre }}
          existingDates={showModal.existingDates}
          onConfirm={handleAddRow}
          onClose={() => setShowModal(null)}
        />
      )}
      {showLogs && <AuditLogPanel onClose={() => setShowLogs(false)} mesaType="medios" />}
      {showProfile && <UserProfilePanel userEmail={session.user.email} userName={userName} onClose={() => setShowProfile(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.type === 'tema'
              ? `¿Eliminar tema "${confirmDelete.nombre}"?`
              : '¿Eliminar planificación?'
          }
          body={
            confirmDelete.type === 'tema'
              ? `Se eliminará el tema y ${confirmDelete.n === 0 ? 'sus datos' : confirmDelete.n === 1 ? 'su 1 planificación' : `sus ${confirmDelete.n} planificaciones`}. Esta acción no se puede deshacer.${confirmDelete.fromEditorial ? '\n\nEste tema fue sincronizado desde Mesa Editorial. Eliminarlo solo afecta Mesa de Medios; la acción en Editorial no se modifica.' : ''}`
              : `Se eliminará la ${confirmDelete.nombre}. Esta acción no se puede deshacer.`
          }
          onConfirm={() => {
            if (confirmDelete.type === 'tema') handleDeleteTema(confirmDelete.id)
            else handleDeleteRow(confirmDelete.id)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
