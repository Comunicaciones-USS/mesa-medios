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
import SheetButtons from '../shared/components/SheetButtons'

export default function MesaMediosApp({ session, userName, onLogout, onBackToSelector, onSwitchDashboard, otherDashboardName }) {
  const [temas,            setTemas]            = useState([])
  const temasRef = useRef([])
  useEffect(() => { temasRef.current = temas }, [temas])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  // showModal: null | 'new' | { temaId, temaNombre, existingDates[] } | { mode: 'add-subtema', parentId, parentNombre } | { mode: 'edit-subtema', subtemaId, subtemaNombre, fechaInicioInit, fechaTerminoInit, parentNombre }
  const [showModal,        setShowModal]        = useState(null)
  const [showLogs,         setShowLogs]         = useState(false)
  const [showProfile,      setShowProfile]      = useState(false)
  const [confirmDelete,    setConfirmDelete]    = useState(null)
  const [confirmArchive,   setConfirmArchive]   = useState(null) // { id, nombre, n, subtemaCount }
  const [confirmReactivate,setConfirmReactivate]= useState(null) // { id, nombre }
  const [confirmStatusComplete, setConfirmStatusComplete] = useState(null) // { id, nombre }
  const [filterInput,      setFilterInput]      = useState('')
  const filterText = useDebounce(filterInput, 300)
  const [sortDir,          setSortDir]          = useState('asc')
  const { toasts, addToast, removeToast } = useToast()

  // Tabs
  const [activeTab, setActiveTab] = useState('active')

  // Filtros verticales
  const [filterDateRange, setFilterDateRange] = useState({ from: '', to: '' })
  // Tarea 6: toggle para incluir subtemas con rango en el período filtrado
  const [filterIncludeSubtemaRange, setFilterIncludeSubtemaRange] = useState(false)

  // Filtros horizontales
  const [filterGroup,      setFilterGroup]      = useState('all')
  const [filterCellStatus, setFilterCellStatus] = useState('all')
  const [activeColumnFilters, setActiveColumnFilters] = useState(new Set())

  // Collapsed column groups
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  // Sticky toolbar measurement
  const filterBarRef = useRef(null)

  // Expanded temas
  const [expandedTemas, setExpandedTemas] = useState(new Set())

  // Mobile filters sheet
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  // Header collapsible (Zona B)
  const [headerExpanded, setHeaderExpandedState] = useState(() => {
    try {
      const saved = localStorage.getItem('uss_medios_header_expanded')
      return saved === null ? true : saved === 'true'
    } catch { return true }
  })
  const setHeaderExpanded = useCallback((val) => {
    setHeaderExpandedState(val)
    try { localStorage.setItem('uss_medios_header_expanded', String(val)) } catch {}
  }, [])

  // Tab switch — resetea todos los filtros
  function switchTab(tab) {
    setActiveTab(tab)
    setFilterInput('')
    setFilterGroup('all')
    setFilterCellStatus('all')
    setFilterDateRange({ from: '', to: '' })
    setFilterIncludeSubtemaRange(false)
    setExpandedTemas(new Set())
    setActiveColumnFilters(new Set())
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

  const toggleColumnFilter = useCallback((colId) => {
    setActiveColumnFilters(prev => {
      const next = new Set(prev)
      if (next.has(colId)) {
        next.delete(colId)
      } else {
        next.add(colId)
        setFilterGroup('all')  // deactivate group filter when column filter activated
      }
      return next
    })
  }, [])

  const clearColumnFilters = useCallback(() => setActiveColumnFilters(new Set()), [])

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

  // ── Helper: buscar propietario de una planificación ──────────────
  // Retorna { padre, subtema|null, planif } buscando tanto en planificaciones
  // directas del padre como en planificaciones de cada subtema.
  function findPlanifOwner(planifId) {
    for (const padre of temasRef.current) {
      // Buscar en planificaciones directas del padre
      const directPlanif = padre.planificaciones_directas?.find(p => p.id === planifId)
        || padre.planificaciones?.find(p => p.id === planifId)
      if (directPlanif) {
        return { padre, subtema: null, planif: directPlanif }
      }
      // Buscar en planificaciones de subtemas
      for (const subtema of (padre.subtemas || [])) {
        const subPlanif = subtema.planificaciones?.find(p => p.id === planifId)
        if (subPlanif) {
          return { padre, subtema, planif: subPlanif }
        }
      }
    }
    return null
  }

  // ── Helper: construir árbol cliente desde arrays planos ──────────
  function buildTree(temasData, planifs, hitoMap) {
    const padres = temasData.filter(t => !t.parent_id)
    const hijos  = temasData.filter(t =>  t.parent_id)

    return padres.map(padre => {
      const subtemas = hijos
        .filter(h => h.parent_id === padre.id)
        .map(subtema => ({
          ...subtema,
          planificaciones: planifs.filter(p => p.tema_id === subtema.id),
        }))

      const planificaciones_directas = planifs.filter(p => p.tema_id === padre.id)
      // planificaciones para compatibilidad con los handlers legacy (incluye todo lo del padre)
      const planificaciones = planificaciones_directas

      return {
        ...padre,
        hito: hitoMap[padre.id] || null,
        subtemas,
        planificaciones,
        planificaciones_directas,
      }
    })
  }

  // Realtime subscriptions
  useEffect(() => {
    const chTemas = supabase
      .channel('temas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'temas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const nuevo = payload.new
          if (nuevo.parent_id) {
            // Es un subtema — colgarlo del padre correcto
            setTemas(prev => prev.map(t => {
              if (t.id === nuevo.parent_id) {
                return {
                  ...t,
                  subtemas: [...(t.subtemas || []), { ...nuevo, planificaciones: [] }],
                }
              }
              return t
            }))
          } else {
            // Es un padre nuevo
            setTemas(prev => [...prev, {
              ...nuevo,
              hito: null,
              subtemas: [],
              planificaciones: [],
              planificaciones_directas: [],
            }])
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new
          if (updated.parent_id) {
            // Subtema actualizado
            setTemas(prev => prev.map(t => ({
              ...t,
              subtemas: (t.subtemas || []).map(s => s.id === updated.id ? { ...s, ...updated } : s),
            })))
          } else {
            // Padre actualizado
            setTemas(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
          }
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old
          // Puede ser padre o subtema — intentar ambos
          setTemas(prev => prev
            .filter(t => t.id !== deleted.id) // eliminar si era padre
            .map(t => ({
              ...t,
              subtemas: (t.subtemas || []).filter(s => s.id !== deleted.id),
            }))
          )
        }
      })
      .subscribe()

    const chContenidos = supabase
      .channel('contenidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contenidos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const p = payload.new
          setTemas(prev => prev.map(padre => {
            // Verificar si pertenece a este padre directamente
            if (padre.id === p.tema_id) {
              const newPlanif = p
              return {
                ...padre,
                planificaciones: [...padre.planificaciones, newPlanif],
                planificaciones_directas: [...(padre.planificaciones_directas || []), newPlanif],
              }
            }
            // Verificar si pertenece a un subtema
            const subtemaMatch = (padre.subtemas || []).some(s => s.id === p.tema_id)
            if (subtemaMatch) {
              return {
                ...padre,
                subtemas: (padre.subtemas || []).map(s =>
                  s.id === p.tema_id
                    ? { ...s, planificaciones: [...(s.planificaciones || []), p] }
                    : s
                ),
              }
            }
            return padre
          }))
        } else if (payload.eventType === 'UPDATE') {
          setTemas(prev => prev.map(padre => {
            // Actualizar en planificaciones directas del padre
            const inDirect = (padre.planificaciones || []).some(pl => pl.id === payload.new.id)
            if (inDirect) {
              return {
                ...padre,
                planificaciones: padre.planificaciones.map(pl => pl.id === payload.new.id ? payload.new : pl),
                planificaciones_directas: (padre.planificaciones_directas || []).map(pl => pl.id === payload.new.id ? payload.new : pl),
              }
            }
            // Actualizar en subtemas
            const inSubtema = (padre.subtemas || []).some(s => (s.planificaciones || []).some(pl => pl.id === payload.new.id))
            if (inSubtema) {
              return {
                ...padre,
                subtemas: (padre.subtemas || []).map(s => ({
                  ...s,
                  planificaciones: (s.planificaciones || []).map(pl => pl.id === payload.new.id ? payload.new : pl),
                })),
              }
            }
            return padre
          }))
        } else if (payload.eventType === 'DELETE') {
          setTemas(prev => prev.map(padre => {
            return {
              ...padre,
              planificaciones: (padre.planificaciones || []).filter(pl => pl.id !== payload.old.id),
              planificaciones_directas: (padre.planificaciones_directas || []).filter(pl => pl.id !== payload.old.id),
              subtemas: (padre.subtemas || []).map(s => ({
                ...s,
                planificaciones: (s.planificaciones || []).filter(pl => pl.id !== payload.old.id),
              })),
            }
          }))
        }
      })
      .subscribe()

    fetchData()
    return () => {
      supabase.removeChannel(chTemas)
      supabase.removeChannel(chContenidos)
    }
  }, [])

  // Auto-expand temas when column filters are active
  useEffect(() => {
    if (activeColumnFilters.size > 0) {
      const activeColIds = [...activeColumnFilters]
      const padresExpand = new Set()

      temas.filter(t => !t.archived).forEach(padre => {
        // Verificar planificaciones directas
        const hasDirectMatch = padre.planificaciones.some(p =>
          activeColIds.some(colId => {
            const { valor } = getCellData(p.medios, colId)
            return valor && valor !== ''
          })
        )
        if (hasDirectMatch) {
          padresExpand.add(padre.id)
        }
        // Verificar subtemas (siempre visibles cuando el padre está expandido)
        ;(padre.subtemas || []).forEach(subtema => {
          const hasSubMatch = (subtema.planificaciones || []).some(p =>
            activeColIds.some(colId => {
              const { valor } = getCellData(p.medios, colId)
              return valor && valor !== ''
            })
          )
          if (hasSubMatch) {
            padresExpand.add(padre.id)
          }
        })
      })

      setExpandedTemas(padresExpand)
    }
  }, [activeColumnFilters, temas])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable
      if (e.key === 'Escape') {
        if (confirmStatusComplete){ setConfirmStatusComplete(null); return }
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
      if (e.key.toLowerCase() === 'n' && !inInput && !showModal && !showLogs && !confirmDelete && !confirmArchive && !confirmReactivate && !confirmStatusComplete) {
        setShowModal('new')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmDelete, confirmArchive, confirmReactivate, confirmStatusComplete, showModal, showLogs, showExportModal])

  // Fix 6: evalúa si temas con status 'Nuevo' siguen siendo válidos (< 7 días)
  // Si no lo son, los transiciona a 'En desarrollo' en BD de forma silenciosa
  async function checkAndTransitionStaleNew(temasList) {
    const now = new Date()
    // Solo transicionar padres (parent_id IS NULL)
    const staleNewIds = temasList
      .filter(t => !t.parent_id && t.status === 'Nuevo' && t.created_at)
      .filter(t => {
        const created = new Date(t.created_at)
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24))
        return days >= 7
      })
      .map(t => t.id)

    if (staleNewIds.length === 0) return

    // Batch update silencioso — no bloquea el render
    for (const id of staleNewIds) {
      supabase.from('temas').update({ status: 'En desarrollo' }).eq('id', id).then(() => {})
    }
    // Actualizar estado local inmediatamente
    setTemas(prev => prev.map(t =>
      staleNewIds.includes(t.id) ? { ...t, status: 'En desarrollo' } : t
    ))
  }

  async function fetchData() {
    setLoading(true)
    const [{ data: temasData, error: tErr }, { data: planifs, error: pErr }, { data: accionesData }] = await Promise.all([
      supabase.from('temas').select('*').order('nombre'),
      supabase.from('contenidos').select('*').order('semana').order('nombre'),
      // Traer hitos de acciones editoriales vinculadas (sync_to_medios=true)
      supabase.from('mesa_editorial_acciones')
        .select('tema_id, tipo, archived')
        .eq('sync_to_medios', true)
        .eq('archived', false),
    ])
    if (tErr || pErr) { setError((tErr || pErr).message); setLoading(false); return }

    // Construir mapa tema_id → tipo (hito)
    const hitoMap = {}
    for (const acc of (accionesData || [])) {
      if (acc.tema_id && acc.tipo) {
        if (!hitoMap[acc.tema_id]) hitoMap[acc.tema_id] = acc.tipo
      }
    }

    const tree = buildTree(temasData || [], planifs || [], hitoMap)
    setTemas(tree)
    setExpandedTemas(new Set())
    setLoading(false)

    // Transición silenciosa Nuevo → En desarrollo si pasaron 7+ días
    checkAndTransitionStaleNew(temasData || [])
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

  // ── Filtro con soporte de subtemas ──────────────────────────────
  const displayTemas = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Pipeline de filtros para un array de planificaciones (compartida por directas y subtemas)
    const filterPlanifs = (planifs) => {
      let ps = [...planifs]
      if (filterDateRange.from) ps = ps.filter(p => p.semana && p.semana >= filterDateRange.from)
      if (filterDateRange.to)   ps = ps.filter(p => p.semana && p.semana <= filterDateRange.to)
      if (filterCellStatus !== 'all') {
        const targetCols = filterGroup === 'all' ? MEDIA_COLS : MEDIA_COLS.filter(c => c.group === filterGroup)
        ps = ps.filter(p => targetCols.some(col => {
          const { valor } = getCellData(p.medios, col.id)
          if (filterCellStatus === 'si')    return valor?.toLowerCase().startsWith('si')
          if (filterCellStatus === 'pd')    return valor?.toLowerCase().startsWith('pd')
          if (filterCellStatus === 'empty') return !valor
          return true
        }))
      }
      if (activeColumnFilters.size > 0) {
        const activeColIds = [...activeColumnFilters]
        ps = ps.filter(p => activeColIds.some(colId => {
          const { valor } = getCellData(p.medios, colId)
          return valor && valor !== ''
        }))
      }
      return ps
    }

    const sortPlanifs = (planifs) => [...planifs].sort((a, b) => {
      if (!a.semana && !b.semana) return 0
      if (!a.semana) return 1
      if (!b.semana) return -1
      const aFuture = a.semana >= todayStr
      const bFuture = b.semana >= todayStr
      if (aFuture && !bFuture) return -1
      if (!aFuture && bFuture) return 1
      return a.semana.localeCompare(b.semana)
    })

    let result = temas
      .filter(t => activeTab === 'active' ? !t.archived : t.archived)
      .map(tema => {
        if (activeTab !== 'active') {
          // Tab Archivados: filtro por rango de archived_at del padre
          if (filterDateRange.from && tema.archived_at && tema.archived_at.slice(0, 10) < filterDateRange.from) return null
          if (filterDateRange.to   && tema.archived_at && tema.archived_at.slice(0, 10) > filterDateRange.to)   return null
          return { ...tema }
        }

        // ── Tab Activos ──

        // 1. Planificaciones directas del padre: pipeline completa
        const directPlanifs = sortPlanifs(filterPlanifs(tema.planificaciones_directas || tema.planificaciones || []))

        // 2. Subtemas: pipeline completa por subtema
        let filteredSubtemas = (tema.subtemas || []).map(sub => {
          const subPlanifs = sortPlanifs(filterPlanifs(sub.planificaciones || []))
          return { ...sub, planificaciones: subPlanifs }
        })

        // 3. Excluir subtemas vacíos post-filtro, salvo que filterIncludeSubtemaRange los rescate
        const hasAnyPlanifFilter = filterDateRange.from || filterDateRange.to || filterCellStatus !== 'all' || activeColumnFilters.size > 0
        if (hasAnyPlanifFilter) {
          if (filterIncludeSubtemaRange && (filterDateRange.from || filterDateRange.to)) {
            // Rescatar subtemas cuyo rango solapa el filtro de fechas aunque no tengan planifs
            const rangeFrom = filterDateRange.from || '0000-01-01'
            const rangeTo   = filterDateRange.to   || '9999-12-31'
            filteredSubtemas = (tema.subtemas || []).map(sub => {
              const already = filteredSubtemas.find(fs => fs.id === sub.id)
              if (already && already.planificaciones.length > 0) return already
              const subFrom = sub.fecha_inicio  || '0000-01-01'
              const subTo   = sub.fecha_termino || '9999-12-31'
              if (subFrom <= rangeTo && subTo >= rangeFrom) {
                return already || { ...sub, planificaciones: [] }
              }
              return null
            }).filter(Boolean)
          } else {
            // Sin toggle: solo subtemas con planificaciones post-filtro
            filteredSubtemas = filteredSubtemas.filter(s => s.planificaciones.length > 0)
          }
        }

        return {
          ...tema,
          planificaciones: directPlanifs,
          planificaciones_directas: directPlanifs,
          subtemas: filteredSubtemas,
        }
      })
      .filter(Boolean)

    // Filtro de texto — match en padre O en subtemas
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      result = result
        .map(tema => {
          const parentMatch = tema.nombre?.toLowerCase().includes(q)
          const subtemaMatches = (tema.subtemas || []).filter(s => s.nombre?.toLowerCase().includes(q))
          if (parentMatch) return { ...tema, _textMatch: 'parent' }
          if (subtemaMatches.length > 0) return { ...tema, subtemas: subtemaMatches, _textMatch: 'subtema' }
          return null
        })
        .filter(Boolean)
    }

    // Si hay filtros activos en tab Activos, ocultar temas sin ningún resultado
    if (activeTab === 'active' && (filterDateRange.from || filterDateRange.to || filterCellStatus !== 'all' || activeColumnFilters.size > 0)) {
      result = result.filter(t => {
        const hasDirect = (t.planificaciones || []).length > 0
        const hasSubPlanifs = (t.subtemas || []).some(s => s.planificaciones.length > 0)
        // Con filterIncludeSubtemaRange, un padre con subtemas incluidos por solapamiento de rango cuenta
        const hasSubByRange = filterIncludeSubtemaRange && (t.subtemas || []).length > 0
        return hasDirect || hasSubPlanifs || hasSubByRange
      })
    }

    // Ordenar temas
    if (activeTab === 'archived') {
      result = [...result].sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''))
    } else {
      const getKey = (tema) => {
        const allPlanifs = [
          ...(tema.planificaciones || []),
          ...(tema.subtemas || []).flatMap(s => s.planificaciones || []),
        ]
        if (allPlanifs.length === 0) return null
        const nearestFuture = allPlanifs.find(p => p.semana && p.semana >= todayStr)
        if (nearestFuture) return nearestFuture.semana
        const withDate = allPlanifs.filter(p => p.semana)
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
  }, [temas, activeTab, filterText, sortDir, filterDateRange, filterGroup, filterCellStatus, activeColumnFilters, filterIncludeSubtemaRange])

  const visibleCols = useMemo(() => {
    if (activeColumnFilters.size > 0) {
      return MEDIA_COLS.filter(c => activeColumnFilters.has(c.id))
    }
    if (filterGroup === 'all') return MEDIA_COLS
    return MEDIA_COLS.filter(c => c.group === filterGroup)
  }, [activeColumnFilters, filterGroup])

  // Contadores para badges de tabs
  const activeCount   = useMemo(() => temas.filter(t => !t.archived && !t.parent_id).length, [temas])
  const archivedCount = useMemo(() => temas.filter(t =>  t.archived && !t.parent_id).length, [temas])

  const exportItems = useMemo(() =>
    temas
      .filter(t => !t.archived && !t.parent_id)
      .map(t => {
        const subCount = (t.subtemas || []).length
        const totalPlanifs = (t.planificaciones || []).length +
          (t.subtemas || []).reduce((acc, s) => acc + (s.planificaciones || []).length, 0)
        return {
          id:   t.id,
          name: t.nombre || '(sin nombre)',
          meta: subCount > 0
            ? `${subCount} subtema${subCount !== 1 ? 's' : ''} · ${totalPlanifs} fecha${totalPlanifs !== 1 ? 's' : ''}`
            : `${totalPlanifs} fecha${totalPlanifs !== 1 ? 's' : ''}`,
        }
      }),
    [temas]
  )

  const exportPreselected = useMemo(() =>
    new Set(displayTemas.map(t => t.id)),
    [displayTemas]
  )

  // ── handleAddRow: crea tema (si es nuevo) + planificación ────────
  async function handleAddRow({ nombre, semana, temaId }) {
    let targetTemaId = temaId
    if (!targetTemaId) {
      const { data: newTema, error } = await supabase
        .from('temas').insert([{ nombre, origen: 'medios' }]).select().single()
      if (error) { addToast('Error al crear el tema. Intenta nuevamente.', 'error'); return }
      targetTemaId = newTema.id
    } else {
      // Auto-transición: Nuevo → En desarrollo al agregar primera planificación
      const existingTema = temasRef.current.find(t => t.id === temaId)
      if (existingTema?.status === 'Nuevo') {
        const { error: statusErr } = await supabase.from('temas').update({ status: 'En desarrollo' }).eq('id', temaId)
        if (!statusErr) {
          setTemas(prev => prev.map(t => t.id === temaId ? { ...t, status: 'En desarrollo' } : t))
        }
      }
    }
    const { data, error } = await supabase
      .from('contenidos').insert([{ nombre, semana, medios: {}, tema_id: targetTemaId }]).select().single()
    if (error) { addToast('Error al agregar la planificación. Intenta nuevamente.', 'error'); return }
    await logAction('AGREGAR', data.id, nombre, `Agregó "${nombre}"`)
    setShowModal(null)
  }

  // ── handleAddSubtema: crea subtema + 1 contenido inicial ─────────
  const handleAddSubtema = useCallback(async (parentId, nombre, fechaInicio, fechaTermino) => {
    const { data: newSubtema, error } = await supabase
      .from('temas')
      .insert([{
        nombre,
        parent_id: parentId,
        origen: 'medios',
        archived: false,
        fecha_inicio: fechaInicio || null,
        fecha_termino: fechaTermino || null,
      }])
      .select()
      .single()
    if (error) { addToast('Error al crear el subtema. Intenta nuevamente.', 'error'); return }

    // Crear 1 contenido vacío para el subtema (modelo single-row)
    const { data: newPlanif, error: pErr } = await supabase
      .from('contenidos')
      .insert([{
        nombre,
        semana: fechaInicio || null,
        medios: {},
        tema_id: newSubtema.id,
      }])
      .select()
      .single()
    if (pErr) { addToast('Subtema creado pero hubo un error al inicializar la fila.', 'error') }

    setTemas(prev => prev.map(t => {
      if (t.id === parentId) {
        return {
          ...t,
          subtemas: [
            ...(t.subtemas || []),
            { ...newSubtema, planificaciones: newPlanif ? [newPlanif] : [] },
          ],
        }
      }
      return t
    }))
    const padre = temasRef.current.find(t => t.id === parentId)
    await logAction('AGREGAR', newSubtema.id, nombre, `Creó subtema "${nombre}" en "${padre?.nombre}"`)
    addToast(`Subtema "${nombre}" creado.`, 'success')
    setShowModal(null)
  }, [addToast, logAction])

  // ── handleUpdateSubtema: actualiza campos de un subtema ──────────
  const handleUpdateSubtema = useCallback(async (subtemaId, fields) => {
    setTemas(prev => prev.map(t => ({
      ...t,
      subtemas: (t.subtemas || []).map(s => s.id === subtemaId ? { ...s, ...fields } : s),
    })))
    const { error } = await supabase.from('temas').update(fields).eq('id', subtemaId)
    if (error) {
      addToast('Error al actualizar el subtema.', 'error')
      fetchData()
      return
    }
    await logAction('MODIFICAR', subtemaId, fields.nombre || subtemaId, `Actualizó subtema`)
  }, [addToast, logAction])

  // ── handleEditSubtema: abre modal de edición del subtema ─────────
  const handleEditSubtema = useCallback((subtema) => {
    let padre = null
    for (const t of temasRef.current) {
      if ((t.subtemas || []).some(s => s.id === subtema.id)) { padre = t; break }
    }
    setShowModal({
      mode: 'edit-subtema',
      subtemaId: subtema.id,
      subtemaNombre: subtema.nombre,
      fechaInicioInit: subtema.fecha_inicio || '',
      fechaTerminoInit: subtema.fecha_termino || '',
      parentNombre: padre?.nombre || '',
    })
  }, [])

  // ── handleConfirmEditSubtema: guarda cambios del subtema ──────────
  const handleConfirmEditSubtema = useCallback(async (subtemaId, fields) => {
    setTemas(prev => prev.map(t => ({
      ...t,
      subtemas: (t.subtemas || []).map(s => s.id === subtemaId ? { ...s, ...fields } : s),
    })))
    const { error } = await supabase.from('temas').update(fields).eq('id', subtemaId)
    if (error) {
      addToast('Error al actualizar el subtema.', 'error')
      fetchData()
      return
    }
    // Sync contenidos.nombre when the subtema name changes
    if (fields.nombre) {
      let planifId = null
      for (const t of temasRef.current) {
        const s = (t.subtemas || []).find(s => s.id === subtemaId)
        if (s) { planifId = s.planificaciones?.[0]?.id || null; break }
      }
      if (planifId) {
        await supabase.from('contenidos').update({ nombre: fields.nombre }).eq('id', planifId)
      }
    }
    await logAction('MODIFICAR', subtemaId, fields.nombre || subtemaId, `Actualizó subtema`)
    addToast('Subtema actualizado.', 'success')
    setShowModal(null)
  }, [addToast, logAction])

  // ── handleDeleteSubtema: elimina subtema + CASCADE a contenidos ───
  const handleDeleteSubtema = useCallback(async (subtemaId) => {
    let subtema = null
    let padre = null
    for (const t of temasRef.current) {
      const s = (t.subtemas || []).find(s => s.id === subtemaId)
      if (s) { subtema = s; padre = t; break }
    }
    if (!subtema) return

    const { error } = await supabase.from('temas').delete().eq('id', subtemaId)
    if (error) { addToast('Error al eliminar el subtema.', 'error'); return }

    setTemas(prev => prev.map(t => t.id === padre.id ? {
      ...t,
      subtemas: (t.subtemas || []).filter(s => s.id !== subtemaId),
    } : t))
    await logAction('ELIMINAR', subtemaId, subtema.nombre, `Eliminó subtema "${subtema.nombre}" de "${padre?.nombre}"`)
    addToast(`Subtema "${subtema.nombre}" eliminado.`, 'success')
  }, [addToast, logAction])

  // ── handleCellChange: actualiza una celda de una planificación ───
  const handleCellChange = useCallback(async (planifId, colId, value, notas) => {
    const owner = findPlanifOwner(planifId)
    if (!owner) return

    const { padre, subtema, planif } = owner
    const { valor: oldValue, notas: oldNotas } = getCellData(planif.medios, colId)
    if (oldValue === value && oldNotas === notas) return

    const newMedios = setCellData(planif.medios, colId, value, notas)

    if (subtema) {
      setTemas(prev => prev.map(t => t.id === padre.id ? {
        ...t,
        subtemas: (t.subtemas || []).map(s => s.id === subtema.id ? {
          ...s,
          planificaciones: s.planificaciones.map(p => p.id === planifId ? { ...p, medios: newMedios } : p),
        } : s),
      } : t))
    } else {
      setTemas(prev => prev.map(t => t.id === padre.id ? {
        ...t,
        planificaciones: t.planificaciones.map(p => p.id === planifId ? { ...p, medios: newMedios } : p),
        planificaciones_directas: (t.planificaciones_directas || []).map(p => p.id === planifId ? { ...p, medios: newMedios } : p),
      } : t))
    }

    const { error } = await supabase.from('contenidos').update({ medios: newMedios }).eq('id', planifId)
    if (error) { addToast('Error al guardar. Los datos se recargarán.', 'error'); fetchData(); return }

    const detalle = value ? `"${colId}" → "${value}"${notas ? ' (con notas)' : ''}` : `Limpió "${colId}"`

    // Auto-transición del padre: Nuevo → En desarrollo al editar una celda con valor
    if (padre.status === 'Nuevo' && value) {
      const { error: statusErr } = await supabase.from('temas').update({ status: 'En desarrollo' }).eq('id', padre.id)
      if (!statusErr) {
        setTemas(prev => prev.map(t => t.id === padre.id ? { ...t, status: 'En desarrollo' } : t))
      }
    }
    await logAction('MODIFICAR', planifId, padre.nombre, detalle)
  }, [addToast, logAction])

  // ── handleFieldChange: edita campo de planificación (ej. semana) ─
  const handleFieldChange = useCallback(async (planifId, field, value) => {
    const owner = findPlanifOwner(planifId)
    if (!owner) return
    const { padre, subtema } = owner

    if (subtema) {
      setTemas(prev => prev.map(t => t.id === padre.id ? {
        ...t,
        subtemas: (t.subtemas || []).map(s => s.id === subtema.id ? {
          ...s,
          planificaciones: s.planificaciones.map(p => p.id === planifId ? { ...p, [field]: value } : p),
        } : s),
      } : t))
    } else {
      setTemas(prev => prev.map(t => t.id === padre.id ? {
        ...t,
        planificaciones: t.planificaciones.map(p => p.id === planifId ? { ...p, [field]: value } : p),
        planificaciones_directas: (t.planificaciones_directas || []).map(p => p.id === planifId ? { ...p, [field]: value } : p),
      } : t))
    }

    const { error } = await supabase.from('contenidos').update({ [field]: value }).eq('id', planifId)
    if (error) { addToast('Error al guardar el campo. Los datos se recargarán.', 'error'); fetchData(); return }
    await logAction('MODIFICAR', planifId, padre?.nombre, `Cambió "${field}" → "${value}"`)
  }, [addToast, logAction])

  const requestDeleteRow = useCallback((planifId) => {
    const owner = findPlanifOwner(planifId)
    let nombre = 'planificación'
    if (owner) {
      const { padre, planif } = owner
      const dateStr = planif.semana
        ? new Date(planif.semana + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'sin fecha'
      nombre = `planificación del ${dateStr} en "${padre.nombre}"`
    }
    setConfirmDelete({ type: 'planif', id: planifId, nombre })
  }, [])

  const requestDeleteTema = useCallback((temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    const subCount = (tema.subtemas || []).length
    const totalPlanifs = (tema.planificaciones || []).length +
      (tema.subtemas || []).reduce((acc, s) => acc + (s.planificaciones || []).length, 0)
    setConfirmDelete({
      type: 'tema',
      id: temaId,
      nombre: tema.nombre || 'Sin nombre',
      n: totalPlanifs,
      subCount,
      fromEditorial: tema.origen === 'editorial',
    })
  }, [])

  const handleDeleteRow = useCallback(async (planifId) => {
    const owner = findPlanifOwner(planifId)
    if (!owner) return
    const { padre, subtema } = owner

    const { error } = await supabase.from('contenidos').delete().eq('id', planifId)
    if (error) { addToast('Error al eliminar.', 'error'); fetchData(); return }

    if (subtema) {
      setTemas(prev => prev.map(t => t.id === padre.id ? {
        ...t,
        subtemas: (t.subtemas || []).map(s => s.id === subtema.id ? {
          ...s,
          planificaciones: s.planificaciones.filter(p => p.id !== planifId),
        } : s),
      } : t))
    } else {
      setTemas(prev => prev.map(t => t.id === padre.id ? {
        ...t,
        planificaciones: t.planificaciones.filter(p => p.id !== planifId),
        planificaciones_directas: (t.planificaciones_directas || []).filter(p => p.id !== planifId),
      } : t))
    }
    await logAction('ELIMINAR', planifId, padre?.nombre)
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

  // ── Archivar tema (con cascade a subtemas) ──────────────────────
  const requestArchiveTema = useCallback((temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    const subtemaCount = (tema.subtemas || []).filter(s => !s.archived).length
    setConfirmArchive({
      id: temaId,
      nombre: tema.nombre || 'Sin nombre',
      n: (tema.planificaciones || []).length,
      subtemaCount,
    })
  }, [])

  const handleDoArchiveTema = useCallback(async () => {
    if (!confirmArchive) return
    const { id, nombre } = confirmArchive
    const now = new Date().toISOString()

    // Archivar subtemas activos en cascade
    const tema = temasRef.current.find(t => t.id === id)
    const activeSubtemaIds = (tema?.subtemas || []).filter(s => !s.archived).map(s => s.id)

    // Batch update subtemas
    if (activeSubtemaIds.length > 0) {
      await supabase.from('temas')
        .update({ archived: true, archived_at: now })
        .in('id', activeSubtemaIds)
    }

    const { error } = await supabase.from('temas').update({ archived: true, archived_at: now, status: 'Completado' }).eq('id', id)
    if (error) { addToast('Error al archivar el tema.', 'error'); return }

    setTemas(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          archived: true,
          archived_at: now,
          status: 'Completado',
          subtemas: (t.subtemas || []).map(s =>
            !s.archived ? { ...s, archived: true, archived_at: now } : s
          ),
        }
      }
      return t
    }))
    setConfirmArchive(null)
    await logAction('ARCHIVAR', id, nombre, `Archivó tema "${nombre}"${activeSubtemaIds.length > 0 ? ` y ${activeSubtemaIds.length} subtema(s)` : ''}`)
    addToast(`"${nombre}" archivado.`, 'success')
  }, [confirmArchive, addToast, logAction])

  // ── Reactivar tema (con cascade a subtemas archivados con el padre) ──
  const requestReactivateTema = useCallback((temaId) => {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    setConfirmReactivate({ id: temaId, nombre: tema.nombre || 'Sin nombre', archived_at: tema.archived_at })
  }, [])

  const handleDoReactivateTema = useCallback(async () => {
    if (!confirmReactivate) return
    const { id, nombre, archived_at } = confirmReactivate
    const { error } = await supabase.from('temas').update({ archived: false, archived_at: null, status: 'En desarrollo' }).eq('id', id)
    if (error) { addToast('Error al reactivar el tema.', 'error'); return }

    // Reactivar subtemas que fueron archivados con el mismo archived_at (cascade)
    const tema = temasRef.current.find(t => t.id === id)
    const cascadedSubtemaIds = archived_at
      ? (tema?.subtemas || [])
          .filter(s => s.archived && s.archived_at === archived_at)
          .map(s => s.id)
      : []

    if (cascadedSubtemaIds.length > 0) {
      await supabase.from('temas')
        .update({ archived: false, archived_at: null })
        .in('id', cascadedSubtemaIds)
    }

    setTemas(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          archived: false,
          archived_at: null,
          status: 'En desarrollo',
          subtemas: (t.subtemas || []).map(s =>
            cascadedSubtemaIds.includes(s.id) ? { ...s, archived: false, archived_at: null } : s
          ),
        }
      }
      return t
    }))
    setConfirmReactivate(null)
    await logAction('REACTIVAR', id, nombre, `Reactivó tema "${nombre}"`)
    addToast(`"${nombre}" reactivado y visible en Activos.`, 'success')
  }, [confirmReactivate, addToast, logAction])

  const handleStatusChange = useCallback(async (temaId, newStatus) => {
    if (newStatus === 'Completado') {
      const tema = temasRef.current.find(t => t.id === temaId)
      if (!tema) return
      setConfirmStatusComplete({ id: temaId, nombre: tema.nombre || 'Sin nombre' })
      return
    }
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    const oldStatus = tema.status
    setTemas(prev => prev.map(t => t.id === temaId ? { ...t, status: newStatus } : t))
    const { error } = await supabase.from('temas').update({ status: newStatus }).eq('id', temaId)
    if (error) {
      addToast('Error al actualizar el status.', 'error')
      setTemas(prev => prev.map(t => t.id === temaId ? { ...t, status: oldStatus } : t))
      return
    }
    await logAction('MODIFICAR', temaId, tema.nombre, `Status → "${newStatus}"`)
  }, [addToast, logAction])

  const handleDoStatusComplete = useCallback(async () => {
    if (!confirmStatusComplete) return
    const { id, nombre } = confirmStatusComplete
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('temas')
      .update({ status: 'Completado', archived: true, archived_at: now })
      .eq('id', id)
    if (error) { addToast('Error al completar el tema.', 'error'); return }

    // Archivar subtemas en cascade
    const tema = temasRef.current.find(t => t.id === id)
    const activeSubtemaIds = (tema?.subtemas || []).filter(s => !s.archived).map(s => s.id)
    if (activeSubtemaIds.length > 0) {
      await supabase.from('temas')
        .update({ archived: true, archived_at: now })
        .in('id', activeSubtemaIds)
    }

    setTemas(prev => prev.map(t =>
      t.id === id
        ? {
            ...t,
            status: 'Completado',
            archived: true,
            archived_at: now,
            subtemas: (t.subtemas || []).map(s =>
              !s.archived ? { ...s, archived: true, archived_at: now } : s
            ),
          }
        : t
    ))
    setConfirmStatusComplete(null)
    addToast(`"${nombre}" marcado como completado y archivado.`, 'success')
    await logAction('ARCHIVAR', id, nombre, 'Marcado como Completado → archivado automático')
  }, [confirmStatusComplete, addToast, logAction])

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

  const hasActiveFilters = !!(filterInput || filterGroup !== 'all' || filterCellStatus !== 'all' || filterDateRange.from || filterDateRange.to || activeColumnFilters.size > 0)

  // Contar planificaciones de todos los niveles
  const totalPlanifs = useMemo(() => temas
    .filter(t => !t.archived && !t.parent_id)
    .reduce((acc, t) => acc + (t.planificaciones || []).length + (t.subtemas || []).reduce((a, s) => a + (s.planificaciones || []).length, 0), 0),
    [temas]
  )

  const displayPlanifs = useMemo(() => displayTemas
    .reduce((acc, t) => acc + (t.planificaciones || []).length + (t.subtemas || []).reduce((a, s) => a + (s.planificaciones || []).length, 0), 0),
    [displayTemas]
  )

  const mobileActiveFilterCount = [
    filterGroup !== 'all',
    filterCellStatus !== 'all',
    filterDateRange.from || filterDateRange.to,
    activeColumnFilters.size > 0,
  ].filter(Boolean).length

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
          headerExpanded={headerExpanded}
          setHeaderExpanded={setHeaderExpanded}
          hasActiveFilters={hasActiveFilters}
        />
        {/* Mobile: tabs */}
        <div className={`medios-tabs medios-tabs-mobile${!headerExpanded ? ' zona-b-collapsed' : ''}`}>
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
        <div className={`mobile-action-line${!headerExpanded ? ' zona-b-collapsed' : ''}`}>
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

      <div className={`medios-filter-bar${!headerExpanded ? ' zona-b-collapsed' : ''}`} ref={filterBarRef}>
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
          <SheetButtons />
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
              {/* Tarea 6: toggle incluir subtemas con rango en período */}
              {(filterDateRange.from || filterDateRange.to) && (
                <label className="filter-subtema-range-toggle" title="Incluir subtemas cuyo rango de fechas se solape con el período seleccionado">
                  <input
                    type="checkbox"
                    checked={filterIncludeSubtemaRange}
                    onChange={e => setFilterIncludeSubtemaRange(e.target.checked)}
                  />
                  <span>Incluir subtemas por rango</span>
                </label>
              )}
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
                {[{ value: 'all', label: 'Todas las celdas' }, { value: 'si', label: '✓ Confirmado' }, { value: 'pd', label: '◉ Por definir' }, { value: 'empty', label: '○ Vacías' }].map(f => (
                  <button key={f.value} className={`pill ${filterCellStatus === f.value ? 'pill-active' : ''}`} onClick={() => setFilterCellStatus(f.value)}>{f.label}</button>
                ))}
              </div>
            </div>

            {/* Indicador activo */}
            {hasActiveFilters && (
              <div className="medios-filter-active">
                <span className="filter-count">{displayTemas.length} de {activeCount} temas · {displayPlanifs} de {totalPlanifs} fechas</span>
                {filterGroup !== 'all' && <span className="filter-count"> · {visibleCols.length} columnas</span>}
                <button className="filter-reset" onClick={() => { setFilterInput(''); setFilterGroup('all'); setFilterCellStatus('all'); setFilterDateRange({ from: '', to: '' }); setFilterIncludeSubtemaRange(false) }}>Limpiar filtros</button>
              </div>
            )}
            {/* Column filter indicator — independent of hasActiveFilters */}
            {activeColumnFilters.size > 0 && (
              <div className="medios-filter-active medios-filter-cols-active">
                <span className="column-filter-badge">
                  {activeColumnFilters.size} columna{activeColumnFilters.size !== 1 ? 's' : ''} filtrada{activeColumnFilters.size !== 1 ? 's' : ''}
                </span>
                {/* Chips por columna activa con X para quitar una a la vez */}
                <div className="col-filter-chips">
                  {[...activeColumnFilters].map(colId => {
                    const col = MEDIA_COLS.find(c => c.id === colId)
                    if (!col) return null
                    return (
                      <span key={colId} className="col-filter-chip">
                        {col.label}{col.sub ? ` · ${col.sub}` : ''}
                        <button
                          className="col-filter-chip-remove"
                          onClick={() => toggleColumnFilter(colId)}
                          title={`Quitar filtro de ${col.label}`}
                          aria-label={`Quitar filtro de ${col.label}`}
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </span>
                    )
                  })}
                  {/* Selector para añadir más columnas al filtro activo */}
                  <select
                    className="col-filter-add-select"
                    value=""
                    onChange={e => { if (e.target.value) toggleColumnFilter(e.target.value) }}
                    title="Añadir otra columna al filtro"
                    aria-label="Añadir otra columna al filtro"
                  >
                    <option value="">+ Añadir columna</option>
                    {GROUPS.map(g => (
                      <optgroup key={g.id} label={g.label}>
                        {MEDIA_COLS.filter(c => c.group === g.id && !activeColumnFilters.has(c.id)).map(col => (
                          <option key={col.id} value={col.id}>
                            {col.label}{col.sub ? ` · ${col.sub}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <span className="filter-count">
                  {displayTemas.length} de {activeCount} tema{activeCount !== 1 ? 's' : ''}
                </span>
                <button className="filter-reset" onClick={clearColumnFilters}>
                  Limpiar columnas
                </button>
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
              onAddSubtema={(parentId) => setShowModal({ mode: 'add-subtema', parentId, parentNombre: temasRef.current.find(t => t.id === parentId)?.nombre })}
              onUpdateSubtema={handleUpdateSubtema}
              onEditSubtema={handleEditSubtema}
              onDeleteSubtema={handleDeleteSubtema}
              onArchiveTema={requestArchiveTema}
              onReactivateTema={requestReactivateTema}
              onStatusChange={handleStatusChange}
              isArchived={activeTab === 'archived'}
              totalTemas={activeTab === 'active' ? activeCount : archivedCount}
              filterQuery={filterInput}
              onClearFilter={() => setFilterInput('')}
              onAdd={() => setShowModal('new')}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              expandedTemas={expandedTemas}
              onToggleTema={toggleTema}
              activeColumnFilters={activeColumnFilters}
              onToggleColumnFilter={toggleColumnFilter}
              onClearColumnFilters={clearColumnFilters}
            />
          </div>
          <div className="mobile-only">
            <MobileCardView
              temas={displayTemas}
              onCellChange={handleCellChange}
              onFieldChange={handleFieldChange}
              onDeleteRow={requestDeleteRow}
              onAddPlanificacion={handleOpenAddPlanificacion}
              onAddSubtema={(parentId) => setShowModal({ mode: 'add-subtema', parentId, parentNombre: temasRef.current.find(t => t.id === parentId)?.nombre })}
              onEditSubtema={handleEditSubtema}
              onDeleteSubtema={handleDeleteSubtema}
              onArchiveTema={requestArchiveTema}
              onReactivateTema={requestReactivateTema}
              onStatusChange={handleStatusChange}
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
          temas={temas.filter(t => !t.archived && !t.parent_id)}
          onConfirm={handleAddRow}
          onClose={() => setShowModal(null)}
        />
      )}
      {activeTab === 'active' && showModal && typeof showModal === 'object' && showModal.mode === 'add-subtema' && (
        <AddRowModal
          mode="add-subtema"
          parentId={showModal.parentId}
          parentNombre={showModal.parentNombre}
          onConfirmSubtema={handleAddSubtema}
          onClose={() => setShowModal(null)}
        />
      )}
      {showModal && typeof showModal === 'object' && showModal.mode === 'edit-subtema' && (
        <AddRowModal
          mode="edit-subtema"
          subtemaId={showModal.subtemaId}
          subtemaNombre={showModal.subtemaNombre}
          fechaInicioInit={showModal.fechaInicioInit}
          fechaTerminoInit={showModal.fechaTerminoInit}
          parentNombre={showModal.parentNombre}
          onConfirmEditSubtema={handleConfirmEditSubtema}
          onClose={() => setShowModal(null)}
        />
      )}
      {activeTab === 'active' && showModal && typeof showModal === 'object' && !showModal.mode && (
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
              ? `Se eliminará el tema${confirmDelete.subCount > 0 ? `, sus ${confirmDelete.subCount} subtema${confirmDelete.subCount !== 1 ? 's' : ''}` : ''} y ${confirmDelete.n === 0 ? 'sus datos' : confirmDelete.n === 1 ? 'su 1 planificación' : `sus ${confirmDelete.n} planificaciones`}. Esta acción no se puede deshacer.${confirmDelete.fromEditorial ? '\n\nEste tema fue sincronizado desde Mesa Editorial. Eliminarlo solo afecta Mesa de Medios; la acción en Editorial no se modifica.' : ''}`
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
          body={
            confirmArchive.subtemaCount > 0
              ? `Esta campaña tiene ${confirmArchive.subtemaCount} subtema${confirmArchive.subtemaCount !== 1 ? 's' : ''}. Archivar la campaña archivará también todos sus subtemas. Sus planificaciones quedarán como histórico consultable en Archivados. Puedes reactivarlo en cualquier momento.`
              : `Sus ${confirmArchive.n === 0 ? 'datos quedarán' : confirmArchive.n === 1 ? '1 planificación quedará' : `${confirmArchive.n} planificaciones quedarán`} como histórico consultable en la pestaña Archivados. Puedes reactivarlo en cualquier momento.`
          }
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

      {/* Confirm: marcar como Completado → archivado automático */}
      {confirmStatusComplete && (
        <ConfirmDialog
          title={`¿Marcar "${confirmStatusComplete.nombre}" como completado?`}
          body="El tema será archivado automáticamente. Podrás reactivarlo desde la pestaña Archivados."
          confirmLabel="Marcar como completado"
          confirmClass="btn-confirm-action"
          onConfirm={handleDoStatusComplete}
          onCancel={() => setConfirmStatusComplete(null)}
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
            <button className="sheet-clear-btn" onClick={() => { setFilterGroup('all'); setFilterCellStatus('all'); setFilterDateRange({ from: '', to: '' }); setFilterIncludeSubtemaRange(false) }}>
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
            {(filterDateRange.from || filterDateRange.to) && (
              <label className="sheet-subtema-range-toggle" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={filterIncludeSubtemaRange}
                  onChange={e => setFilterIncludeSubtemaRange(e.target.checked)}
                />
                <span>Incluir subtemas con rango en este período</span>
              </label>
            )}
          </div>
          <div className="sheet-filter-group">
            <p className="sheet-filter-label">FILTRAR POR COLUMNA</p>
            {GROUPS.map(g => (
              <div key={g.id} className="sheet-col-group">
                <p className="sheet-col-group-label">{g.label}</p>
                <div className="sheet-col-checkboxes">
                  {MEDIA_COLS.filter(c => c.group === g.id).map(col => (
                    <label key={col.id} className="sheet-col-check-label">
                      <input
                        type="checkbox"
                        checked={activeColumnFilters.has(col.id)}
                        onChange={() => toggleColumnFilter(col.id)}
                      />
                      <span>{col.label}{col.sub ? ` · ${col.sub}` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {activeColumnFilters.size > 0 && (
              <button className="sheet-clear-btn" onClick={clearColumnFilters} style={{ marginTop: 8 }}>
                Limpiar filtros de columna ({activeColumnFilters.size})
              </button>
            )}
          </div>
        </BottomSheet>
      )}

      <Toaster toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
