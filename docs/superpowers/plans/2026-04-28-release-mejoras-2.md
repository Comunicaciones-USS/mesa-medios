# Release Mejoras 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 4 mejoras para Mesa de Medios: status de temas (Nuevo/En desarrollo/Completado), alertas por fecha desfasada, rediseño del popover de celdas (eliminando estado "No"), y filtros multi-columna persistidos en sesión.

**Architecture:** MesaMediosApp centraliza el estado (status de temas, activeColumnFilters); los cambios fluyen hacia TemaRow via props, aprovechando la memoización existente. Los filtros de columna producen un `visibleCols` y un `displayTemas` adicionales que se combinan en AND con los filtros ya existentes. El nuevo CellPopover elimina el ciclo view→edit y arranca directamente con un input enfocado.

**Tech Stack:** React 18 hooks, Supabase (PostgreSQL + Realtime), CSS puro (~5440 líneas en index.css), Vite

---

## Mapa de archivos

| Archivo | Acción | Cambios principales |
|---|---|---|
| `scripts/add-medios-status.sql` | Crear | Columna `status` en `temas`, default 'Nuevo', backfill |
| `scripts/migrate-cell-no-to-empty.sql` | Crear | Migrar celdas con valor 'no' → null/vacío en JSONB |
| `src/apps/mesa-medios/config.js` | Modificar | Agregar `STALE_THRESHOLD_DAYS = 14` |
| `src/apps/mesa-medios/MesaMediosApp.jsx` | Modificar | Estado status+columnFilters, todos los handlers, UI filtros |
| `src/apps/mesa-medios/components/MediaTable.jsx` | Modificar | Iconos filtro columna en sub-header, props status, getCellMeta |
| `src/apps/mesa-medios/components/CellPopover.jsx` | Reescribir | Nuevo flujo: input→Enter/botones, sin modo view/edit, sin "No" |
| `src/index.css` | Modificar | Badges status, alerta, popover nuevo, filtros columna |

---

## Task 1: Setup — Branch + Scripts SQL

**Files:**
- Create: `scripts/add-medios-status.sql`
- Create: `scripts/migrate-cell-no-to-empty.sql`

- [ ] **Step 1: Crear branch desde main**

```bash
git checkout main && git pull
git checkout -b feat/release-mejoras-2
```

- [ ] **Step 2: Crear `scripts/add-medios-status.sql`**

```sql
-- add-medios-status.sql
-- Agregar columna status a temas de Mesa de Medios
-- EJECUTAR EN SUPABASE SQL EDITOR ANTES DEL DEPLOY

ALTER TABLE temas
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Nuevo'
  CHECK (status IN ('Nuevo', 'En desarrollo', 'Completado'));

-- Marcar archivados como Completado
UPDATE temas
SET status = 'Completado'
WHERE archived = TRUE;

-- Marcar temas con planificaciones activas como En desarrollo
UPDATE temas t
SET status = 'En desarrollo'
WHERE archived = FALSE
  AND EXISTS (
    SELECT 1 FROM contenidos c WHERE c.tema_id = t.id
  );

-- El resto queda como 'Nuevo' por el DEFAULT

CREATE INDEX IF NOT EXISTS idx_temas_status ON temas(status);
```

- [ ] **Step 3: Crear `scripts/migrate-cell-no-to-empty.sql`**

```sql
-- migrate-cell-no-to-empty.sql
-- Migrar todas las celdas con valor 'no' a vacío en contenidos.medios (JSONB)
-- Cubre formato legacy (string) y nuevo (objeto {valor, notas})
-- EJECUTAR EN SUPABASE SQL EDITOR ANTES DEL DEPLOY

UPDATE contenidos
SET medios = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN jsonb_typeof(value) = 'string' AND lower(value::text) IN ('"no"', '"no/"') THEN 'null'::jsonb
      WHEN jsonb_typeof(value) = 'string' AND lower(value::text) LIKE '"no/%' THEN 'null'::jsonb
      WHEN jsonb_typeof(value) = 'object' AND lower(value->>'valor') = 'no' THEN 'null'::jsonb
      ELSE value
    END
  )
  FROM jsonb_each(medios)
)
WHERE medios IS NOT NULL
  AND (
    medios::text LIKE '%"no"%'
    OR medios::text LIKE '%"no/%'
    OR medios::text LIKE '%"valor":"no"%'
    OR medios::text LIKE '%"valor": "no"%'
  );

-- Verificar resultado con:
-- SELECT id, medios FROM contenidos
-- WHERE medios::text ILIKE '%"no"%'
--   AND medios::text NOT ILIKE '%"notas"%';
```

- [ ] **Step 4: Commit**

```bash
git add scripts/add-medios-status.sql scripts/migrate-cell-no-to-empty.sql
git commit -m "chore(sql): add status column script + migrate no-cells to empty"
```

---

## Task 2: Parte 1 — Constante STALE_THRESHOLD_DAYS + handlers en MesaMediosApp

**Files:**
- Modify: `src/apps/mesa-medios/config.js`
- Modify: `src/apps/mesa-medios/MesaMediosApp.jsx`

- [ ] **Step 1: Agregar constante en `config.js`**

Al final de `src/apps/mesa-medios/config.js` (después de GROUPS), agregar:

```js
export const STALE_THRESHOLD_DAYS = 14
```

- [ ] **Step 2: Agregar estado `confirmStatusComplete` en MesaMediosApp**

En el bloque de estados (línea ~30), después de `confirmReactivate`:

```js
const [confirmStatusComplete, setConfirmStatusComplete] = useState(null) // { id, nombre }
```

- [ ] **Step 3: Agregar handler `handleStatusChange`**

Después de `handleDoReactivateTema` (línea ~495):

