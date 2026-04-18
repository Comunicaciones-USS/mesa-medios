import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../shared/utils/supabase'
import { EJES } from './config'
import { useToast } from '../shared/hooks/useToast'
import { useDebounce } from '../shared/hooks/useDebounce'
import HeaderEditorial from './components/Header'
import EditorialTable from './components/EditorialTable'
import MobileCardViewEditorial from './components/MobileCardView'
import AddActionModal from './components/AddActionModal'
import ExplorerSidebar from './components/ExplorerSidebar'
import AuditLogPanel from '../mesa-medios/components/AuditLogPanel'
import Toaster from '../shared/components/Toaster'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import UserProfilePanel from '../shared/components/UserProfilePanel'

const TABLE = 'mesa_editorial_acciones'

export default function MesaEditorialApp({ session, userName, onLogout, onBackToSelector, onSwitchDashboard, otherDashboardName }) {
  const [rows,             setRows]             = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  const [showModal,        setShowModal]        = useState(false)
  const [showLogs,         setShowLogs]         = useState(false)
  const [showProfile,      setShowProfile]      = useState(false)
  const [confirmDelete,    setConfirmDelete]    = useState(null)
  const [confirmArchive,   setConfirmArchive]   = useState(null)   // { id, nombre, pendingChildCount }
  const [confirmReactivate,setConfirmReactivate]= useState(null)   // { id, nombre, tipo }
  const [showExplorer,     setShowExplorer]     = useState(false)
  const [explorerFilter,   setExplorerFilter]   = useState(null)
  const [prefilledAction,  setPrefilledAction]  = useState(null)
  const [activeTab,        setActiveTab]        = useState('active') // 'active' | 'archived'

  // Filters
  const [filterInput,      setFilterInput]      = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [filterEje,        setFilterEje]        = useState('all')
  const [filterStatus,     setFilterStatus]     = useState('all')
  const [filterTipoAccion, setFilterTipoAccion] = useState('all')
  const [sortDir,          setSortDir]          = useState(null)

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
    return () => supabase.removeChannel(channel)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable
      if (e.key === 'Escape') {
        if (showProfile)         { setShowProfile(false);         return }
        if (confirmDelete)       { setConfirmDelete(null);        return }
        if (confirmArchive)      { setConfirmArchive(null);       return }
        if (confirmReactivate)   { setConfirmReactivate(null);    return }
        if (showModal)           { setShowModal(false);           return }
        if (showLogs)            { setShowLogs(false);            return }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.editorial-filter-input')?.focus()
        return
      }
      if (e.key.toLowerCase() === 'n' && !inInput && !showModal && !confirmDelete && !confirmArchive && !confirmReactivate) {
        if (activeTab === 'active') setShowModal(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmDelete, confirmArchive, confirmReactivate, showModal, showLogs, activeTab])

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
    const actionMap = { AGREGAR: 'create', MODIFICAR: 'update', ELIMINAR: 'delete', LOGIN: 'login' }
    await supabase.from('audit_logs').insert([{
      mesa_type:  'editorial',
      user_email: session.user.email,
      action:     actionMap[accion] || accion.toLowerCase(),
      table_name: 'mesa_editorial_acciones',
      record_id:  itemId || null,
      details:    JSON.stringify({ content_name: itemNombre || null, description: detalle || null }),
    }])
  }

  // Tab counts
  const activeCount   = useMemo(() => rows.filter(r => !r.archived).length, [rows])
  const archivedCount = useMemo(() => rows.filter(r =>  r.archived).length, [rows])

  // Filtered rows for current tab
  const displayRows = useMemo(() => {
    let result = activeTab === 'archived'
      ? rows.filter(r => r.archived)
      : rows.filter(r => !r.archived)

    if (filterEje !== 'all') result = result.filter(r => r.eje === filterEje)

    if (activeTab === 'active') {
      if (filterStatus !== 'all')     result = result.filter(r => r.status === filterStatus)
      if (filterTipoAccion !== 'all') result = result.filter(r => r.tipo_accion === filterTipoAccion)
      if (explorerFilter) {
        if (explorerFilter.eje)  result = result.filter(r => r.eje === explorerFilter.eje)
        if (explorerFilter.tema) result = result.filter(r => r.tema === explorerFilter.tema)
      }
    }

    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      result = result.filter(r =>
        r.tema?.toLowerCase().includes(q) ||
        r.accion?.toLowerCase().includes(q) ||
        r.responsable?.toLowerCase().includes(q)
      )
    }

    if (sortDir && activeTab === 'active') {
      result = [...result].sort((a, b) => {
        const cmp = (a.fecha || '').localeCompare(b.fecha || '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (activeTab === 'archived') {
      result = [...result].sort((a, b) =>
        (b.archived_at || '').localeCompare(a.archived_at || '')
      )
    }

    return result
  }, [rows, activeTab, filterEje, filterStatus, filterTipoAccion, filterText, sortDir, explorerFilter])

  // KPI values — different per tab
  const kpi = useMemo(() => {
    if (activeTab === 'archived') {
      const all = rows.filter(r => r.archived)
      const now = new Date()
      const monthPfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const yearPfx  = `${now.getFullYear()}`
      return {
        mode:     'archived',
        total:    all.length,
        estesMes: all.filter(r => r.archived_at?.startsWith(monthPfx)).length,
        esteAno:  all.filter(r => r.archived_at?.startsWith(yearPfx)).length,
      }
    }
    const active = rows.filter(r => !r.archived)
    const completadas  = active.filter(r => r.status === 'Completado').length
    const enDesarrollo = active.filter(r => r.status === 'En desarrollo').length
    const pendientes   = active.filter(r => r.status === 'Pendiente').length
    const pct = active.length > 0 ? Math.round((completadas / active.length) * 100) : 0
    return { mode: 'active', total: active.length, completadas, enDesarrollo, pendientes, pct }
  }, [rows, activeTab])

  // ── Archiving logic ────────────────────────────────────────────────

  async function handleInitiateArchive(rowId, row) {
    const now = new Date().toISOString()
    const statusUpdate = { status: 'Completado', completed_at: now }
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...statusUpdate } : r))
    await supabase.from(TABLE).update(statusUpdate).eq('id', rowId)

    if (row.tipo_accion === 'Backlog') {
      await handleDoArchive(rowId, false)
    } else {
      // Resultado: revisar si tiene backlogs pendientes
      const pendingChildren = rows.filter(r =>
        r.parent_id === rowId && !r.archived && r.status !== 'Completado'
      )
      if (pendingChildren.length > 0) {
        setConfirmArchive({ id: rowId, nombre: row.accion, pendingChildCount: pendingChildren.length })
      } else {
        await handleDoArchive(rowId, true)
      }
    }
  }

  async function handleDoArchive(rowId, archiveChildren = false) {
    const now = new Date().toISOString()
    const archiveData = { archived: true, archived_at: now }
    const children = archiveChildren
      ? rows.filter(r => r.parent_id === rowId && !r.archived)
      : []
    const childIds  = children.map(c => c.id)
    const allIds    = [rowId, ...childIds]

    setRows(prev => prev.map(r =>
      allIds.includes(r.id)
        ? { ...r, ...archiveData, status: 'Completado', completed_at: r.completed_at || now }
        : r
    ))

    if (childIds.length > 0) {
      await supabase.from(TABLE)
        .update({ ...archiveData, status: 'Completado', completed_at: now })
        .in('id', childIds)
    }

    const { error } = await supabase.from(TABLE).update(archiveData).eq('id', rowId)
    if (error) { addToast('Error al archivar.', 'error'); fetchRows(); return }

    const childMsg = children.length > 0
      ? ` con ${children.length} backlog${children.length !== 1 ? 's' : ''}`
      : ''
    addToast(`Acción archivada${childMsg}.`, 'success', 5000, {
      label: 'Ver archivadas',
      onClick: () => switchTab('archived'),
    })
    await logAction('MODIFICAR', rowId, null, `Archivó acción${childMsg}`)
  }

  async function handleReactivate(rowId) {
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    const reactivateData = { archived: false, archived_at: null, status: 'En desarrollo' }
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...reactivateData } : r))
    const { error } = await supabase.from(TABLE).update(reactivateData).eq('id', rowId)
    if (error) { addToast('Error al reactivar.', 'error'); fetchRows(); return }
    setConfirmReactivate(null)
    addToast('Acción reactivada. Visible en Activas.', 'success')
    await logAction('MODIFICAR', rowId, row.accion, 'Reactivó acción')
  }

  function requestReactivate(rowId) {
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    setConfirmReactivate({ id: rowId, nombre: row.accion || 'esta acción', tipo: row.tipo_accion })
  }

  // ── Handlers existentes ────────────────────────────────────────────

  async function handleAssignOrphans(backlogIds, resultadoId) {
    const resultado = rows.find(r => r.id === resultadoId)
    if (!resultado) return
    setRows(prev => prev.map(r => backlogIds.includes(r.id) ? { ...r, parent_id: resultadoId } : r))
    const promises = backlogIds.map(id => supabase.from(TABLE).update({ parent_id: resultadoId }).eq('id', id))
    const results = await Promise.all(promises)
    const failed = results.filter(r => r.error)
    if (failed.length > 0) { addToast(`${failed.length} backlogs no se pudieron asociar.`, 'error'); fetchRows() }
    else {
      addToast(`${backlogIds.length} backlogs asociados a "${resultado.accion}"`, 'success')
      await logAction('MODIFICAR', resultadoId, resultado.accion, `Asoció ${backlogIds.length} backlogs`)
    }
  }

  async function handleAddBacklog(parentId) {
    const parentRow = rows.find(r => r.id === parentId)
    if (!parentRow) return
    const data = {
      eje: parentRow.eje, tipo: parentRow.tipo, tema: parentRow.tema,
      accion: '', tipo_accion: 'Backlog', parent_id: parentId,
      fecha: null, responsable: '', status: 'Pendiente',
    }
    const { data: inserted, error } = await supabase.from(TABLE).insert([data]).select().single()
    if (error) { addToast('Error al agregar backlog.', 'error'); return }
    await logAction('AGREGAR', inserted.id, 'Nuevo backlog', `Backlog para "${parentRow.accion}"`)
  }

  async function handleAddRow(data) {
    let insertData = { ...data }
    if (data.sync_to_medios) {
      const { data: newTema, error: tErr } = await supabase
        .from('temas').insert([{ nombre: data.tema || data.accion, origen: 'editorial', eje: data.eje }]).select().single()
      if (!tErr && newTema) insertData.tema_id = newTema.id
    }
    const { data: inserted, error } = await supabase.from(TABLE).insert([insertData]).select().single()
    if (error) { addToast('Error al agregar la acción. Intenta nuevamente.', 'error'); return }
    await logAction('AGREGAR', inserted.id, data.accion, `Agregó "${data.accion}"`)
    setShowModal(false)
  }

  async function handleSyncToggle(rowId, enable) {
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    if (enable) {
      const { data: newTema, error: tErr } = await supabase
        .from('temas').insert([{ nombre: row.tema || row.accion, origen: 'editorial', eje: row.eje }]).select().single()
      if (tErr) { addToast('Error al vincular con Mesa de Medios.', 'error'); return }
      const updateData = { sync_to_medios: true, tema_id: newTema.id }
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...updateData } : r))
      const { error } = await supabase.from(TABLE).update(updateData).eq('id', rowId)
      if (error) { addToast('Error al guardar.', 'error'); fetchRows(); return }
      addToast('Vinculado con Mesa de Medios', 'success')
    } else {
      const updateData = { sync_to_medios: false }
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...updateData } : r))
      const { error } = await supabase.from(TABLE).update(updateData).eq('id', rowId)
      if (error) { addToast('Error al guardar.', 'error'); fetchRows(); return }
    }
    await logAction('MODIFICAR', rowId, row.accion, `sync_to_medios → ${enable}`)
  }

  async function handleCellChange(rowId, field, value) {
    const row = rows.find(r => r.id === rowId)
    if (!row || row[field] === value) return

    // Auto-archivar al marcar como Completado en tab activo
    if (field === 'status' && value === 'Completado' && !row.archived) {
      await handleInitiateArchive(rowId, row)
      return
    }

    const updateData = { [field]: value }
    if (field === 'status' && row.status === 'Completado' && value !== 'Completado') {
      updateData.completed_at = null
    }
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...updateData } : r))
    const { error } = await supabase.from(TABLE).update(updateData).eq('id', rowId)
    if (error) { addToast('Error al guardar. Los datos se recargarán.', 'error'); fetchRows(); return }
    await logAction('MODIFICAR', rowId, row.accion, `"${field}" → "${value}"`)
  }

  function requestDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    const children = rows.filter(r => r.parent_id === rowId)
    setConfirmDelete({ id: rowId, nombre: row?.accion || 'esta acción', childCount: children.length })
  }

  async function handleDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId)
    const children = rows.filter(r => r.parent_id === rowId)
    const childIds = children.map(c => c.id)
    setRows(prev => prev.filter(r => r.id !== rowId && !childIds.includes(r.id)))
    if (childIds.length > 0) await supabase.from(TABLE).delete().in('id', childIds)
    const { error } = await supabase.from(TABLE).delete().eq('id', rowId)
    if (error) { addToast('Error al eliminar.', 'error'); fetchRows(); return }
    await logAction('ELIMINAR', rowId, row?.accion, `Eliminó "${row?.accion}"`)
    addToast(`"${row?.accion || 'Acción'}" eliminada`, 'success')
  }

  function switchTab(tab) {
    setActiveTab(tab)
    setFilterInput('')
    setFilterEje('all')
    setFilterStatus('all')
    setFilterTipoAccion('all')
    setExplorerFilter(null)
  }

  return (
    <div className="app app-editorial">
      <HeaderEditorial
        userName={userName}
        userEmail={session.user.email}
        onLogout={onLogout}
        onBackToSelector={onBackToSelector}
        onShowLogs={() => setShowLogs(true)}
        onShowProfile={() => setShowProfile(true)}
        onSwitchDashboard={onSwitchDashboard}
        otherDashboardName={otherDashboardName}
      />

      {/* ── Tabs Activas / Archivadas ── */}
      <div className="editorial-tabs">
        <button
          className={`tab-btn${activeTab === 'active' ? ' tab-active' : ''}`}
          onClick={() => switchTab('active')}
        >
          <span className="tab-dot" />
          Activas
          <span className="tab-badge">{activeCount}</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'archived' ? ' tab-active' : ''}`}
          onClick={() => switchTab('archived')}
        >
          Archivadas
          <span className="tab-badge">{archivedCount}</span>
        </button>
      </div>

      {/* ── KPI Bar ── */}
      <div className={`editorial-kpi-bar${activeTab === 'archived' ? ' kpi-bar-archived' : ''}`}>
        {kpi.mode === 'archived' ? (
          <>
            <span className="kpi-item"><strong>{kpi.total}</strong> archivadas</span>
            <span className="kpi-dot" style={{ background: '#94a3b8' }} />
            <span className="kpi-item"><strong>{kpi.estesMes}</strong> este mes</span>
            <span className="kpi-dot" style={{ background: '#94a3b8' }} />
            <span className="kpi-item"><strong>{kpi.esteAno}</strong> este año</span>
            <span className="kpi-sep" />
            <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '.04em' }}>historial</span>
          </>
        ) : (
          <>
            <span className="kpi-item"><strong>{kpi.total}</strong> acciones</span>
            <span className="kpi-dot" style={{ background: '#16A34A' }} />
            <span className="kpi-item"><strong>{kpi.completadas}</strong> completadas</span>
            <span className="kpi-dot" style={{ background: '#D97706' }} />
            <span className="kpi-item"><strong>{kpi.enDesarrollo}</strong> en desarrollo</span>
            <span className="kpi-dot" style={{ background: '#DC2626' }} />
            <span className="kpi-item"><strong>{kpi.pendientes}</strong> pendientes</span>
            <span className="kpi-sep" />
            <span className="kpi-pct"><strong>{kpi.pct}%</strong> avance</span>
            <button className="btn-explorer" onClick={() => setShowExplorer(true)} title="Explorar por eje y tema">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M2 7h10M2 10h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Explorar
            </button>
            <button className="btn-add btn-add-sm" onClick={() => setShowModal(true)}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Nueva acción
            </button>
          </>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="editorial-filter-bar">
        <div className="editorial-filter-row">
          <div className="filter-search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder={activeTab === 'archived' ? 'Buscar en archivadas...' : 'Buscar tema, acción, responsable...'}
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
          {activeTab === 'active' && (
            <button className="sort-btn"
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc')}
              title={sortDir === 'asc' ? 'Más antigua primero' : sortDir === 'desc' ? 'Más reciente primero' : 'Ordenar por fecha'}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M4 4l3-2.5L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sortDir === 'asc' ? 1 : 0.3 }} />
                <path d="M4 10l3 2.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sortDir === 'desc' ? 1 : 0.3 }} />
              </svg>
              <span>Fecha</span>
            </button>
          )}
        </div>

        <div className="editorial-filter-pills-row">
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

          {activeTab === 'active' && (
            <>
              <div className="filter-pills-divider" />
              <div className="filter-pills">
                {['all', 'Pendiente', 'En desarrollo', 'Completado'].map(s => (
                  <button key={s} className={`pill ${filterStatus === s ? 'pill-active' : ''}`}
                    onClick={() => setFilterStatus(s)}>
                    {s === 'all' ? 'Todos los status' : s}
                  </button>
                ))}
              </div>
              <div className="filter-pills-divider" />
              <div className="filter-pills">
                {['all', 'Backlog', 'Resultado'].map(t => (
                  <button key={t} className={`pill ${filterTipoAccion === t ? 'pill-active' : ''}`}
                    onClick={() => setFilterTipoAccion(t)}>
                    {t === 'all' ? 'Todos los tipos' : t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {activeTab === 'active' && explorerFilter && (
        <div className="explorer-active-filter">
          <span>Filtrando: {explorerFilter.eje}{explorerFilter.tema ? ` › ${explorerFilter.tema}` : ''}</span>
          <button onClick={() => setExplorerFilter(null)}>✕</button>
        </div>
      )}

      {loading && <div className="loading-state"><div className="spinner" /><span>Cargando acciones...</span></div>}
      {error && <div className="error-state"><strong>Error de conexión:</strong> {error}</div>}

      {!loading && !error && (
        <>
          <div className="desktop-only">
            <EditorialTable
              rows={displayRows}
              onCellChange={handleCellChange}
              onDeleteRow={requestDeleteRow}
              onAddBacklog={handleAddBacklog}
              onAssignOrphans={handleAssignOrphans}
              onSyncToggle={handleSyncToggle}
              onReactivate={requestReactivate}
              isArchived={activeTab === 'archived'}
              totalRows={activeTab === 'archived' ? archivedCount : activeCount}
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
              totalRows={activeTab === 'archived' ? archivedCount : activeCount}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal(true)}
            />
          </div>
          {activeTab === 'active' && (
            <div className="shortcuts-hint desktop-only">
              <span><kbd>Esc</kbd> cerrar</span><span>·</span>
              <span><kbd>Ctrl+K</kbd> buscar</span><span>·</span>
              <span><kbd>N</kbd> nueva acción</span>
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {showModal && (
        <AddActionModal
          onConfirm={handleAddRow}
          onClose={() => { setShowModal(false); setPrefilledAction(null) }}
          existingResponsables={[...new Set(rows.map(r => r.responsable).filter(Boolean))]}
          existingTemas={[...new Set(rows.map(r => r.tema).filter(Boolean))]}
          prefilled={prefilledAction}
        />
      )}
      {showExplorer && (
        <ExplorerSidebar
          rows={rows}
          onClose={() => { setShowExplorer(false); setExplorerFilter(null) }}
          onFilter={(filter) => { setExplorerFilter(filter); setShowExplorer(false) }}
          onAddAction={({ eje, tema }) => {
            setShowExplorer(false)
            setPrefilledAction({ eje, tema })
            setShowModal(true)
          }}
        />
      )}
      {showLogs && <AuditLogPanel onClose={() => setShowLogs(false)} mesaType="editorial" />}
      {showProfile && <UserProfilePanel userEmail={session.user.email} userName={userName} onClose={() => setShowProfile(false)} />}

      {/* Confirmar eliminar */}
      {confirmDelete && (
        <ConfirmDialog
          nombre={confirmDelete.nombre}
          body={confirmDelete.childCount > 0
            ? `¿Eliminar Resultado "${confirmDelete.nombre}" y sus ${confirmDelete.childCount} backlog${confirmDelete.childCount === 1 ? '' : 's'} asociados?\nEsta acción no se puede deshacer.`
            : `¿Eliminar "${confirmDelete.nombre}"?\nEsta acción no se puede deshacer.`
          }
          onConfirm={() => { handleDeleteRow(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Confirmar archivar Resultado con backlogs pendientes */}
      {confirmArchive && (
        <ConfirmDialog
          title="¿Archivar resultado con backlogs pendientes?"
          body={`Este resultado tiene ${confirmArchive.pendingChildCount} backlog${confirmArchive.pendingChildCount !== 1 ? 's' : ''} sin completar. Al archivar, todos se marcarán como "Completado" y quedarán archivados junto con el resultado.\n\n¿Continuar?`}
          confirmLabel="Sí, archivar todo"
          confirmClass="btn-confirm-action"
          onConfirm={() => { handleDoArchive(confirmArchive.id, true); setConfirmArchive(null) }}
          onCancel={() => setConfirmArchive(null)}
        />
      )}

      {/* Confirmar reactivar */}
      {confirmReactivate && (
        <ConfirmDialog
          title="¿Reactivar esta acción?"
          body={confirmReactivate.tipo === 'Resultado'
            ? `"${confirmReactivate.nombre}" volverá al flujo activo con status "En desarrollo".\n\nSus backlogs archivados permanecerán en Archivadas hasta que los reactives individualmente.`
            : `"${confirmReactivate.nombre}" volverá al flujo activo con status "En desarrollo".`
          }
          confirmLabel="Reactivar"
          confirmClass="btn-confirm-action"
          onConfirm={() => handleReactivate(confirmReactivate.id)}
          onCancel={() => setConfirmReactivate(null)}
        />
      )}

      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
