# Estado del Proyecto — Mesa de Medios USS
**Actualizado:** 2026-04-18 | **Branch:** `main` | **Commit:** `02f4bc7`

---

## Tabla de Contenidos
1. [Descripción General](#1-descripción-general)
2. [Stack Técnico](#2-stack-técnico)
3. [Estructura de Carpetas](#3-estructura-de-carpetas)
4. [Módulos de la Aplicación](#4-módulos-de-la-aplicación)
5. [Base de Datos (Supabase)](#5-base-de-datos-supabase)
6. [CSS — Diseño y Clases Clave](#6-css--diseño-y-clases-clave)
7. [Deploy y Configuración](#7-deploy-y-configuración)
8. [Estado del Git](#8-estado-del-git)
9. [Scripts SQL de Migración](#9-scripts-sql-de-migración)
10. [Deuda Técnica](#10-deuda-técnica)
11. [Funcionalidades por Módulo](#11-funcionalidades-por-módulo)

---

## 1. Descripción General

Dashboard colaborativo en tiempo real para el equipo de Comunicaciones USS. Tiene **dos módulos** accesibles desde un selector:

| Módulo | Propósito |
|---|---|
| **Mesa de Medios** | Planificación de cobertura mediática por canal (39 columnas, 3 grupos) |
| **Mesa Editorial** | Gestión de acciones editoriales por eje temático (5 ejes, Resultados + Backlogs) |

**URL producción:** https://comunicaciones-uss.github.io/sistema-gestion/

**Autenticación:** Email @uss.cl + PIN de 6 dígitos por usuario (hash SHA-256, rate limiting).

---

## 2. Stack Técnico

| Capa | Tecnología | Versión |
|---|---|---|
| UI | React | 18.2 |
| Build | Vite + @vitejs/plugin-react | 5.0 / 4.2 |
| Backend / DB | Supabase (PostgreSQL + Realtime) | ^2.39 |
| Deploy | GitHub Pages via `gh-pages` | ^6.1 |
| Estilos | CSS puro (index.css, 4400+ líneas) | — |
| Runtime | Browser (SPA, sin SSR) | — |

**Variables de entorno (`.env`):**
```
VITE_SUPABASE_URL=https://[proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=[anon key]
```

**Comandos:**
```bash
npm run dev      # Dev server → localhost:5173
npm run build    # Build → dist/
npm run deploy   # Build + push a gh-pages (publica en producción)
```

---

## 3. Estructura de Carpetas

```
mesa-medios-main/
├── src/
│   ├── main.jsx                        # Entry point
│   ├── App.jsx                         # Router: auth → selector → módulo
│   ├── index.css                       # Estilos globales (~4440 líneas)
│   ├── assets/
│   │   ├── escudo-uss-horizontal-azul.svg
│   │   └── escudo-uss-horizontal-blanco.svg
│   └── apps/
│       ├── shared/
│       │   ├── DashboardSelector.jsx   # Selector Mesa Medios / Editorial
│       │   ├── components/
│       │   │   ├── Login.jsx           # Auth PIN + rate limiting
│       │   │   ├── UserProfilePanel.jsx # Stats + audit log + gestión PINs
│       │   │   ├── Toaster.jsx         # Notificaciones toast (máx 3)
│       │   │   ├── ConfirmDialog.jsx   # Modal confirmación genérico
│       │   │   └── USSLoader.jsx       # Spinner animado USS
│       │   ├── hooks/
│       │   │   ├── useToast.js         # Toast state: addToast / removeToast
│       │   │   └── useDebounce.js      # 300ms debounce para filtros
│       │   └── utils/
│       │       ├── supabase.js         # Cliente Supabase (NO MODIFICAR)
│       │       ├── crypto.js           # SHA-256 hash de PINs
│       │       └── audit.js            # logAuditEntry() — helper centralizado audit_logs
│       │
│       ├── mesa-medios/
│       │   ├── MesaMediosApp.jsx       # App principal (~1500 líneas)
│       │   ├── config.js               # MEDIA_COLS (39 cols) + GROUPS (3 grupos)
│       │   ├── utils.js                # getCellData / setCellData (JSONB dual format)
│       │   └── components/
│       │       ├── Header.jsx          # Header con logo, filtros, botones
│       │       ├── MediaTable.jsx      # Tabla principal con grupos colapsables
│       │       ├── MobileCardView.jsx  # Vista mobile
│       │       ├── AddRowModal.jsx     # Modal nuevo tema / nueva fecha
│       │       ├── AuditLogPanel.jsx   # Panel historial de actividad
│       │       └── CellPopover.jsx     # Popover edición de celdas media
│       │
│       └── mesa-editorial/
│           ├── MesaEditorialApp.jsx    # App principal (~900 líneas)
│           ├── config.js               # EJES (5) + TIPOS + STATUS configs
│           └── components/
│               ├── Header.jsx          # Header Mesa Editorial
│               ├── EditorialTable.jsx  # Tabla por ejes
│               ├── EjeSection.jsx      # Sección colapsable: resultados + backlogs
│               ├── MobileCardView.jsx  # Vista mobile
│               ├── AddActionModal.jsx  # Modal nueva acción
│               ├── ExplorerSidebar.jsx # Sidebar exploración de temas (z-index: 201)
│               └── OrphanAssigner.jsx  # Asignador de backlogs huérfanos
│
├── scripts/                            # SQL de migración para Supabase
│   ├── add-archived-field.sql          # ← PENDIENTE EJECUTAR EN SUPABASE
│   ├── add-completed-at.sql
│   ├── add-parent-and-tipologia.sql
│   ├── add-pin-per-user.sql
│   ├── migrate-ao-to-always-on.sql
│   ├── migrate-rrss-split.sql
│   ├── migrate-tipo-accion.sql
│   ├── refactor-temas-sincronizacion.sql
│   └── rename-ejes.sql
│
├── dist/                               # Build de producción (ignorado en .gitignore)
├── vite.config.js
├── package.json
├── DIAGNOSTICO.md                      # Deuda técnica (referencia histórica)
└── ESTADO-PROYECTO.md                 # Este archivo
```

---

## 4. Módulos de la Aplicación

### 4.1 App.jsx — Router Principal

**Flujo:**
```
Carga → Supabase session check
  ↓ sin sesión → Login.jsx
  ↓ con sesión → DashboardSelector.jsx
    ↓ elige "Medios"    → MesaMediosApp.jsx
    ↓ elige "Editorial" → MesaEditorialApp.jsx
```

El registro de LOGIN lo hace únicamente `Login.jsx` via `logAuditEntry()`. `App.jsx` no inserta nada en `audit_logs`.

---

### 4.2 Mesa de Medios — MesaMediosApp.jsx

**Propósito:** Tabla de planificación de cobertura mediática con 39 canales organizados en 3 grupos.

**Estado principal:**
| Estado | Tipo | Descripción |
|---|---|---|
| `temas[]` | Array | Temas con `planificaciones[]` anidadas |
| `filterInput` | String | Búsqueda por texto (debounced) |
| `filterDateRange` | Object | Rango de fechas |
| `filterGroup` | String | Filtro por grupo de medios |
| `filterCellStatus` | String | Filtro `si`/`pd`/`no` |
| `collapsedGroups` | Object | Estado colapsado de grupos |
| `expandedTemas` | Object | Qué temas tienen filas expandidas |

**Funciones clave:**
- `handleCellChange(temaId, planId, colId, value)` — Guarda celda en BD (optimistic)
- `handleDeleteRow(planId)` — Elimina planificación
- `handleAddTema(nombre)` — Crea nuevo tema canónico
- `handleAddPlanificacion(temaId, fecha)` — Agrega fila de fecha a tema existente
- `logAction(accion, itemId, nombre, detalle)` — Registra en `audit_logs`

**Realtime:** Escucha cambios en `temas`, `contenidos`, `usuarios_autorizados`.

**Sticky:** Header a `top: 0` (z-index 100), filter bar a `top: 68px` (z-index 90). Tabla con scroll vertical interno usando `height: calc(100vh - var(--above-table, 165px) - 70px)` y `thead { position: sticky; top: 0 }`.

---

### 4.3 Mesa Editorial — MesaEditorialApp.jsx

**Propósito:** Gestión de acciones editoriales clasificadas por eje, tipo (Resultado/Backlog) y status.

**Ejes (5):**
- Discusión País
- Innovación y Emprendimiento
- Comunidad y Territorio
- Ciencia y Sustentabilidad
- Cultura y Deporte

**Estado principal:**
| Estado | Tipo | Descripción |
|---|---|---|
| `rows[]` | Array | Todas las acciones editoriales |
| `activeTab` | String | `'active'` \| `'archived'` |
| `filterInput` | String | Búsqueda por texto |
| `filterEje` | String | Filtro por eje |
| `filterStatus` | String | Filtro por status (solo tab Activas) |
| `filterTipoAccion` | String | Filtro Backlog/Resultado (solo tab Activas) |
| `confirmDelete` | Object \| null | `{ id, nombre, childCount }` |
| `confirmArchive` | Object \| null | `{ id, nombre, pendingChildCount }` |
| `confirmReactivate` | Object \| null | `{ id, nombre, tipo }` |
| `showExplorer` | Boolean | Sidebar exploración activo |
| `explorerFilter` | Object \| null | `{ eje, tema }` desde ExplorerSidebar |

**Archivado (feature reciente):**
- Al marcar status → `'Completado'` se activa `handleInitiateArchive()`
- Backlogs: archivado inmediato
- Resultados con backlogs pendientes: muestra `ConfirmDialog` para archivar todo en cascada
- Tab "Archivadas": modo solo lectura, columna "Archivado el", botón "Reactivar" por fila

**Sticky:** Bloque unificado `.editorial-sticky-block { position: sticky; top: 0; z-index: 100 }` que envuelve Header + Tabs + KPI bar + Filter bar. El header dentro del editorial no tiene sticky propio (`.app-editorial .header { position: relative }`).

**Funciones clave:**
- `handleInitiateArchive(rowId, row)` — Inicia flujo de archivado
- `handleDoArchive(rowId, archiveChildren)` — Archiva en BD + cascade
- `handleReactivate(rowId)` — Reactiva acción (status → 'En desarrollo')
- `handleCellChange(rowId, field, value)` — Edición inline (intercepta status → Completado)
- `switchTab(tab)` — Cambia tab y resetea filtros
- `handleSyncToggle(rowId, enable)` — Vincula/desvincula tema a Mesa de Medios
- `logAction()` — Usa `logAuditEntry()` de `shared/utils/audit.js`

**beforeunload:** Delegación de eventos en `document` detecta campos contentEditable con input sin blur y muestra confirmación nativa del browser antes de cerrar la pestaña.

---

### 4.4 Componentes Compartidos

#### Login.jsx
- Email @uss.cl + PIN 6 dígitos
- SHA-256 hash → query `usuarios_autorizados`
- Rate limiting: 5 intentos fallidos en 10 min → bloqueo temporal
- Registra en `pin_login_attempts` y `audit_logs`

#### ConfirmDialog.jsx
Props: `nombre`, `title`, `body`, `confirmLabel`, `confirmClass`, `onConfirm`, `onCancel`
- Foco automático en "Cancelar" (previene delete accidental con Enter)
- Escape = cancelar
- Dos variantes de botón confirm: `.btn-danger-confirm` (rojo) y `.btn-confirm-action` (navy, no destructivo)

#### Toaster.jsx / useToast.js
- Máximo 3 toasts simultáneos
- Auto-dismiss: 4s (info/success), 6s (error)
- Soporte para `action: { label, onClick }` — botón inline en el toast (ej. "Ver archivadas")

#### UserProfilePanel.jsx
- **Admin** (`leonardo.munoz@uss.cl`): Gestión de PINs (generar, resetear)
- **Todos:** Stats de actividad, audit log personal filtrado
- Filtra acciones editoriales con `.ilike('responsable', userName)` — match exacto case-insensitive por nombre completo

---

## 5. Base de Datos (Supabase)

### Tabla: `contenidos` (Mesa Medios)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
nombre      TEXT NOT NULL             -- Nombre del tema
semana      DATE                      -- Semana de planificación
medios      JSONB                     -- { canal_id: "si/Juan" | {valor, notas} }
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
```
> **Formato JSONB dual:** Legacy = string `"si/Juan"`. Nuevo = objeto `{ valor: "si", notas: "Juan" }`. `getCellData/setCellData` en `utils.js` maneja ambos.

---

### Tabla: `mesa_editorial_acciones` (Mesa Editorial)
```sql
id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()
eje                  TEXT NOT NULL          -- Eje temático
tipo                 TEXT                   -- "Ancla" | "Soporte" | "Always ON"
tema                 TEXT
accion               TEXT                   -- Descripción de la acción
tipo_accion          TEXT                   -- "Resultado" | "Backlog"
tipologia_resultado  TEXT                   -- Tipología (solo Resultados)
fecha                DATE                   -- null si tipo = "Always ON"
responsable          TEXT
status               TEXT DEFAULT 'Pendiente' -- "Pendiente" | "En desarrollo" | "Completado"
parent_id            UUID REFERENCES mesa_editorial_acciones(id) -- FK Backlog → Resultado
sync_to_medios       BOOLEAN DEFAULT FALSE  -- Si está vinculado a Mesa de Medios
tema_id              UUID                   -- ID del tema en tabla temas (si sincronizado)
archived             BOOLEAN DEFAULT FALSE  -- Archivado (requiere SQL: add-archived-field.sql)
archived_at          TIMESTAMPTZ            -- Timestamp de archivado
completed_at         TIMESTAMPTZ            -- Timestamp cuando se marcó Completado
created_at           TIMESTAMPTZ DEFAULT NOW()
updated_at           TIMESTAMPTZ DEFAULT NOW()
```

> **IMPORTANTE:** Las columnas `archived` y `archived_at` requieren ejecutar `scripts/add-archived-field.sql` en el SQL Editor de Supabase.

---

### Tabla: `audit_logs`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
mesa_type   TEXT        -- null | "medios" | "editorial"
user_email  TEXT
action      TEXT        -- "login" | "create" | "update" | "delete"
table_name  TEXT
record_id   UUID
details     TEXT        -- JSON stringificado via logAuditEntry() (registros viejos pueden ser string plano)
created_at  TIMESTAMPTZ DEFAULT NOW()
```
> `parseDetails()` en UserProfilePanel usa try/catch para compatibilidad con registros legacy.

---

### Tabla: `usuarios_autorizados`
```sql
email           TEXT PRIMARY KEY
nombre          TEXT
pin_hash        TEXT        -- SHA-256(PIN) — nunca plaintext
pin_updated_at  TIMESTAMPTZ
activo          BOOLEAN DEFAULT true
```

---

### Tabla: `pin_login_attempts`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
email       TEXT
success     BOOLEAN
created_at  TIMESTAMPTZ DEFAULT NOW()
```

---

### Tabla: `temas`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
nombre      TEXT NOT NULL
origen      TEXT        -- "editorial" | "manual"
eje         TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```
> Usada para sincronización Editorial → Medios. Referenciada por `mesa_editorial_acciones.tema_id`.

---

## 6. CSS — Diseño y Clases Clave

### Paleta de colores
```css
--primary:        #0f2b41   /* Navy USS — header, botones primarios */
--primary-light:  #163d5a
--secondary:      #275da5   /* Azul — bordes, focus */
--accent:         #ceb37c   /* Dorado — botón agregar, accents */

/* Estados de celdas (Mesa Medios) */
--green-bg: #c6efce; --green-text: #1e6621   /* SI */
--yellow-bg: #fff2cc; --yellow-text: #7d5a00 /* PD */
--red-bg: #ffc7ce; --red-text: #8b0000       /* NO */

/* Filas tabla */
--row-odd: #f0f6fc; --row-even: #ffffff; --row-hover: #e3edf8
--border: #d0dce8; --border-group: #275da5
--text-main: #1a2b3c; --text-muted: #5a7a96
```

### Clases clave por sección

**Layout:**
| Clase | Propósito |
|---|---|
| `.app` | `flex-column; min-height: 100vh` |
| `.app-editorial` | Contexto para overrides editorial |
| `.desktop-only` / `.mobile-only` | Media query switches |

**Mesa de Medios:**
| Clase | Propósito |
|---|---|
| `.table-scroll` | Contenedor con scroll vertical interno (`height: calc(100vh - var(--above-table) - 70px)`) |
| `.media-table` | `<table>` principal |
| `.sticky-col` | `position: sticky` para "Contenidos" y "Semana" |
| `.col-contenidos` | `left: 0; z-index: 30` |
| `.col-semana` | `left: 200px; z-index: 30` |
| `.group-header-row` | Fila header de grupos (ORGANICOS, ALIANZAS, PUB_PAGADA) |
| `.sub-header-row` | Fila de sub-headers (nombres de canales) |
| `.data-row` | Fila de datos, `height: 38px` |
| `.medios-filter-bar` | `position: sticky; top: 68px; z-index: 90` |

**Mesa Editorial:**
| Clase | Propósito |
|---|---|
| `.editorial-sticky-block` | `position: sticky; top: 0; z-index: 100` — bloque unificado |
| `.editorial-tabs` | Tabs Activas/Archivadas (dentro del sticky block) |
| `.tab-btn` / `.tab-active` | Botones de tab |
| `.tab-badge` | Contador circular en cada tab |
| `.editorial-kpi-bar` | Barra de KPIs (dentro del sticky block) |
| `.kpi-bar-archived` | Variante gris para tab Archivadas |
| `.editorial-filter-bar` | Toolbar de filtros (dentro del sticky block) |
| `.eje-section` | Sección colapsable por eje |
| `.eje-section-archived` | Variante con opacity reducida en tab Archivadas |
| `.editorial-table` | `<table>` de acciones por eje |
| `.resultado-row` / `.backlog-row` | Filas de la tabla |
| `.row-archived` | Fila archivada: `opacity: 0.75; color: #64748b` |
| `.col-archived-at` | Columna "Archivado el" |
| `.btn-reactivate` | Botón reactivar (solo tab Archivadas) |
| `.explorer-overlay` | `z-index: 200` — sobre sticky block |
| `.explorer-sidebar` | `z-index: 201; position: fixed; right: 0` |

**Compartidos:**
| Clase | Propósito |
|---|---|
| `.toast-container` | `position: fixed; bottom-right` |
| `.toast` / `.toast-success` / `.toast-error` / `.toast-info` | Estados de toast |
| `.toast-action` | Botón inline en toast (ej. "Ver archivadas") |
| `.confirm-overlay` / `.confirm-dialog` | Modal de confirmación |
| `.btn-danger-confirm` | Botón confirm destructivo (rojo) |
| `.btn-confirm-action` | Botón confirm no-destructivo (navy) |
| `.empty-state` | Estado vacío centrado |
| `.modal-overlay` / `.modal-content` | Modales genéricos |

---

## 7. Deploy y Configuración

### vite.config.js
```js
export default defineConfig({
  plugins: [react()],
  base: '/sistema-gestion/',   // Subpath de GitHub Pages
})
```

### Deploy
- **Repositorio:** https://github.com/Comunicaciones-USS/sistema-gestion
- **Rama producción:** `gh-pages` (auto-generada por el package `gh-pages`)
- **Proceso:** `npm run build` → `gh-pages -d dist` → publicado en ~30 segundos
- **No hay CI/CD:** El deploy se ejecuta manualmente desde el equipo local

### Workflow estándar
```bash
# 1. Trabajar en feature branch
git checkout -b feat/nombre-feature

# 2. Hacer cambios, commit
git add <archivos>
git commit -m "feat(scope): descripción"

# 3. Merge a main
git checkout main
git merge feat/nombre-feature --no-ff

# 4. Push + deploy (siempre juntos)
git push && npm run deploy
```

---

## 8. Estado del Git

### Branch actual: `main` (HEAD: `02f4bc7`)

### Últimos 20 commits:
```
02f4bc7 merge(fix/deuda-tecnica-seccion-10): resolver deuda técnica sección 10
15eadb6 refactor(audit): standardize new details entries to JSON via helper
c49dbd6 fix(editorial): make date inputs controlled to reflect realtime changes
4ea6e17 feat(editorial): warn before unload if there are unsaved edits
77aa856 perf(profile): scope editorial responsable filter to exact full name
3c8a7ab fix(editorial): raise ExplorerSidebar z-index above sticky header block
95c48db merge(fix/sticky-header-editorial): sticky header unificado Mesa Editorial
04e7c67 fix(editorial): unify sticky header into single sticky block
baee408 merge(feat/editorial-archive): sistema de archivado Mesa Editorial
9cf6847 feat(editorial): sistema de archivado con tabs Activas/Archivadas
bbab9ab fix(mesa-medios): correct sticky headers by using table-scroll as vertical scroll container
d15ec4a fix(mesa-medios): sticky filter toolbar and table headers on scroll
daadde0 fix(login): restore official USS SVG logo with drop-shadow for contrast
8b99d43 fix(login): replace SVG logo badge with CSS wordmark
5519682 fix(editorial): add delete button to orphan backlogs + cascade delete for resultados
edac8cd style(login): remove logo badge circle, enlarge logo, reposition image, dark gradient bg
4ee7215 fix(login): replace .catch() with try/catch on Supabase insert calls
a49a1d9 feat(login): redesign split layout + PIN-per-user auth + Always ON fecha + checkbox fix
63deb17 chore: cleanup obsolete SQL scripts and gitignore state file
a19f700 release(medios): Release 2 — UX refactor Mesa de Medios, temas canónicos, sync Editorial↔Medios
```

### Branches locales activas:
```
main                             ← producción
arquitectura-dual                ← refactor en progreso (explorar antes de retomar)
mejoras-quick-wins               ← pendiente (tasks 4-9)
fix/deuda-tecnica-seccion-10     ← merged a main ✅
fix/sticky-header-editorial      ← merged a main ✅
feat/editorial-archive           ← merged a main ✅
feat/login-redesign-and-security ← merged a main ✅
feature/estadisticas-perfil      ← merged a main ✅
fix/ajustes-ronda-2              ← estado desconocido
fix/cambios-barbara              ← estado desconocido
fix/delete-backlogs              ← merged o integrado
fix/diagnostico-cleanup          ← integrado en chore commit
fix/editorial-urgente            ← estado desconocido
fix/favicon                      ← integrado
fix/perfil-ux                    ← integrado
```

---

## 9. Scripts SQL de Migración

Todos en `scripts/`. Ejecutar en **Supabase SQL Editor** (no en producción automática).

| Archivo | Estado | Descripción |
|---|---|---|
| `add-archived-field.sql` | ✅ Ejecutado | Agrega `archived BOOLEAN` y `archived_at TIMESTAMPTZ` a `mesa_editorial_acciones` | 
| `add-completed-at.sql` | Ejecutado ✅ | Timestamp `completed_at` |
| `add-parent-and-tipologia.sql` | Ejecutado ✅ | `parent_id` + `tipologia_resultado` |
| `add-pin-per-user.sql` | Ejecutado ✅ | Tabla `usuarios_autorizados` + `pin_hash` |
| `migrate-ao-to-always-on.sql` | Ejecutado ✅ | Rename `"AO"` → `"Always ON"` |
| `migrate-rrss-split.sql` | Ejecutado ✅ | Split columnas RRSS |
| `migrate-tipo-accion.sql` | Ejecutado ✅ | Campo `tipo_accion` |
| `refactor-temas-sincronizacion.sql` | Ejecutado ✅ | Temas canónicos para sync |
| `rename-ejes.sql` | Ejecutado ✅ | Labels de ejes actualizados |

---

## 10. Deuda Técnica

### Sin deuda activa conocida

Todos los ítems documentados anteriormente fueron resueltos o verificados como inexistentes:

| Ítem | Resolución |
|---|---|
| Dead code en `src/` raíz | No existía — doc estaba desactualizada |
| Login duplicado en audit_logs | No existía — `App.jsx` nunca insertó en audit_logs |
| N+1 query en UserProfilePanel | Resuelto — query ya filtraba columnas; se mejoró el filtro |
| Matching frágil por primer nombre | Resuelto — `.ilike('responsable', userName)` (nombre completo) |
| `isContentEditable` faltante en atajos | No existía — ya estaba implementado en línea 130 |
| Sin beforeunload en editorial | Resuelto — delegación de eventos en `MesaEditorialApp` |
| Date input no controlado en EjeSection | Resuelto — `value` + `useState` + `useRef` en ResultadoRow y BacklogRow |
| `audit_logs.details` inconsistente | Resuelto — helper `logAuditEntry()` en `shared/utils/audit.js` |

> Si surge nueva deuda técnica, documentarla aquí con: **Problema · Ubicación · Impacto**.

---

## 11. Funcionalidades por Módulo

### Mesa de Medios

| Funcionalidad | Estado |
|---|---|
| Tabla con 39 canales (3 grupos, múltiples sub-grupos) | ✅ |
| Edición inline de celdas (si/pd/no + notas) via popover | ✅ |
| Filtros: texto, rango de fechas, grupo, estado de celda | ✅ |
| Grupos colapsables | ✅ |
| Temas colapsables (expandir planificaciones por fecha) | ✅ |
| Columnas sticky (Contenidos, Semana) | ✅ |
| Header sticky + filter bar sticky | ✅ |
| Agregar tema nuevo | ✅ |
| Agregar fecha a tema existente | ✅ |
| Eliminar planificación (con confirmación) | ✅ |
| Realtime (cambios de otros usuarios) | ✅ |
| Audit log de actividad | ✅ |
| Vista mobile (cards) | ✅ |
| Sync de temas desde Editorial | ✅ |

### Mesa Editorial

| Funcionalidad | Estado |
|---|---|
| 5 ejes colapsables con progress bar | ✅ |
| Tipos: Ancla, Soporte, Always ON | ✅ |
| Resultados con backlogs vinculados (expandibles) | ✅ |
| Backlogs huérfanos con asignador | ✅ |
| Edición inline de todos los campos | ✅ |
| Status: Pendiente / En desarrollo / Completado | ✅ |
| Filtros: texto, eje, status, tipo acción | ✅ |
| Explorador por eje y tema (sidebar) | ✅ |
| Ordenar por fecha | ✅ |
| Agregar acción con modal | ✅ |
| Eliminar con confirmación (cascade backlogs) | ✅ |
| **Tab Archivadas / Activas** | ✅ |
| **Auto-archivo al marcar Completado** | ✅ |
| **Reactivar acción archivada** | ✅ |
| Sync tema → Mesa de Medios | ✅ |
| KPI bar (completadas, en desarrollo, pendientes, %) | ✅ |
| KPI bar historial (tab Archivadas) | ✅ |
| Header sticky unificado (bloque único) | ✅ |
| Realtime | ✅ |
| Audit log | ✅ |
| Vista mobile (cards) | ✅ |

### Autenticación y Admin

| Funcionalidad | Estado |
|---|---|
| Login PIN por usuario (SHA-256) | ✅ |
| Rate limiting 5 intentos / 10 min | ✅ |
| Panel de usuario con stats | ✅ |
| Historial de actividad personal | ✅ |
| Gestión de PINs (solo admin) | ✅ |
| Selector de módulo con "último usado" | ✅ |