```js
const handleStatusChange = useCallback(async (temaId, newStatus) => {
  if (newStatus === 'Completado') {
    const tema = temasRef.current.find(t => t.id === temaId)
    if (!tema) return
    setConfirmStatusComplete({ id: temaId, nombre: tema.nombre || 'Sin nombre' })
    return
  }
  setTemas(prev => prev.map(t => t.id === temaId ? { ...t, status: newStatus } : t))
  const { error } = await supabase.from('temas').update({ status: newStatus }).eq('id', temaId)
  if (error) { addToast('Error al actualizar el status.', 'error'); return }
  await logAction('MODIFICAR', temaId, null, `Status → "${newStatus}"`)
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
  setTemas(prev => prev.map(t =>
    t.id === id ? { ...t, status: 'Completado', archived: true, archived_at: now } : t
  ))
  setConfirmStatusComplete(null)
  addToast(`"${nombre}" marcado como completado y archivado.`, 'success')
  await logAction('ARCHIVAR', id, nombre, 'Marcado como Completado → archivado automático')
}, [confirmStatusComplete, addToast, logAction])
```

- [ ] **Step 4: Actualizar `handleDoArchiveTema` — también fija status='Completado'**

Localizar `handleDoArchiveTema` y reemplazar la línea que llama a `supabase.from('temas').update(...)`:

```js
// ANTES:
const { error } = await supabase.from('temas').update({ archived: true, archived_at: now }).eq('id', id)
// DESPUÉS:
const { error } = await supabase.from('temas').update({ archived: true, archived_at: now, status: 'Completado' }).eq('id', id)
```

Y la actualización local:

```js
// ANTES:
setTemas(prev => prev.map(t => t.id === id ? { ...t, archived: true, archived_at: now } : t))
// DESPUÉS:
setTemas(prev => prev.map(t => t.id === id ? { ...t, archived: true, archived_at: now, status: 'Completado' } : t))
```

- [ ] **Step 5: Actualizar `handleDoReactivateTema` — vuelve a 'En desarrollo'**

Localizar `handleDoReactivateTema` y reemplazar la línea de supabase update:

```js
// ANTES:
const { error } = await supabase.from('temas').update({ archived: false, archived_at: null }).eq('id', id)
// DESPUÉS:
const { error } = await supabase.from('temas').update({ archived: false, archived_at: null, status: 'En desarrollo' }).eq('id', id)
```

Y la actualización local:

```js
// ANTES:
setTemas(prev => prev.map(t => t.id === id ? { ...t, archived: false, archived_at: null } : t))
// DESPUÉS:
setTemas(prev => prev.map(t => t.id === id ? { ...t, archived: false, archived_at: null, status: 'En desarrollo' } : t))
```

- [ ] **Step 6: Actualizar `handleCellChange` — auto-transición Nuevo → En desarrollo**

Al final de `handleCellChange`, antes del `logAction`, agregar:

```js
// Auto-transición: Nuevo → En desarrollo al editar una celda con valor
if (tema.status === 'Nuevo' && value) {
  await supabase.from('temas').update({ status: 'En desarrollo' }).eq('id', tema.id)
  setTemas(prev => prev.map(t => t.id === tema.id ? { ...t, status: 'En desarrollo' } : t))
}
```

- [ ] **Step 7: Actualizar `handleAddRow` — auto-transición al agregar planificación a tema existente**

En `handleAddRow`, después de que `targetTemaId` ya tiene valor (antes del insert de contenido), agregar:

```js
// Auto-transición: Nuevo → En desarrollo al agregar primera planificación
if (temaId) {  // temaId viene del argumento → tema ya existente
  const existingTema = temasRef.current.find(t => t.id === temaId)
  if (existingTema?.status === 'Nuevo') {
    await supabase.from('temas').update({ status: 'En desarrollo' }).eq('id', temaId)
    setTemas(prev => prev.map(t => t.id === temaId ? { ...t, status: 'En desarrollo' } : t))
  }
}
```

El bloque completo queda así:

```js
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
      await supabase.from('temas').update({ status: 'En desarrollo' }).eq('id', temaId)
      setTemas(prev => prev.map(t => t.id === temaId ? { ...t, status: 'En desarrollo' } : t))
    }
  }
  const { data, error } = await supabase
    .from('contenidos').insert([{ nombre, semana, medios: {}, tema_id: targetTemaId }]).select().single()
  if (error) { addToast('Error al agregar la planificación. Intenta nuevamente.', 'error'); return }
  await logAction('AGREGAR', data.id, nombre, `Agregó "${nombre}"`)
  setShowModal(null)
}
```

- [ ] **Step 8: Agregar ESC handler para `confirmStatusComplete`**

En el `useEffect` de keyboard shortcuts, en el bloque `if (e.key === 'Escape')`, agregar al inicio:

```js
if (confirmStatusComplete) { setConfirmStatusComplete(null); return }
```

También agregar `confirmStatusComplete` al array de dependencias del effect.

- [ ] **Step 9: Agregar ConfirmDialog para status=Completado en el JSX**

Después del ConfirmDialog de reactivar (línea ~865), agregar:

```jsx
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
```

- [ ] **Step 10: Pasar `onStatusChange` a MediaTable y MobileCardView**

En el JSX de `<MediaTable>`:

```jsx
onStatusChange={handleStatusChange}
```

En el JSX de `<MobileCardView>`:

```jsx
onStatusChange={handleStatusChange}
```

- [ ] **Step 11: Commit**

```bash
git add src/apps/mesa-medios/config.js src/apps/mesa-medios/MesaMediosApp.jsx
git commit -m "feat(medios-status): status handlers, auto-transitions, confirmDialog in App"
```

---

## Task 3: Parte 1 — Status UI en TemaRow + CSS

