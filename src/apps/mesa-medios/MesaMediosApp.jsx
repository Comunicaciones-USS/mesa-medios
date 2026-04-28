import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
import { logAuditEntry } from '../shared/utils/audit'
import BottomSheet from '../shared/components/BottomSheet'
import ExportModal from '../shared/components/ExportModal'
import { generateMediosExcel } from '../shared/utils/excelExportMedios'

export default function MesaMediosApp({ session, userName, onLogout, onBackToSelector, onSwitchDashboard, otherDashboardName }) {
  const [temas,            setTemas]            = useState([])
  const temasRef = useRef([])
  useEffect(() => { temasRef.current = temas }, [temas])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  // showModal: null | 'new' | { temaId, temaNombre, existingDates[] }
  const [showModal,        setShowModal]        = useState(null)
  const [showLogs,         setShowLogs]         = useState(false)
  const [showProfile,      setShowProfile]      = useState(false)
  const [confirmDelete,    setConfirmDelete]    = useState(null)
  const [confirmArchive,   setConfirmArchive]   = useState(null) // { id, nombre, n }
  const [confirmReactivate,setConfirmReactivate]= useState(null) // { id, nombre }
  const [filterInput,      setFilterInput]      = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [sortDir,          setSortDir]          = useState('asc')
  const { toasts, addToast, removeToast } = useToast()

  // Tabs
  const [activeTab, setActiveTab] = useState('active')

  // Filtros verticales
  const [filterDateRange, setFilterDateRange] = useState({ from: '', to: '' })

  // Filtros horizontales
  const [filterGroup,      setFilterGroup]      = useState('all')
  const [filterCellStatus, setFilterCellStatus] = useState('all')

  // Collapsed column groups
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  // Sticky toolbar measurement
  const filterBarRef = useRef(null)

  // Expanded temas
  const [expandedTemas, setExpandedTemas] = useState(new Set())

  // Mobile filters sheet
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  // Tab switch — resetea todos los filtros
  function switchTab(tab) {
    setActiveTab(tab)
    setFilterInput('')
    setFilterGroup('all')
    setFilterCellStatus('all')
    setFilterDateRange({ from: '', to: '' })
    setExpandedTemas(new Set())
  }

  const toggleGroup = useCallback((groupId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const toggleTema = useCallback((temaId) => {
    setExpandedTemas(prev => {
      const next = new Set(prev)
      if (next.has(temaId)) next.delete(temaId)
      else next.add(temaId)
      return next
    })
  }, [])

  // Set --above-table CSS var so .table-scroll height stays within viewport
  useEffect(() => {
    const el = filterBarRef.current
    if (!el) return
    let rafId = null
    let debounceTimer = null
    function measure() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const headerEl = document.querySelector('.header')
        const headerH = headerEl ? headerEl.getBoundingClientRect().height : 68
        const total = headerH + el.getBoundingClientRect().height
        document.documentElement.style.setProperty('--above-table', `${Math.round(total)}px`)
        rafId = null
      })
    }
    function debouncedMeasure() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(measure, 100)
    }
    measure()
    const ro = new ResizeObserver(debouncedMeasure)
    ro.observe(el)
    const headerEl = document.querySelector('.header')
    if (headerEl) ro.observe(headerEl)
    return () => {
      ro.disconnect()
      clearTimeout(debounceTimer)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

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
        if (showExportModal)  { setShowExportModal(false);  return }
        if (showProfile)      { setShowProfile(false);      return }
        if (confirmArchive)   { setConfirmArchive(null);    return }
        if (confirmReactivate){ setConfirmReactivate(null); return }
        if (confirmDelete)    { setConfirmDelete(null);     return }
        if (showModal)        { setShowModal(null);         return }
        if (showLogs)         { setShowLogs(false);         return }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.filter-input')?.focus()
        return
      }
      if (e.key.toLowerCase() === 'n' && !inInput && !showModal && !showLogs && !confirmDelete && !confirmArchive && !confirmReactivate) {
        setShowModal('new')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmDelete, confirmArchive, confirmReactivate, showModal, showLogs, showExportModal])

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
    setExpandedTemas(new Set())
    setLoading(false)
  }

  const logAction = useCallback(async (accion, contenidoId, contenidoNombre, detalle = '') => {
    if (!session) return
    const actionMap = { AGREGAR: 'create', MODIFICAR: 'update', ELIMINAR: 'delete', ARCHIVAR: 'update', REACTIVAR: 'update' }
    await logAuditEntry(supabase, {
      mesa_type:  'medios',
      user_email: session.user.email,
      action:     actionMap[accion] || accion.toLowerCase(),
      table_name: 'temas',
      record_id:  contenidoId || null,
      details:    { content_name: contenidoNombre || null, description: detalle || null },
    })
  }, [session])

  const displayTemas = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    let result = temas
      .filter(t => activeTab === 'active' ? !t.archived : t.archived)
      .map(tema => {
        let planifs = [...tema.planificaciones]

        if (activeTab === 'active') {
          // Filtro por rango de fecha sobre planificaciones (solo tab Activos)
          if (filterDateRange.from) planifs = planifs.filter(p => p.semana && p.semana >= filterDateRange.from)
          if (filterDateRange.to)   planifs = planifs.filter(p => p.semana && p.semana <= filterDateRange.to)

          // Filtro por estado de celda sobre planificaciones (solo tab Activos)
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
        } else {
          // Tab Archivados: filtro por rango de archived_at si hay filtro activo
          if (filterDateRange.from && tema.archived_at) {
            if (tema.archived_at.slice(0, 10) < filterDateRange.from) return null
          }
          if (filterDateRange.to && tema.archived_at) {
            if (tema.archived_at.slice(0, 10) > filterDateRange.to) return null
          }
        }

        // Ordenar planificaciones: futuras primero (ascendente), luego pasadas (ascendente)
        planifs.sort((a, b) => {
          if (!a.semana && !b.semana) return 0
          if (!a.semana) return 1
          if (!b.semana) return -1
          const aFuture = a.semana >= todayStr
          const bFuture = b.semana >= todayStr
          if (aFuture && !bFuture) return -1
          if (!aFuture && bFuture) return 1
          return a.semana.localeCompare(b.semana)
        })
        return { ...tema, planificaciones: planifs }
      })
      .filter(Boolean)

    // Filtro de texto sobre nombre del tema (ambas tabs)
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      result = result.filter(t => t.nombre?.toLowerCase().includes(q))
    }

    // Si hay filtros de planificacion activos en tab Activos, ocultar temas sin resultados
    if (activeTab === 'active' && (filterDateRange.from || filterDateRange.to || filterCellStatus !== 'all')) {
      result = result.filter(t => t.planificaciones.length > 0)
    }

    // Ordenar temas
    if (activeTab === 'archived') {
      result = [...result].sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''))
    } else {
      // Clave de ordenamiento: fecha futura más próxima; si todas son pasadas, la más reciente pasada; null al final
      const getKey = (tema) => {
        if (tema.planificaciones.length === 0) return null
        const nearestFuture = tema.planificaciones.find(p => p.semana && p.semana >= todayStr)
        if (nearestFuture) return nearestFuture.semana
        const withDate = tema.planificaciones.filter(p => p.semana)
        return withDate.length > 0 ? withDate[withDate.length - 1].semana : null
      }
      result = [...result].sort((a, b) => {
        const kA = getKey(a), kB = getKey(b)
        if (kA === null && kB === null) return 0
        if (kA === null) return 1
        if (kB === null) return -1
        const aFuture = kA >= todayStr
        const bFuture = kB >= todayStr
        if (aFuture !== bFuture) {
          const res = aFuture ? -1 : 1
          return sortDir === 'desc' ? -res : res
        }
        const cmp = kA.localeCompare(kB)
        return sortDir === 'desc' ? -cmp : cmp
      })
    }

    return result
  }, [temas, activeTab, filterText, sortDir, filterDateRange, filterGroup, filterCellStatus])

  const visibleCols = useMemo(() => {
    if (filterGroup === 'all') return MEDIA_COLS
    return MEDIA_COLS.filter(c => c.group === filterGroup)
  }, [filterGroup])

  // Contadores para badges de tabs
  const activeCount   = useMemo(() => temas.filter(t => !t.archived).length, [temas])
  const archivedCount = useMemo(() => temas.filter(t =>  t.archived).length, [temas])

  const exportItems = useMemo(() =>
    temas
      .filter(t => !t.archived)
      .map(t => ({
        id:   t.id,
        name: t.nombre || '(sin nombre)',
        meta: `${t.planificaciones.length} fecha${t.planificaciones.length !== 1 ? 's' : ''}`,
      })),
    [temas]
  )

  const exportPreselected = useMemo(() =>
    new Set(displayTemas.map(t => t.id)),
    [displayTemas]
  )

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
  const handleCellChange = useCallback(async (planifId, colId, value, notas) => {
    let planif = null
    let tema = null
    for (const t of temasRef.current) {
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
  }, [addToast, logAction])

  // handleFieldChange: edita campo de planificación (p.ej. semana)
  const handleFieldChange = useCallback(async (planifId, field, value) => {
    let tema = null
    for (const t of temasRef.current) {
      if (t.planificaciones.some(p => p.id === planifId)) { tema = t; break }
    }
    setTemas(prev => prev.map(t => t.id === tema?.id ? {
      ...t,
      planificaciones: t.planificaciones.map(p => p.id === planifId ? { ...p, [field]: value } : p)
    } : t))
    const { error } = await supabase.from('contenidos').update({ [field]: value }).eq('id', planifId)
    if (error) { addToast('Error al guardar el campo. Los datos se recargarán.', 'error'); fetchData(); return }
    await logAction('MODIFICAR', planifId, tema?.nombre, `Cambió "${field}" → "${value}"`)
  }, [addToast, logAction])

  const requestDeleteRow = useCallback((planifId) => {
    let nombre = 'planificación'
    for (const t of temasRef.current) {
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
  }, [])

  const requestDeleteTema = useCallback((temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    setConfirmDelete({
      type: 'tema',
      id: temaId,
      nombre: tema.nombre || 'Sin nombre',
      n: tema.planificaciones.length,
      fromEditorial: tema.origen === 'editorial',
    })
  }, [])

  const handleDeleteRow = useCallback(async (planifId) => {
    let tema = null
    for (const t of temasRef.current) {
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
  }, [addToast, logAction])

  const handleDeleteTema = useCallback(async (temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    const { error } = await supabase.from('temas').delete().eq('id', temaId)
    if (error) { addToast('Error al eliminar el tema.', 'error'); return }
    setTemas(prev => prev.filter(t => t.id !== temaId))
    await logAction('ELIMINAR', temaId, tema?.nombre, 'Eliminó tema completo')
  }, [addToast, logAction])

  const handleRenameTema = useCallback(async (temaId, nombre) => {
    setTemas(prev => prev.map(t => t.id === temaId ? { ...t, nombre } : t))
    const { error } = await supabase.from('temas').update({ nombre }).eq('id', temaId)
    if (error) { addToast('Error al renombrar el tema.', 'error'); fetchData(); return }
    await logAction('MODIFICAR', temaId, nombre, `Renombró tema → "${nombre}"`)
  }, [addToast, logAction])

  const handleOpenAddPlanificacion = useCallback((temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    setShowModal({
      temaId: tema.id,
      temaNombre: tema.nombre,
      existingDates: tema.planificaciones.map(p => p.semana).filter(Boolean),
    })
  }, [])

  // ── Archivar tema ──────────────────────────────────────────────
  const requestArchiveTema = useCallback((temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    setConfirmArchive({ id: temaId, nombre: tema.nombre || 'Sin nombre', n: tema.planificaciones.length })
  }, [])

  const handleDoArchiveTema = useCallback(async () => {
    if (!confirmArchive) return
    const { id, nombre } = confirmArchive
    const now = new Date().toISOString()
    const { error } = await supabase.from('temas').update({ archived: true, archived_at: now }).eq('id', id)
    if (error) { addToast('Error al archivar el tema.', 'error'); return }
    setTemas(prev => prev.map(t => t.id === id ? { ...t, archived: true, archived_at: now } : t))
    setConfirmArchive(null)
    await logAction('ARCHIVAR', id, nombre, `Archivó tema "${nombre}"`)
    addToast(`"${nombre}" archivado.`, 'success')
  }, [confirmArchive, addToast, logAction])

  // ── Reactivar tema ─────────────────────────────────────────────
  const requestReactivateTema = useCallback((temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    setConfirmReactivate({ id: temaId, nombre: tema.nombre || 'Sin nombre' })
  }, [])

  const handleDoReactivateTema = useCallback(async () => {
    if (!confirmReactivate) return
    const { id, nombre } = confirmReactivate
    const { error } = await supabase.from('temas').update({ archived: false, archived_at: null }).eq('id', id)
    if (error) { addToast('Error al reactivar el tema.', 'error'); return }
    setTemas(prev => prev.map(t => t.id === id ? { ...t, archived: false, archived_at: null } : t))
    setConfirmReactivate(null)
    await logAction('REACTIVAR', id, nombre, `Reactivó tema "${nombre}"`)
    addToast(`"${nombre}" reactivado y visible en Activos.`, 'success')
  }, [confirmReactivate, addToast, logAction])

  function handleExport(selectedIds) {
    try {
      generateMediosExcel({ temas, selectedIds, userName })
      setShowExportModal(false)
      addToast('Reporte exportado correctamente.', 'success')
    } catch (err) {
      console.error('Error generando Excel:', err)
      addToast('No se pudo generar el reporte. Intenta nuevamente.', 'error')
    }
  }

  const hasActiveFilters = filterInput || filterGroup !== 'all' || filterCellStatus !== 'all' || filterDateRange.from || filterDateRange.to
  const totalPlanifs = temas.filter(t => !t.archived).reduce((acc, t) => acc + t.planificaciones.length, 0)
  const displayPlanifs = displayTemas.reduce((acc, t) => acc + t.planificaciones.length, 0)

  const mobileActiveFilterCount = [
    filterGroup !== 'all',
    filterCellStatus !== 'all',
    filterDateRange.from || filterDateRange.to,
  ].filter(Boolean).length

  // ── Tabs UI (compartido entre desktop y mobile) ────────────────
  function TabsBar() {
    return (
      <div className="medios-tabs">
        <button
          className={`tab-btn${activeTab === 'active' ? ' tab-active' : ''}`}
          onClick={() => switchTab('active')}
        >
          <span className="tab-dot tab-dot-active" />
          Activos
          <span className="tab-badge">{activeCount}</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'archived' ? ' tab-active' : ''}`}
          onClick={() => switchTab('archived')}
        >
          Archivados
          <span className="tab-badge">{archivedCount}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="mm-mobile-header-wrap">
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
        {/* Mobile: tabs */}
        <div className="medios-tabs medios-tabs-mobile">
          <button
            className={`tab-btn${activeTab === 'active' ? ' tab-active' : ''}`}
            onClick={() => switchTab('active')}
          >
            <span className="tab-dot tab-dot-active" />
            Activos
            <span className="tab-badge">{activeCount}</span>
          </button>
          <button
            className={`tab-btn${activeTab === 'archived' ? ' tab-active' : ''}`}
            onClick={() => switchTab('archived')}
          >
            Archivados
            <span className="tab-badge">{archivedCount}</span>
          </button>
        </div>
        {/* Mobile: línea única de acción (search + filtros + añadir) */}
        <div className="mobile-action-line">
          <div className="mobile-search-wrap">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={filterInput}
              onChange={e => setFilterInput(e.target.value)}
              className="filter-input mobile-search-input"
            />
            {filterInput && (
              <button className="filter-clear" onClick={() => setFilterInput('')}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          {activeTab === 'active' && (
            <>
              <button className="mobile-filter-btn" onClick={() => setShowMobileFilters(true)}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M1 3h13M3 7h9M5 11h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>Filtros</span>
                {mobileActiveFilterCount > 0 && (
                  <span className="mobile-filter-badge">{mobileActiveFilterCount}</span>
                )}
              </button>
              <button className="mobile-add-btn" onClick={() => setShowModal('new')} aria-label="Agregar tema">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="medios-filter-bar" ref={filterBarRef}>
        {/* Tabs (desktop) */}
        <div className="medios-tabs medios-tabs-desktop">
          <button
            className={`tab-btn${activeTab === 'active' ? ' tab-active' : ''}`}
            onClick={() => switchTab('active')}
          >
            <span className="tab-dot tab-dot-active" />
            Activos
            <span className="tab-badge">{activeCount}</span>
          </button>
          <button
            className={`tab-btn${activeTab === 'archived' ? ' tab-active' : ''}`}
            onClick={() => switchTab('archived')}
          >
            Archivados
            <span className="tab-badge">{archivedCount}</span>
          </button>
        </div>

        {activeTab === 'active' ? (
          <>
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
              <button
                className="btn-export"
                onClick={() => setShowExportModal(true)}
                title="Exportar reporte ejecutivo"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M6.5 1v8M3.5 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 10v1a1 1 0 001 1h9a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                Exportar
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
                <span className="filter-count">{displayTemas.length} de {activeCount} temas · {displayPlanifs} de {totalPlanifs} fechas</span>
                {filterGroup !== 'all' && <span className="filter-count"> · {visibleCols.length} columnas</span>}
                <button className="filter-reset" onClick={() => { setFilterInput(''); setFilterGroup('all'); setFilterCellStatus('all'); setFilterDateRange({ from: '', to: '' }) }}>Limpiar filtros</button>
              </div>
            )}
          </>
        ) : (
          /* Tab Archivados: solo búsqueda + rango de fecha de archivado */
          <div className="medios-filter-row medios-filter-row-archived">
            <div className="filter-search">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Buscar temas archivados..." value={filterInput}
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
              <span className="filter-date-label">Archivado:</span>
              <input type="date" value={filterDateRange.from} onChange={e => setFilterDateRange(p => ({ ...p, from: e.target.value }))} className="filter-date-input" title="Desde" />
              <span className="filter-date-sep">→</span>
              <input type="date" value={filterDateRange.to} onChange={e => setFilterDateRange(p => ({ ...p, to: e.target.value }))} className="filter-date-input" title="Hasta" />
              {(filterDateRange.from || filterDateRange.to) && (
                <button className="filter-clear-sm" onClick={() => setFilterDateRange({ from: '', to: '' })}>✕</button>
              )}
            </div>
            {hasActiveFilters && (
              <button className="filter-reset" onClick={() => { setFilterInput(''); setFilterDateRange({ from: '', to: '' }) }}>Limpiar</button>
            )}
          </div>
        )}
      </div>

      <main id="main-content">
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
              onArchiveTema={requestArchiveTema}
              onReactivateTema={requestReactivateTema}
              isArchived={activeTab === 'archived'}
              totalTemas={activeTab === 'active' ? activeCount : archivedCount}
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
              onArchiveTema={requestArchiveTema}
              onReactivateTema={requestReactivateTema}
              isArchived={activeTab === 'archived'}
              totalTemas={activeTab === 'active' ? activeCount : archivedCount}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal('new')}
            />
          </div>
          {activeTab === 'active' && (
            <div className="shortcuts-hint desktop-only">
              <span><kbd>Esc</kbd> cerrar</span><span>·</span>
              <span><kbd>Ctrl+K</kbd> buscar</span><span>·</span>
              <span><kbd>N</kbd> nuevo</span>
            </div>
          )}
        </>
      )}

      </main>

      {/* Modales */}
      {activeTab === 'active' && showModal === 'new' && (
        <AddRowModal
          temas={temas.filter(t => !t.archived)}
          onConfirm={handleAddRow}
          onClose={() => setShowModal(null)}
        />
      )}
      {activeTab === 'active' && showModal && typeof showModal === 'object' && (
        <AddRowModal
          prefillTema={{ id: showModal.temaId, nombre: showModal.temaNombre }}
          existingDates={showModal.existingDates}
          onConfirm={handleAddRow}
          onClose={() => setShowModal(null)}
        />
      )}
      {showLogs && <AuditLogPanel onClose={() => setShowLogs(false)} mesaType="medios" />}
      {showProfile && <UserProfilePanel userEmail={session.user.email} userName={userName} onClose={() => setShowProfile(false)} />}

      {/* Confirm: eliminar planificación / tema */}
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
          confirmLabel={confirmDelete.type === 'tema' ? 'Sí, eliminar' : 'Eliminar'}
          onConfirm={() => {
            if (confirmDelete.type === 'tema') handleDeleteTema(confirmDelete.id)
            else handleDeleteRow(confirmDelete.id)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Confirm: archivar tema */}
      {confirmArchive && (
        <ConfirmDialog
          title={`¿Archivar el tema "${confirmArchive.nombre}"?`}
          body={`Sus ${confirmArchive.n === 0 ? 'datos quedarán' : confirmArchive.n === 1 ? '1 planificación quedará' : `${confirmArchive.n} planificaciones quedarán`} como histórico consultable en la pestaña Archivados. Puedes reactivarlo en cualquier momento.`}
          confirmLabel="Archivar"
          confirmClass="btn-confirm-action"
          onConfirm={handleDoArchiveTema}
          onCancel={() => setConfirmArchive(null)}
        />
      )}

      {/* Confirm: reactivar tema */}
      {confirmReactivate && (
        <ConfirmDialog
          title={`¿Reactivar el tema "${confirmReactivate.nombre}"?`}
          body="Volverá a la pestaña Activos con todas sus planificaciones."
          confirmLabel="Reactivar"
          confirmClass="btn-confirm-action"
          onConfirm={handleDoReactivateTema}
          onCancel={() => setConfirmReactivate(null)}
        />
      )}

      {showExportModal && activeTab === 'active' && (
        <ExportModal
          title="Exportar reporte ejecutivo"
          items={exportItems}
          preselected={exportPreselected}
          onGenerate={handleExport}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Mobile: filtros en bottom sheet (solo tab Activos) */}
      {activeTab === 'active' && (
        <BottomSheet
          isOpen={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          title="Filtros"
          onApply={() => setShowMobileFilters(false)}
          applyLabel={`Aplicar filtros (${displayTemas.length} ${displayTemas.length === 1 ? 'tema' : 'temas'})`}
        >
          <div className="sheet-clear-row">
            <button className="sheet-clear-btn" onClick={() => { setFilterGroup('all'); setFilterCellStatus('all'); setFilterDateRange({ from: '', to: '' }) }}>
              Limpiar todo
            </button>
          </div>
          <div className="sheet-filter-group">
            <p className="sheet-filter-label">GRUPO DE MEDIOS</p>
            <div className="sheet-pills">
              <button className={`sheet-pill${filterGroup === 'all' ? ' sheet-pill-active' : ''}`} onClick={() => setFilterGroup('all')}>Todos</button>
              {GROUPS.map(g => (
                <button
                  key={g.id}
                  className={`sheet-pill${filterGroup === g.id ? ' sheet-pill-active' : ''}`}
                  onClick={() => setFilterGroup(filterGroup === g.id ? 'all' : g.id)}
                >{g.label}</button>
              ))}
            </div>
          </div>
          <div className="sheet-filter-group">
            <p className="sheet-filter-label">ESTADO DE CELDA</p>
            <div className="sheet-pills">
              {[
                { value: 'all',   label: 'Todas' },
                { value: 'si',    label: 'Confirmado' },
                { value: 'pd',    label: 'Por definir' },
                { value: 'no',    label: 'No aplica' },
                { value: 'empty', label: 'Vacías' },
              ].map(f => (
                <button
                  key={f.value}
                  className={`sheet-pill${filterCellStatus === f.value ? ' sheet-pill-active' : ''}`}
                  onClick={() => setFilterCellStatus(f.value)}
                >{f.label}</button>
              ))}
            </div>
          </div>
          <div className="sheet-filter-group">
            <p className="sheet-filter-label">RANGO DE FECHAS</p>
            <div className="sheet-date-range">
              <input type="date" value={filterDateRange.from} onChange={e => setFilterDateRange(p => ({ ...p, from: e.target.value }))} className="sheet-date-input" />
              <span className="sheet-date-sep">→</span>
              <input type="date" value={filterDateRange.to} onChange={e => setFilterDateRange(p => ({ ...p, to: e.target.value }))} className="sheet-date-input" />
            </div>
          </div>
        </BottomSheet>
      )}

      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