**Files:**
- Modify: `src/apps/mesa-medios/components/MediaTable.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Actualizar import en MediaTable — agregar STALE_THRESHOLD_DAYS**

```js
// ANTES:
import { MEDIA_COLS, GROUPS } from '../config'
// DESPUÉS:
import { MEDIA_COLS, GROUPS, STALE_THRESHOLD_DAYS } from '../config'
```

- [ ] **Step 2: Agregar `onStatusChange` a las props de TemaRow**

En la destructuración de props de `TemaRow` (línea ~63), agregar:

```js
onStatusChange,
```

- [ ] **Step 3: Agregar badge de status y dropdown en el header del tema**

En el render de `TemaRow`, dentro de `tema-header-info-cell` (la celda con `colSpan`), agregar los badges de status ANTES del `tema-header-spacer`:

```jsx
{/* Badge de status del tema */}
{!isArchived && tema.status && (
  <span
    className={`tema-status-badge tema-status-${tema.status === 'En desarrollo' ? 'en-desarrollo' : tema.status.toLowerCase()}`}
    title={`Status: ${tema.status}`}
  >
    {tema.status === 'Nuevo' && '✦ '}
    {tema.status}
  </span>
)}

{/* Select para cambiar status manualmente (solo tab activos) */}
{!isArchived && (
  <select
    className="tema-status-select"
    value={tema.status || 'Nuevo'}
    onChange={e => { e.stopPropagation(); onStatusChange?.(tema.id, e.target.value) }}
    onClick={e => e.stopPropagation()}
    aria-label="Cambiar status del tema"
    title="Cambiar status"
  >
    <option value="Nuevo">Nuevo</option>
    <option value="En desarrollo">En desarrollo</option>
    <option value="Completado">Completado</option>
  </select>
)}
```

- [ ] **Step 4: Actualizar `memo` comparison de TemaRow — agregar `tema.status` y `onStatusChange`**

En la función areEqual al final de TemaRow (línea ~413), agregar:

```js
pt.status === nt.status &&
```

Y también:

```js
prevProps.onStatusChange === nextProps.onStatusChange &&
```

- [ ] **Step 5: Actualizar MediaTable — recibir y pasar prop `onStatusChange`**

En la destructuración de props de `MediaTable` (línea ~449), agregar:

```js
onStatusChange,
```

En el render de `<TemaRow>` dentro de `MediaTable`, agregar:

```jsx
onStatusChange={onStatusChange}
```

- [ ] **Step 6: Agregar CSS para badges de status en `index.css`**

Agregar al final del archivo (o en la sección de Mesa de Medios):

```css
/* ── Status badges (Mesa de Medios) ─────────────────────────── */
.tema-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.4;
}
.tema-status-nuevo {
  background: #dbeafe;
  color: #1e40af;
}
.tema-status-en-desarrollo {
  background: #fef3c7;
  color: #92400e;
}
.tema-status-completado {
  background: #d1fae5;
  color: #065f46;
}
.tema-status-select {
  font-size: 11px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 2px 4px;
  background: white;
  color: var(--text-main);
  cursor: pointer;
  font-family: inherit;
  outline: none;
  max-width: 130px;
}
.tema-status-select:focus { border-color: var(--secondary); }
```

- [ ] **Step 7: Iniciar dev server y verificar visualmente**

```bash
npm run dev
```

Verificar en http://localhost:5173:
- Badge de status visible al lado del nombre en header de cada tema
- Select permite cambiar status
- Cambiar a "Completado" → aparece ConfirmDialog → al confirmar, tema se archiva y desaparece de Activos

- [ ] **Step 8: Commit**

```bash
git add src/apps/mesa-medios/components/MediaTable.jsx src/index.css
git commit -m "feat(medios-status): status badge + dropdown in TemaRow, CSS badges"
```

---

## Task 4: Parte 2 — Alerta por fecha desfasada

**Files:**
- Modify: `src/apps/mesa-medios/components/MediaTable.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Agregar cálculo de `isStale` en TemaRow**

Después del `useMemo` de `inactiveDays` en TemaRow (línea ~102), agregar:

```js
// Badge de alerta: tema 'En desarrollo' con todas las planificaciones vencidas > STALE_THRESHOLD_DAYS
const isStale = useMemo(() => {
  if (isArchived || tema.status !== 'En desarrollo') return false
  if (tema.planificaciones.length === 0) return false
  const today = new Date()
  return tema.planificaciones.every(p => {
    if (!p.semana) return true  // sin fecha = considerar vencida
    const planDate = new Date(p.semana + 'T12:00:00')
    const diffDays = Math.floor((today - planDate) / (1000 * 60 * 60 * 24))
    return diffDays > STALE_THRESHOLD_DAYS
  })
}, [tema.planificaciones, tema.status, isArchived])
```

- [ ] **Step 2: Agregar badge de alerta en el header del tema**

En `tema-header-info-cell`, después del badge de status y antes del spacer, agregar:

```jsx
{/* Badge alerta: tema con fechas desfasadas */}
{isStale && (
  <button
    className="tema-stale-badge"
    onClick={e => { e.stopPropagation(); onStatusChange?.(tema.id, 'Completado') }}
    title={`Este tema tiene planificaciones con fecha pasada hace más de ${STALE_THRESHOLD_DAYS} días. Considera marcarlo como completado.`}
    aria-label="Cerrar tema — tiene fechas desfasadas"
  >
    ⚠ Cerrar tema
  </button>
)}
```

- [ ] **Step 3: Agregar CSS para badge de alerta**

```css
/* ── Badge alerta fecha desfasada ───────────────────────────── */
.tema-stale-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: #ffedd5;
  color: #9a3412;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
  font-family: inherit;
}
.tema-stale-badge:hover { opacity: 0.8; }
```

- [ ] **Step 4: Verificar en dev server**

Verificar: crear un tema con status 'En desarrollo' y planificaciones con fecha de hace más de 14 días → aparece badge naranja "⚠ Cerrar tema". Click en badge → ConfirmDialog → al confirmar, tema archivado.

- [ ] **Step 5: Commit**

```bash
git add src/apps/mesa-medios/components/MediaTable.jsx src/index.css
git commit -m "feat(stale-alert): badge warning for stale En desarrollo topics"
```

---

## Task 5: Parte 3 — Rediseño completo de CellPopover

**Files:**
- Modify: `src/apps/mesa-medios/components/CellPopover.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Reescribir CellPopover con el nuevo flujo**

Reemplazar TODO el contenido de `CellPopover.jsx` con:

```jsx
import { useState, useEffect, useRef } from 'react'

// Extrae status ('si'|'pd'|'') y nota del valor raw (legacy string o nuevo formato)
function parseValue(raw) {
  if (!raw) return { status: '', note: '' }
  const lower = raw.toLowerCase().trim()
  if (lower === 'si') return { status: 'si', note: '' }
  if (lower === 'pd') return { status: 'pd', note: '' }
  if (lower.startsWith('si/')) {
    const note = raw.slice(raw.indexOf('/') + 1).trim()
    return { status: 'si', note }
  }
  if (lower.startsWith('pd/')) {
    const note = raw.slice(raw.indexOf('/') + 1).trim()
    return { status: 'pd', note }
  }
  return { status: '', note: '' }
}

export default function CellPopover({ value, notas: initialNotas, position, onSave, onClose }) {
  const { status: initStatus, note: legacyNote } = parseValue(value)
  // Preferir notas del formato JSONB nuevo; fallback al nombre embebido del formato legacy
  const initNote = initialNotas || legacyNote

  const [inputText, setInputText] = useState(initNote)
  const inputRef = useRef(null)
  const ref = useRef(null)

  // Auto-focus al montar
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Click outside → cerrar sin guardar
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave('si', inputText.trim())
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  // Mantener popover dentro del viewport
  const popW = 260
  const popH = 120
  let left = position.x
  let top  = position.y + 4
  if (left + popW > window.innerWidth  - 8) left = window.innerWidth  - popW - 8
  if (top  + popH > window.innerHeight - 8) top  = position.y - popH - 4

  return (
    <div
      ref={ref}
      className="cell-popover cell-popover-v2"
      style={{ left, top, width: popW }}
      onKeyDown={handleKeyDown}
    >
      <div className="cpv2-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="cpv2-input"
          placeholder="Escribe una nota o presiona Enter..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
        />
      </div>
      <div className="cpv2-actions">
        <button
          className="cpv2-btn-pd"
          onClick={() => onSave('pd', inputText.trim())}
          type="button"
        >
          Por definir
        </button>
        <button
          className="cpv2-btn-vaciar"
          onClick={() => onSave('', '')}
          type="button"
        >
          Vaciar
        </button>
        <button
          className="cpv2-btn-confirm"
          onClick={() => onSave('si', inputText.trim())}
          type="button"
        >
          Confirmar ✓
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Agregar CSS para el nuevo popover**

En `index.css`, agregar (se puede dejar el CSS legacy de `.cell-popover` intacto — el selector `.cell-popover-v2` lo sobreescribe donde es necesario):

```css
/* ── CellPopover v2 (nuevo flujo) ──────────────────────────── */
.cell-popover-v2 {
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.14);
  background: white;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}
.cpv2-input-wrap {
  padding: 12px 12px 8px;
}
.cpv2-input {
  width: 100%;
  box-sizing: border-box;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: Montserrat, sans-serif;
  outline: none;
  color: var(--text-main);
}
.cpv2-input:focus {
  border-color: var(--secondary);
  box-shadow: 0 0 0 2px rgba(39, 93, 165, 0.15);
}
.cpv2-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 12px;
  border-top: 1px solid #f3f4f6;
}
.cpv2-btn-pd {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.cpv2-btn-pd:hover { background: #fde68a; }
.cpv2-btn-vaciar {
  color: #6b7280;
  background: none;
  border: none;
  padding: 5px 6px;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
}
.cpv2-btn-vaciar:hover { color: #374151; }
.cpv2-btn-confirm {
  margin-left: auto;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.cpv2-btn-confirm:hover { background: var(--primary-light); }
```

- [ ] **Step 3: Verificar en dev server**

Verificar:
- Click en celda vacía → popover con input enfocado, sin texto
- Escribir texto + Enter → celda guarda con valor 'si' y nota = texto
- Sin texto + Enter → celda guarda como 'si' (muestra "Sí")
- Click "Por definir" → celda guarda como 'pd'
- Click "Vaciar" → celda vuelve a vacío
- ESC → cierra sin guardar
- Click fuera → cierra sin guardar
- Celda con valor existente → popover arranca con nota cargada
- Tab entre input y botones funciona naturalmente

- [ ] **Step 4: Commit**

```bash
git add src/apps/mesa-medios/components/CellPopover.jsx src/index.css
git commit -m "feat(cell-popover): redesign with direct-input flow, remove No state"
```

---

## Task 6: Parte 3 — Limpieza de estado "No" en toda la app

**Files:**
- Modify: `src/apps/mesa-medios/components/MediaTable.jsx`
- Modify: `src/apps/mesa-medios/MesaMediosApp.jsx`

- [ ] **Step 1: Actualizar `getCellMeta` en MediaTable — eliminar caso 'no'**

Reemplazar la función `getCellMeta` (línea ~8):

```js
// ANTES:
function getCellMeta(raw) {
  if (!raw) return { status: 'empty', display: '', name: '' }
  const lower = raw.toLowerCase().trim()
  if (lower === 'no') return { status: 'no', display: 'No', name: '' }
  if (lower.startsWith('pd')) {
    const parts = raw.split('/')
    const name  = parts[1]?.trim() || ''
    return { status: 'pd', display: name || 'PD', name }
  }
  if (lower.startsWith('si')) {
    const parts = raw.split('/')
    const name  = parts[1]?.trim() || 'Sí'
    return { status: 'si', display: name, name }
  }
  return { status: 'empty', display: raw, name: '' }
}

// DESPUÉS:
function getCellMeta(raw) {
  if (!raw) return { status: 'empty', display: '' }
  const lower = raw.toLowerCase().trim()
  if (lower.startsWith('pd')) {
    const parts = raw.split('/')
    const name  = parts[1]?.trim() || ''
    return { status: 'pd', display: name || 'PD' }
  }
  if (lower.startsWith('si')) {
    const parts = raw.split('/')
    const name  = parts[1]?.trim() || ''
    return { status: 'si', display: name || 'Sí' }
  }
  return { status: 'empty', display: '' }
}
```

- [ ] **Step 2: Eliminar pill "No aplica" en filtros desktop de MesaMediosApp**

En la sección de pills de estado de celda (línea ~697):

```jsx
// ANTES:
{[{ value: 'all', label: 'Todas las celdas' }, { value: 'si', label: '✓ Confirmado' }, { value: 'pd', label: '◉ Por definir' }, { value: 'no', label: '✕ No aplica' }, { value: 'empty', label: '○ Vacías' }].map(f => (
// DESPUÉS:
{[{ value: 'all', label: 'Todas las celdas' }, { value: 'si', label: '✓ Confirmado' }, { value: 'pd', label: '◉ Por definir' }, { value: 'empty', label: '○ Vacías' }].map(f => (
```

- [ ] **Step 3: Eliminar opción 'no' del filtro en BottomSheet mobile**

En la sección de estado de celda del BottomSheet (línea ~907):

```jsx
// ANTES:
{[
  { value: 'all',   label: 'Todas' },
  { value: 'si',    label: 'Confirmado' },
  { value: 'pd',    label: 'Por definir' },
  { value: 'no',    label: 'No aplica' },
  { value: 'empty', label: 'Vacías' },
].map(...)}
// DESPUÉS:
{[
  { value: 'all',   label: 'Todas' },
  { value: 'si',    label: 'Confirmado' },
  { value: 'pd',    label: 'Por definir' },
  { value: 'empty', label: 'Vacías' },
].map(...)}
```

- [ ] **Step 4: Eliminar rama `filterCellStatus === 'no'` en `displayTemas`**

En el `useMemo` de `displayTemas`, en el bloque del filtro de estado de celda:

```js
// ANTES:
if (filterCellStatus === 'si')    return valor?.toLowerCase().startsWith('si')
if (filterCellStatus === 'pd')    return valor?.toLowerCase().startsWith('pd')
if (filterCellStatus === 'no')    return valor?.toLowerCase() === 'no'
if (filterCellStatus === 'empty') return !valor
// DESPUÉS:
if (filterCellStatus === 'si')    return valor?.toLowerCase().startsWith('si')
if (filterCellStatus === 'pd')    return valor?.toLowerCase().startsWith('pd')
if (filterCellStatus === 'empty') return !valor
```

- [ ] **Step 5: Verificar en dev server**

Verificar: el filtro de "No aplica" ya no aparece. Las celdas ya no pueden quedar en estado "No". Celdas legacy con `status-no` mostrarán vacío tras el SQL.

- [ ] **Step 6: Commit**

```bash
git add src/apps/mesa-medios/components/MediaTable.jsx src/apps/mesa-medios/MesaMediosApp.jsx
git commit -m "feat(cell-cleanup): remove No state from getCellMeta, filters and pills"
```

---

## Task 7: Parte 4 — Estado filtros multi-columna en MesaMediosApp

**Files:**
- Modify: `src/apps/mesa-medios/MesaMediosApp.jsx`

- [ ] **Step 1: Agregar estado `activeColumnFilters`**

En el bloque de estados (junto a los otros filtros):

```js
const [activeColumnFilters, setActiveColumnFilters] = useState(new Set())
```

- [ ] **Step 2: Agregar handler `toggleColumnFilter`**

```js
const toggleColumnFilter = useCallback((colId) => {
  setActiveColumnFilters(prev => {
    const next = new Set(prev)
    if (next.has(colId)) {
      next.delete(colId)
    } else {
      next.add(colId)
      setFilterGroup('all')  // desactivar filtro de grupo al activar filtro de columna
    }
    return next
  })
}, [])
```

- [ ] **Step 3: Actualizar `visibleCols` useMemo para priorizar filtros de columna**

Reemplazar el `visibleCols` useMemo existente:

```js
// ANTES:
const visibleCols = useMemo(() => {
  if (filterGroup === 'all') return MEDIA_COLS
  return MEDIA_COLS.filter(c => c.group === filterGroup)
}, [filterGroup])

// DESPUÉS:
const visibleCols = useMemo(() => {
  if (activeColumnFilters.size > 0) {
    return MEDIA_COLS.filter(c => activeColumnFilters.has(c.id))
  }
  if (filterGroup === 'all') return MEDIA_COLS
  return MEDIA_COLS.filter(c => c.group === filterGroup)
}, [activeColumnFilters, filterGroup])
```

- [ ] **Step 4: Agregar filtro de columnas en `displayTemas` useMemo**

Al final del `displayTemas` useMemo, antes del `return result`, agregar:

```js
// Filtro por columnas activas: solo temas con al menos una celda con valor en alguna columna filtrada
if (activeColumnFilters.size > 0 && activeTab === 'active') {
  const activeColIds = [...activeColumnFilters]
  result = result
    .map(tema => ({
      ...tema,
      planificaciones: tema.planificaciones.filter(p =>
        activeColIds.some(colId => {
          const { valor } = getCellData(p.medios, colId)
          return valor && valor !== ''
        })
      )
    }))
    .filter(tema => tema.planificaciones.length > 0)
}
```

También agregar `activeColumnFilters` al array de deps del useMemo.

- [ ] **Step 5: Agregar useEffect para auto-expandir temas cuando hay filtros de columna**

```js
useEffect(() => {
  if (activeColumnFilters.size > 0) {
    const activeColIds = [...activeColumnFilters]
    const toExpand = new Set(
      temas
        .filter(t => !t.archived)
        .filter(t =>
          t.planificaciones.some(p =>
            activeColIds.some(colId => {
              const { valor } = getCellData(p.medios, colId)
              return valor && valor !== ''
            })
          )
        )
        .map(t => t.id)
    )
    setExpandedTemas(toExpand)
  }
}, [activeColumnFilters]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 6: Actualizar `switchTab` — resetear filtros de columna al cambiar tab**

```js
function switchTab(tab) {
  setActiveTab(tab)
  setFilterInput('')
  setFilterGroup('all')
  setFilterCellStatus('all')
  setFilterDateRange({ from: '', to: '' })
  setExpandedTemas(new Set())
  setActiveColumnFilters(new Set())  // NEW
}
```

- [ ] **Step 7: Actualizar `mobileActiveFilterCount`**

```js
const mobileActiveFilterCount = [
  filterGroup !== 'all',
  filterCellStatus !== 'all',
  filterDateRange.from || filterDateRange.to,
  activeColumnFilters.size > 0,  // NEW
].filter(Boolean).length
```

- [ ] **Step 8: Pasar props a MediaTable**

En `<MediaTable>`:

```jsx
activeColumnFilters={activeColumnFilters}
onToggleColumnFilter={toggleColumnFilter}
```

- [ ] **Step 9: Commit**

```bash
git add src/apps/mesa-medios/MesaMediosApp.jsx
git commit -m "feat(column-filters): state, logic, auto-expand and displayTemas filtering in App"
```

---

## Task 8: Parte 4 — Iconos de filtro en headers de columna (MediaTable)

**Files:**
- Modify: `src/apps/mesa-medios/components/MediaTable.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Agregar props `activeColumnFilters` y `onToggleColumnFilter` en MediaTable**

En la destructuración de props (línea ~449):

```js
activeColumnFilters = new Set(),
onToggleColumnFilter,
```

- [ ] **Step 2: Actualizar ROW 3 (sub-header-row) con iconos de filtro**

Reemplazar el bloque de ROW 3 (línea ~577):

```jsx
{/* ROW 3: Columnas individuales con iconos de filtro */}
<tr className="sub-header-row">
  {activeGroups.map(g => {
    if (collapsedGroups.has(g.id)) return <th key={g.id} scope="col" className="sub-header sub-header-placeholder" />
    return activeCols.filter(c => c.group === g.id).map(col => {
      const isFiltered = activeColumnFilters.has(col.id)
      return (
        <th key={col.id} scope="col" className={`sub-header${isFiltered ? ' sub-header-filtered' : ''}`}>
          <span className="sub-label">{col.label}</span>
          {col.sub && <span className="sub-sublabel">{col.sub}</span>}
          <button
            className={`col-filter-btn${isFiltered ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleColumnFilter?.(col.id) }}
            title={isFiltered ? `Quitar filtro de ${col.label}` : `Filtrar por ${col.label}`}
            aria-label={isFiltered ? `Quitar filtro de ${col.label}` : `Filtrar por ${col.label}`}
          >
            {isFiltered ? (
              /* X para quitar el filtro */
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            ) : (
              /* Embudo */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M1 2h8L6 5.5V8.5L4 7.5V5.5L1 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </th>
      )
    })
  })}
</tr>
```

- [ ] **Step 3: Agregar empty state para filtros de columna sin resultados**

En el bloque de `temas.length === 0` en MediaTable, actualizar el mensaje cuando hay filtros de columna activos:

```jsx
{temas.length === 0 ? (
  <tr>
    <td colSpan={totalColSpan} className="empty-state-cell">
      {totalTemas === 0 ? (
        /* ... mismo que antes ... */
      ) : activeColumnFilters.size > 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">⚙</span>
          <p className="empty-state-title">Sin temas con datos en las columnas filtradas</p>
          <span className="empty-state-sub">
            Ningún tema tiene contenido en {activeColumnFilters.size === 1 ? 'la columna seleccionada' : 'las columnas seleccionadas'}
          </span>
          <button className="empty-state-ghost" onClick={() => onToggleColumnFilter?.('__clear__')}>
            ✕ Limpiar filtros de columna
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon">🔍</span>
          <p className="empty-state-title">Sin resultados para "{filterQuery}"</p>
          <span className="empty-state-sub">Prueba con otro término de búsqueda</span>
          <button className="empty-state-ghost" onClick={onClearFilter}>✕ Limpiar búsqueda</button>
        </div>
      )}
    </td>
  </tr>
) : ...}
```

**Nota:** Para el botón "Limpiar filtros de columna" en el empty state, agregar un handler en MesaMediosApp:

```js
const clearColumnFilters = useCallback(() => setActiveColumnFilters(new Set()), [])
```

Y pasar `onClearColumnFilters={clearColumnFilters}` a MediaTable. En MediaTable, el botón llama `onClearColumnFilters?.()` (no el hack de `'__clear__'`). Actualizar la prop destructuración:

```js
onClearColumnFilters,
```

Y el botón:

```jsx
<button className="empty-state-ghost" onClick={onClearColumnFilters}>
  ✕ Limpiar filtros de columna
</button>
```

- [ ] **Step 4: CSS para iconos de filtro en columnas**

```css
/* ── Filtros de columna — headers ───────────────────────────── */
.sub-header-filtered {
  background: rgba(15, 43, 65, 0.06) !important;
}
.col-filter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin-left: 3px;
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  border-radius: 3px;
  vertical-align: middle;
  transition: color 0.12s, background 0.12s;
  flex-shrink: 0;
}
.col-filter-btn:hover {
  color: var(--primary);
  background: rgba(15, 43, 65, 0.08);
}
.col-filter-btn.active {
  color: var(--primary);
  background: rgba(15, 43, 65, 0.1);
}
/* Ajuste para que el sub-header con icono se vea bien */
.sub-header {
  white-space: nowrap;
}
```

- [ ] **Step 5: Verificar en dev server**

Verificar:
- Cada columna tiene icono de embudo en su header
- Click en embudo → ícono cambia a X, columna destacada, se filtran filas
- Click en X → columna vuelve a normal, filtro se quita
- Múltiples columnas activas simultáneamente

- [ ] **Step 6: Commit**

```bash
git add src/apps/mesa-medios/components/MediaTable.jsx src/index.css
git commit -m "feat(column-filters): filter icons in column headers, empty state for filtered view"
```

---

## Task 9: Parte 4 — Indicador en toolbar + sección mobile en BottomSheet

**Files:**
- Modify: `src/apps/mesa-medios/MesaMediosApp.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Agregar badge "X columnas" + botón "Limpiar columnas" en toolbar**

En la sección `medios-filter-active` (línea ~703), actualizar para incluir el indicador de columnas:

```jsx
{/* Indicador activo — filtros de texto, grupo, celda, fechas */}
{hasActiveFilters && (
  <div className="medios-filter-active">
    <span className="filter-count">{displayTemas.length} de {activeCount} temas · {displayPlanifs} de {totalPlanifs} fechas</span>
    {filterGroup !== 'all' && <span className="filter-count"> · {visibleCols.length} columnas</span>}
    <button className="filter-reset" onClick={() => { setFilterInput(''); setFilterGroup('all'); setFilterCellStatus('all'); setFilterDateRange({ from: '', to: '' }) }}>Limpiar filtros</button>
  </div>
)}

{/* Indicador filtros de columna activos (independiente del hasActiveFilters) */}
{activeColumnFilters.size > 0 && (
  <div className="medios-filter-active medios-filter-cols-active">
    <span className="column-filter-badge">
      ⚙ {activeColumnFilters.size} columna{activeColumnFilters.size !== 1 ? 's' : ''} filtrada{activeColumnFilters.size !== 1 ? 's' : ''}
    </span>
    <span className="filter-count">
      {displayTemas.length} de {activeCount} tema{activeCount !== 1 ? 's' : ''}
    </span>
    <button className="filter-reset" onClick={() => setActiveColumnFilters(new Set())}>
      Limpiar columnas
    </button>
  </div>
)}
```

- [ ] **Step 2: Agregar sección de columnas en el BottomSheet mobile**

En el BottomSheet de filtros móviles, agregar DESPUÉS de la sección "RANGO DE FECHAS":

```jsx
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
    <button className="sheet-clear-btn" onClick={() => setActiveColumnFilters(new Set())} style={{ marginTop: 8 }}>
      Limpiar filtros de columna ({activeColumnFilters.size})
    </button>
  )}
</div>
```

- [ ] **Step 3: CSS para badge de columnas y sección mobile**

```css
/* ── Toolbar: badge de columnas activas ─────────────────────── */
.medios-filter-cols-active {
  border-top: 1px solid #e5e7eb;
  padding-top: 6px;
  margin-top: 4px;
}
.column-filter-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

/* ── BottomSheet: sección de columnas ───────────────────────── */
.sheet-col-group {
  margin-bottom: 12px;
}
.sheet-col-group-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 6px;
}
.sheet-col-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sheet-col-check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-main);
  cursor: pointer;
}
.sheet-col-check-label input[type="checkbox"] {
  accent-color: var(--primary);
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verificar en dev server**

Verificar:
- Con filtros de columna activos, aparece el badge "⚙ X columnas filtradas" + botón "Limpiar columnas"
- Botón "Limpiar columnas" desactiva todos los filtros de columna
- En mobile: bottom sheet tiene sección de columnas con checkboxes organizados por grupo
- Los checkboxes en mobile funcionan igual que los iconos en desktop

- [ ] **Step 5: Commit**

```bash
git add src/apps/mesa-medios/MesaMediosApp.jsx src/index.css
git commit -m "feat(column-filters): toolbar badge, clear button, mobile column filter section"
```

---

## Task 10: Build final, verificación mental y deploy

**Files:**
- (ningún archivo nuevo — solo verificación y build)

- [ ] **Step 1: Tests mentales obligatorios — filtros multi-columna**

Verificar cada escenario en el dev server:

```
✅ Activar filtro de "Pantallas" → solo columnas: TEMAS, FECHA, Pantallas
   Filas: solo temas con valor en Pantallas
✅ Agregar filtro de "Instagram" → columnas: TEMAS, FECHA, Pantallas, Instagram
   Filas: temas con valor en Pantallas O Instagram
✅ Quitar filtro de "Pantallas" → queda solo Instagram. Filas se ajustan.
✅ Quitar último filtro → todas las columnas vuelven, todos los temas vuelven.
✅ Combinar con búsqueda: solo temas que matchean el texto Y tienen valor en columnas filtradas.
✅ Combinar con filtro de celda "Confirmado": solo celdas confirmadas en columnas filtradas.
✅ Click en celda filtrada para editar → popover funciona normal.
✅ Cambiar valor de celda filtrada a vacío → fila desaparece si era el único motivo de aparecer.
✅ Filtro de grupo + filtro de columna → filtro de grupo se desactiva automáticamente.
```

- [ ] **Step 2: Tests mentales — status + alertas**

```
✅ Tema nuevo → badge "✦ Nuevo" visible
✅ Agregar planificación a tema "Nuevo" → status cambia a "En desarrollo"
✅ Marcar celda en tema "Nuevo" → status cambia a "En desarrollo"
✅ Select dropdown en tema → cambiar a "En desarrollo" → funciona sin confirmación
✅ Select dropdown → cambiar a "Completado" → ConfirmDialog aparece → al confirmar, archivado
✅ Badge "⚠ Cerrar tema" aparece en temas "En desarrollo" con todas las fechas > 14 días pasadas
✅ Click en badge → ConfirmDialog → al confirmar, archivado
✅ Al archivar manualmente → status queda en "Completado"
✅ Al reactivar → status vuelve a "En desarrollo"
✅ Realtime: status actualizado desde otra sesión se refleja automáticamente
```

- [ ] **Step 3: Tests mentales — popover + limpieza "No"**

```
✅ Click en celda vacía → popover con input enfocado, sin texto
✅ Escribir "Juan" + Enter → celda muestra "Sí", con icono de nota si hay texto
✅ Sin texto + Enter → celda muestra "Sí" (sin icono de nota)
✅ Click "Por definir" → celda muestra "PD"
✅ Click "Vaciar" → celda vacía
✅ ESC → cierra sin guardar
✅ Click fuera → cierra sin guardar
✅ Celda legacy "si/Juan" → popover arranca con "Juan" en input
✅ Pill "No aplica" eliminada del toolbar de filtros
✅ Opción "No aplica" eliminada del BottomSheet mobile
✅ Mesa Editorial NO se ve afectada
```

- [ ] **Step 4: Ejecutar build**

```bash
npm run build
```

Esperado: build exitoso sin errores. Si hay warnings de tipos o linting, revisar e ignorar los que sean irrelevantes (console.log legítimos, etc.).

- [ ] **Step 5: Merge a main**

```bash
git checkout main
git merge feat/release-mejoras-2 --no-ff -m "merge(feat/release-mejoras-2): status + alertas + popover rediseñado + filtros multi-columna"
```

- [ ] **Step 6: Push + deploy**

```bash
git push && npm run deploy
```

- [ ] **Step 7: Recordatorio SQL**

```
⚠️  EJECUTAR EN SUPABASE ANTES DE PROBAR EN PRODUCCIÓN:
    1. scripts/add-medios-status.sql
    2. scripts/migrate-cell-no-to-empty.sql
    
    Orden importa: ejecutar status primero, migrate después.
```

- [ ] **Step 8: Actualizar ESTADO-PROYECTO.md**

Actualizar las secciones relevantes:
- Sección 5 (BD): agregar columna `status` en tabla `temas`
- Sección 9 (Scripts SQL): agregar los 2 nuevos scripts como ⏳ PENDIENTE
- Sección 11 (Funcionalidades):
  - Agregar `Status de temas (Nuevo/En desarrollo/Completado)` ✅
  - Agregar `Alertas por fecha desfasada (badge ⚠ Cerrar tema)` ✅
  - Actualizar `Edición inline de celdas (si/pd + notas)` (eliminar "no")
  - Agregar `Filtros multi-columna con iconos en headers` ✅
- Actualizar fecha/branch/commit en la cabecera

```bash
git add ESTADO-PROYECTO.md
git commit -m "docs(estado): update after release-mejoras-2"
git push
```

---

## Self-Review del Plan

**Cobertura del spec:**

| Requisito | Tarea |
|---|---|
| SQL add-medios-status | Task 1 |
| SQL migrate-cell-no | Task 1 |
| Status badge UI (Nuevo/En desarrollo/Completado) | Task 3 |
| Dropdown cambio de status | Task 3 |
| Transición automática Nuevo → En desarrollo | Task 2 |
| Completado → archivado automático + confirmDialog | Task 2+3 |
| Realtime status | Gratis — realtime ya escucha cambios en `temas` |
| Alerta "⚠ Cerrar tema" con umbral 14 días | Task 4 |
| Click badge → confirmDialog → archivado | Task 4 |
| Eliminar estado "No" | Task 5+6 |
| SQL migración celdas "no" | Task 1 |
| Nuevo popover: input enfocado, Enter→Confirmado | Task 5 |
| Botones Por definir / Vaciar / Confirmar | Task 5 |
| ESC cierra sin guardar | Task 5 |
| Legacy format compatibility (si/Juan) | Task 5 — parseValue() |
| Iconos filtro en cada header de columna | Task 8 |
| Multi-selección de columnas | Task 7+8 |
| Filtros de columna en AND con otros filtros | Task 7 |
| Auto-expandir temas con filtros de columna | Task 7 |
| Badge "X columnas" + Limpiar columnas | Task 9 |
| Mobile: sección columnas en BottomSheet | Task 9 |
| Filtros columna NO persistidos entre sesiones | Task 7 — useState inicia vacío |
| Desactivar filterGroup al activar filtro columna | Task 7 |
| Empty state para filtros columna sin resultados | Task 8 |
| Build + deploy | Task 10 |
| ESTADO-PROYECTO.md actualizado | Task 10 |
| Mesa Editorial sin cambios | — no se toca ningún archivo de editorial |

**Verificación de consistencia de tipos:**

- `activeColumnFilters`: `Set<string>` — usado consistentemente como Set en App, MediaTable y BottomSheet
- `toggleColumnFilter(colId: string)`: acepta string (col.id), llama setActiveColumnFilters
- `onStatusChange(temaId: string, newStatus: string)`: usado en TemaRow, badge stale, y MediaTable
- `handleStatusChange` en App: recibe `(temaId, newStatus)` ✓
- `getCellMeta(raw: string)`: retorna `{ status: string, display: string }` (name eliminado — no se usaba)

**Placeholders:** ninguno — todos los steps tienen código completo.
