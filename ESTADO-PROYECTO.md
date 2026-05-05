# Estado del Proyecto — Mesa de Medios USS
**Actualizado:** 2026-05-05 | **Branch:** `main` | **Commit:** `refactor(subtemas): single row per subtema + migration + kebab menu`

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

**Autenticación:** Email @uss.cl + PIN por usuario (hash SHA-256). Validación vía RPC SECURITY DEFINER. Sesión almacenada en `localStorage` (sin Supabase Auth).

---

## 2. Stack Técnico

| Capa | Tecnología | Versión |
|---|---|---|
| UI | React | 18.2 |
| Build | Vite + @vitejs/plugin-react | 5.0 / 4.2 |
| Backend / DB | Supabase (PostgreSQL + Realtime) | ^2.39 |
| Deploy | GitHub Pages via `gh-pages` | ^6.1 |
| Estilos | CSS puro (index.css, ~5440 líneas) | — |
| Generación Excel | xlsx-js-style | ^1.2.0 |
| Runtime | Browser (SPA, sin SSR) | — |

> **Nota performance:** MediaTable usa `React.memo` con comparación custom en `TemaRow` y el patrón `temasRef` en los handlers para evitar re-renders masivos al editar celdas. El `ResizeObserver` de `--above-table` está debounced (100ms) con RAF para evitar layout thrashing.

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
sistema-gestion-main/
├── src/
│   ├── main.jsx                        # Entry point
│   ├── App.jsx                         # Router: auth → selector → módulo
│   ├── index.css                       # Estilos globales (~4900 líneas)
│   ├── assets/
│   │   ├── escudo-uss-horizontal-azul.svg
│   │   ├── escudo-uss-horizontal-blanco.svg
│   │   └── USS-LL-2.webp               # Imagen hero login (columna derecha)
│   └── apps/
│       ├── shared/
│       │   ├── DashboardSelector.jsx   # Selector Mesa Medios / Editorial
│       │   ├── components/
│       │   │   ├── Login.jsx           # Auth PIN + rate limiting + RPC validate_pin
│       │   │   ├── UserProfilePanel.jsx # Stats + audit log + gestión PINs (admin)
│       │   │   ├── Toaster.jsx         # Notificaciones toast (máx 3, con action button)
│       │   │   ├── ConfirmDialog.jsx   # Modal confirmación genérico
│       │   │   ├── USSLoader.jsx       # Spinner animado USS
│       │   │   ├── BottomSheet.jsx     # Bottom sheet para filtros mobile
│       │   │   ├── ExportModal.jsx     # Modal selección de ítems para exportar a Excel
│       │   │   └── KebabMenu.jsx       # Dropdown kebab accesible (items[{label, icon, onClick, variant}])
│       │   ├── hooks/
│       │   │   ├── useToast.js         # Toast state: addToast / removeToast
│       │   │   ├── useDebounce.js      # 300ms debounce para filtros
│       │   │   └── useFocusTrap.js     # Focus trap para modales (Tab/Shift+Tab dentro del overlay)
│       │   └── utils/
│       │       ├── supabase.js         # Cliente Supabase (NO MODIFICAR)
│       │       ├── crypto.js           # SHA-256 hash de PINs via crypto.subtle
│       │       ├── audit.js            # logAuditEntry() — helper centralizado audit_logs
│       │       ├── excelExportMedios.js    # Generador .xlsx ejecutivo Mesa de Medios
│       │       └── excelExportEditorial.js # Generador .xlsx ejecutivo Mesa Editorial
│       │
│       ├── mesa-medios/
│       │   ├── MesaMediosApp.jsx       # App principal
│       │   ├── config.js               # MEDIA_COLS (39 cols) + GROUPS (3 grupos)
│       │   ├── utils.js                # getCellData / setCellData (JSONB dual format)
│       │   └── components/
│       │       ├── Header.jsx          # Header con logo, filtros, botones
│       │       ├── MediaTable.jsx      # Tabla principal con grupos colapsables
│       │       ├── MobileCardView.jsx  # Vista mobile (cards por tema)
│       │       ├── AddRowModal.jsx     # Modal nuevo tema / nueva fecha
│       │       ├── AuditLogPanel.jsx   # Panel historial de actividad
│       │       └── CellPopover.jsx     # Popover edición de celdas (si/pd + notas, input directo)
│       │
│       └── mesa-editorial/
│           ├── MesaEditorialApp.jsx    # App principal
│           ├── config.js               # EJES (5) + TIPOS + STATUS + TIPOLOGIAS
│           └── components/
│               ├── Header.jsx          # Header Mesa Editorial
│               ├── EditorialTable.jsx  # Tabla por ejes (usa EJES para grouping)
│               ├── EjeSection.jsx      # Sección colapsable: resultados + backlogs + col eje editable
│               ├── MobileCardView.jsx  # Vista mobile (cards; eje badge = select)
│               ├── AddActionModal.jsx  # Modal nueva acción (con selector de eje)
│               ├── ExplorerSidebar.jsx # Sidebar exploración de temas (z-index: 201)
│               └── OrphanAssigner.jsx  # Asignador de backlogs huérfanos
│
├── scripts/                            # SQL de migración para Supabase
│   ├── add-archived-field.sql
│   ├── add-archived-medios.sql
│   ├── add-completed-at.sql
│   ├── add-parent-and-tipologia.sql
│   ├── add-performance-indexes.sql
│   ├── add-pin-per-user.sql
│   ├── migrate-ao-to-always-on.sql
│   ├── migrate-rrss-split.sql
│   ├── migrate-tipo-accion.sql
│   ├── refactor-temas-sincronizacion.sql
│   ├── rename-ejes.sql
│   ├── security-rpc-cleanup.sql
│   └── security-rpc-usuarios.sql
│
├── dist/                               # Build de producción (ignorado en .gitignore)
├── vite.config.js
├── package.json
└── ESTADO-PROYECTO.md                 # Este archivo
```

---

## 4. Módulos de la Aplicación

### 4.1 App.jsx — Router Principal

**Flujo:**
```
Carga → check localStorage 'uss_local_session'
  ↓ sin sesión → Login.jsx
  ↓ con sesión → DashboardSelector.jsx
    ↓ elige "Medios"    → MesaMediosApp.jsx
    ↓ elige "Editorial" → MesaEditorialApp.jsx
```

**Session management:**
- Login guarda `{ email, nombre }` en `localStorage` con clave `uss_local_session`
- No se usa Supabase Auth. El cliente Supabase se usa solo para queries DB y Realtime.
- El módulo usado por última vez se guarda en `localStorage` clave `uss_last_dashboard`
- Para los módulos se construye un `sessionCompat = { user: { email } }` que imita la estructura de Supabase session

El registro de LOGIN lo hace únicamente `Login.jsx` via `logAuditEntry()`. `App.jsx` no inserta nada en `audit_logs`.

---

### 4.2 Mesa de Medios — MesaMediosApp.jsx

**Propósito:** Tabla de planificación de cobertura mediática con 39 canales organizados en 3 grupos.

**Estado principal:**
| Estado | Tipo | Descripción |
|---|---|---|
| `temas[]` | Array | Temas con `planificaciones[]` anidadas |
| `filterInput` | String | Búsqueda por texto (debounced 300ms) |
| `filterDateRange` | Object | Rango de fechas |
| `filterGroup` | String | Filtro por grupo de medios |
| `filterCellStatus` | String | Filtro `si`/`pd`/`empty` |
| `activeColumnFilters` | Set\<string\> | IDs de columnas con filtro activo (sesión, no persistido) |
| `collapsedGroups` | Set | IDs de grupos colapsados |
| `expandedTemas` | Set | IDs de temas con filas expandidas |
| `confirmStatusComplete` | Object\|null | `{ id, nombre }` — pendiente de confirmar cambio a Completado |
| `showMobileFilters` | Boolean | Bottom sheet de filtros mobile visible |
| `headerExpanded` | Boolean | Zona B (tabs + filtros) visible; persistido en `localStorage` clave `uss_medios_header_expanded` |

**Funciones clave:**
- `handleCellChange(temaId, planId, colId, value)` — Guarda celda en BD (optimistic)
- `handleDeleteRow(planId)` — Elimina planificación (con confirmación)
- `handleAddTema(nombre)` — Crea nuevo tema canónico en tabla `temas`
- `handleAddPlanificacion(temaId, fecha)` — Agrega fila de fecha a tema existente
- `logAction(accion, itemId, nombre, detalle)` — Registra en `audit_logs`

**Realtime:** Escucha cambios en `temas`, `contenidos`, `usuarios_autorizados`.

**Sticky:** Header a `top: 0` (z-index 100), filter bar a `top: 68px` (z-index 90). Tabla con scroll vertical interno usando `height: calc(100vh - var(--above-table, 165px) - 70px)` y `thead { position: sticky; top: 0 }`. La variable `--above-table` se mide con `ResizeObserver`.

---

### 4.3 Mesa Editorial — MesaEditorialApp.jsx

**Propósito:** Gestión de acciones editoriales clasificadas por eje, tipo (Resultado/Backlog) y status.

**Ejes (5) — valores exactos en BD y config.js:**
```
Conversación País        (color #2A5BA8, responsable Yaritza Ross)
Orgullo USS              (color #C8102E, responsable Natalie Traverso)
Salud                    (color #1D7A4F, responsable Esteban López)
Investigación y Tecnología (color #7A2AB8, responsable Bárbara Ruiz)
Impacto Territorial      (color #B06A00, responsable Sebastián Fuentes)
```

> Historial de renombres: "Discusión País" → "Conversación País", "Salud y Medicina" → "Salud" (migración `rename-ejes.sql`)

**Estado principal:**
| Estado | Tipo | Descripción |
|---|---|---|
| `rows[]` | Array | Todas las acciones editoriales |
| `activeTab` | String | `'active'` \| `'archived'` |
| `filterInput` | String | Búsqueda por texto |
| `filterEje` | String | Filtro por eje |
| `filterStatus` | String | Filtro por status (solo tab Activas) |
| `filterTipoAccion` | String | Filtro Backlog/Resultado (solo tab Activas) |
| `filterDateRange` | Object | Rango de fechas |
| `sortDir` | String \| null | `'asc'` \| `'desc'` \| null |
| `confirmDelete` | Object \| null | `{ id, nombre, childCount }` |
| `confirmArchive` | Object \| null | `{ id, nombre, pendingChildCount }` |
| `confirmReactivate` | Object \| null | `{ id, nombre, tipo }` |
| `showExplorer` | Boolean | Sidebar exploración activo |
| `explorerFilter` | Object \| null | `{ eje, tema }` desde ExplorerSidebar |
| `kpiExpanded` | Boolean | KPI bar expandida en mobile |
| `showMobileFilters` | Boolean | Bottom sheet de filtros mobile visible |

**Archivado:**
- Al marcar status → `'Completado'` se activa `handleInitiateArchive()`
- Backlogs: archivado inmediato
- Resultados con backlogs pendientes: muestra `ConfirmDialog` para archivar en cascada
- Tab "Archivadas": modo solo lectura, columna "Archivado el", botón "Reactivar" por fila

**Eje editable por fila:**
- En la tabla desktop (`EjeSection`): columna "Eje" con `<select>` en cada fila (ResultadoRow y BacklogRow)
- Al cambiar el eje, la fila se mueve visualmente a la sección del nuevo eje (via re-render del `groupByEje`)
- En la vista mobile (`MobileCardView`): el badge de eje en las cards de resultado y backlogs huérfanos es un `<select>` con los 5 ejes
- Guarda con `onCellChange(id, 'eje', nuevoEje)`

**Sticky:** Bloque unificado `.editorial-sticky-block { position: sticky; top: 0; z-index: 100 }` que envuelve Header + Tabs + KPI bar + Filter bar. El header dentro del editorial no tiene sticky propio (`.app-editorial .header { position: relative }`).

**Funciones clave:**
- `handleInitiateArchive(rowId, row)` — Inicia flujo de archivado
- `handleDoArchive(rowId, archiveChildren)` — Archiva en BD + cascade
- `handleReactivate(rowId)` — Reactiva acción (status → 'En desarrollo')
- `handleCellChange(rowId, field, value)` — Edición inline (intercepta status → Completado)
- `switchTab(tab)` — Cambia tab y resetea todos los filtros
- `handleSyncToggle(rowId, enable)` — Vincula/desvincula tema a Mesa de Medios
- `logAction()` — Usa `logAuditEntry()` de `shared/utils/audit.js`

**beforeunload:** Delegación de eventos en `document` detecta campos `contentEditable` con input sin blur y muestra confirmación nativa del browser antes de cerrar la pestaña.

---

### 4.4 Componentes Compartidos

#### Login.jsx
- Email @uss.cl + PIN (cualquier longitud, hash SHA-256 via `crypto.subtle`)
- Validación vía RPC `validate_pin(p_email, p_pin_hash)` — SECURITY DEFINER, nunca expone `pin_hash`
- Rate limiting client-side: 5 intentos fallidos en 10 min → bloqueo temporal (sessionStorage)
- Registra en `pin_login_attempts` (success true/false) y `audit_logs` (solo en login exitoso)
- Diseño split: formulario izquierda (60%), imagen hero derecha (40%) con USS-LL-2.webp
- **Rollback de emergencia:** comentarios en el código permiten revertir a query directa en caso de falla del RPC

#### ConfirmDialog.jsx
Props: `nombre`, `title`, `body`, `confirmLabel`, `confirmClass`, `onConfirm`, `onCancel`
- Foco automático en "Cancelar" (previene delete accidental con Enter)
- Escape = cancelar
- Dos variantes: `.btn-danger-confirm` (rojo, destructivo) y `.btn-confirm-action` (navy, no destructivo)

#### Toaster.jsx / useToast.js
- Máximo 3 toasts simultáneos
- Auto-dismiss: 4s (info/success), 6s (error). Configurable por toast.
- Soporte para `action: { label, onClick }` — botón inline (ej. "Ver archivadas")

#### BottomSheet.jsx
- Componente genérico de bottom sheet para filtros mobile
- Usado en MesaMediosApp y MesaEditorialApp

#### UserProfilePanel.jsx
- **Admin** (`leonardo.munoz@uss.cl`): sección `PinAdminSection` — lista usuarios, genera/resetea PINs
  - Genera PINs random de 6 dígitos, los muestra una sola vez con botón copiar
  - Llama RPC `admin_set_pin(p_admin_email, p_target_email, p_new_hash)`
  - Lista usuarios via RPC `admin_list_users()` (retorna email, nombre, has_pin, activo — nunca pin_hash)
  - **Rollback de emergencia:** comentarios permiten revertir a query directa si RPCs fallan
- **Todos:** stats de actividad, audit log personal filtrado por `user_email`
- Filtro responsable editorial usa `.ilike('responsable', userName)` — match case-insensitive por nombre completo

---

## 5. Base de Datos (Supabase)

### Tabla: `temas` (entidad canónica de topic)
```sql
id           UUID        PRIMARY KEY DEFAULT gen_random_uuid()
nombre       TEXT        NOT NULL
origen       TEXT        NOT NULL DEFAULT 'medios'   -- 'medios' | 'editorial'
eje          TEXT
archived     BOOLEAN     DEFAULT FALSE
archived_at  TIMESTAMPTZ
status       TEXT        DEFAULT 'Nuevo'             -- 'Nuevo' | 'En desarrollo' | 'Completado'
parent_id    UUID        REFERENCES temas(id) ON DELETE CASCADE  -- NULL = padre; NOT NULL = subtema
fecha_inicio DATE                                    -- Solo subtemas
fecha_termino DATE                                   -- Solo subtemas
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()     -- Auto-actualizado por trigger
```
> Trigger `temas_updated_at_trigger` actualiza `updated_at` en cada UPDATE.
> Índices: `idx_temas_archived ON temas(archived)` (script `add-archived-medios.sql`); `idx_temas_status ON temas(status)` (script `add-medios-status.sql`); `idx_temas_parent_id ON temas(parent_id)` (script `add-subtemas-jerarquia.sql`).
> Columnas `parent_id`, `fecha_inicio`, `fecha_termino` agregadas con `scripts/add-subtemas-jerarquia.sql` — ejecutar en Supabase SQL Editor antes de deploy.
> Regla semántica: `status` se ignora para subtemas (no se muestra ni edita). Auto-transición afecta solo al padre.

---

### Tabla: `contenidos` (planificaciones Mesa Medios)
```sql
id          UUID    PRIMARY KEY DEFAULT gen_random_uuid()
nombre      TEXT    NOT NULL             -- Nombre del tema (legacy, ahora usar temas.nombre)
semana      DATE                         -- Semana de planificación
medios      JSONB                        -- { canal_id: "si/Juan" | {valor, notas} }
tema_id     UUID    REFERENCES temas(id) ON DELETE CASCADE  -- FK al tema canónico
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
```
> **Formato JSONB dual:** Legacy = string `"si/Juan"`. Nuevo = objeto `{ valor: "si", notas: "Juan" }`. `getCellData/setCellData` en `utils.js` maneja ambos.

---

### Tabla: `mesa_editorial_acciones`
```sql
id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid()
eje                  TEXT        NOT NULL    -- Ver sección 4.3 para valores válidos
tipo                 TEXT                    -- "Ancla" | "Soporte" | "Always ON"
tema                 TEXT
accion               TEXT                    -- Descripción de la acción
tipo_accion          TEXT                    -- "Resultado" | "Backlog"
tipologia_resultado  TEXT                    -- Solo para Resultados
fecha                DATE                    -- null si tipo = "Always ON"
responsable          TEXT
status               TEXT DEFAULT 'Pendiente' -- "Pendiente" | "En desarrollo" | "Completado"
parent_id            UUID REFERENCES mesa_editorial_acciones(id) ON DELETE SET NULL
sync_to_medios       BOOLEAN     NOT NULL DEFAULT FALSE
tema_id              UUID        REFERENCES temas(id) ON DELETE SET NULL
archived             BOOLEAN     DEFAULT FALSE
archived_at          TIMESTAMPTZ
completed_at         TIMESTAMPTZ
created_at           TIMESTAMPTZ DEFAULT NOW()
updated_at           TIMESTAMPTZ DEFAULT NOW()
```

---

### Tabla: `audit_logs`
```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
mesa_type   TEXT                    -- null | "medios" | "editorial"
user_email  TEXT
action      TEXT                    -- "login" | "create" | "update" | "delete"
table_name  TEXT
record_id   UUID
details     TEXT                    -- JSON stringificado via logAuditEntry()
created_at  TIMESTAMPTZ DEFAULT NOW()
```
> `parseDetails()` en UserProfilePanel usa try/catch para compatibilidad con registros legacy (string plano).

---

### Tabla: `usuarios_autorizados`
```sql
email           TEXT        PRIMARY KEY
nombre          TEXT
pin_hash        TEXT        -- SHA-256(PIN) en hex — nunca plaintext. Protegido por RPC.
pin_updated_at  TIMESTAMPTZ
activo          BOOLEAN     DEFAULT true
```

---

### Tabla: `pin_login_attempts`
```sql
id           UUID        PRIMARY KEY DEFAULT gen_random_uuid()
email        TEXT        NOT NULL
attempted_at TIMESTAMPTZ DEFAULT NOW()
success      BOOLEAN     DEFAULT FALSE
```
> Índice en `(email, attempted_at)` para rate limiting.

---

### Funciones RPC (SECURITY DEFINER)

| Función | Parámetros | Retorno | Propósito |
|---|---|---|---|
| `validate_pin` | `p_email TEXT, p_pin_hash TEXT` | `TABLE(valid BOOLEAN, email TEXT, nombre TEXT)` | Valida PIN sin exponer pin_hash |
| `admin_list_users` | — | `TABLE(email, nombre, has_pin BOOLEAN, activo)` | Lista usuarios para admin (sin pin_hash) |
| `admin_set_pin` | `p_admin_email, p_target_email, p_new_hash` | `BOOLEAN` | Actualiza pin_hash; solo funciona si p_admin_email = 'leonardo.munoz@uss.cl' |

> Todas revocadas de PUBLIC, concedidas a `anon` y `authenticated`.

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
--text-main: #1a2b3c; --text-muted: #4a6a84 (ajustado de #5a7a96 → ratio WCAG AA ~4.97:1 sobre blanco)
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
| `.table-scroll` | Scroll vertical interno (`height: calc(100vh - var(--above-table) - 70px)`) |
| `.media-table` | `<table>` principal |
| `.sticky-col` | `position: sticky` para "Contenidos" y "Semana" |
| `.col-contenidos` | `left: 0; z-index: 30` |
| `.col-semana` | `left: 200px; z-index: 30` |
| `.group-header-row` | Fila header de grupos |
| `.sub-header-row` | Fila de sub-headers (nombres de canales) |
| `.data-row` | Fila de datos, `height: 38px` |
| `.medios-filter-bar` | `position: sticky; top: 68px; z-index: 90` |
| `.medios-filter-bar.zona-b-collapsed` | `display: none !important` — Zona B colapsada (desktop) |
| `.medios-tabs-mobile.zona-b-collapsed` | `display: none !important` — Zona B colapsada (mobile tabs) |
| `.mobile-action-line.zona-b-collapsed` | `display: none !important` — Zona B colapsada (mobile actions) |
| `.btn-header-collapse` | Botón chevron colapso header; `aria-expanded` controla rotación SVG via CSS |
| `.filter-active-dot` | Punto ámbar en `.btn-header-collapse` cuando hay filtros activos y header colapsado |
| `.btn-add-subtema-inline` | Botón "+ Subtema" inline en celda sticky izquierda del TemaRow (11px, dashed) |

**Mesa Editorial:**
| Clase | Propósito |
|---|---|
| `.editorial-sticky-block` | `position: sticky; top: 0; z-index: 100` — bloque unificado |
| `.editorial-tabs` | Tabs Activas/Archivadas (dentro del sticky block) |
| `.tab-btn` / `.tab-active` | Botones de tab |
| `.tab-badge` | Contador circular en cada tab |
| `.editorial-kpi-bar` | Barra de KPIs navy (dentro del sticky block) |
| `.kpi-bar-archived` | Variante gris para tab Archivadas |
| `.kpi-full-content` | `display: flex; gap: 16px` — items del KPI separados (desktop) |
| `.kpi-mobile-summary` | Resumen colapsado del KPI bar (solo mobile, siempre visible) |
| `.kpi-chevron` | Flecha toggle del KPI mobile |
| `.editorial-filter-bar` | Toolbar de filtros (dentro del sticky block) |
| `.filter-row-actions` | Grupo derecho: % avance + Explorar + Nueva acción (solo desktop) |
| `.btn-explorer` | Botón "Explorar" — borde gris `#d1d5db`, fondo transparente, texto `#374151` |
| `.eje-section` | Sección colapsable por eje |
| `.eje-section-archived` | Variante con opacity reducida en tab Archivadas |
| `.editorial-table` | `<table>` de acciones por eje |
| `.col-eje` | `width: 120px` — columna eje editable (nueva) |
| `.resultado-row` / `.backlog-row` | Filas de la tabla |
| `.row-archived` | Fila archivada: `opacity: 0.75; color: #64748b` |
| `.col-archived-at` | Columna "Archivado el" (solo tab Archivadas) |
| `.btn-reactivate` | Botón reactivar (solo tab Archivadas) |
| `.explorer-overlay` | `z-index: 200` — sobre sticky block |
| `.explorer-sidebar` | `z-index: 201; position: fixed; right: 0` |

**Mobile:**
| Clase | Propósito |
|---|---|
| `.mobile-action-line` | Línea única mobile: search + filtros + add |
| `.editorial-mobile-action-line` | Variante editorial de la línea de acción |
| `.mobile-filter-btn` | Botón "Filtros" que abre bottom sheet |
| `.mobile-filter-badge` | Contador de filtros activos |
| `.mobile-add-btn` | Botón dorado añadir (mobile) |
| `.mobile-eje-select` | Select de eje en cards mobile (estilos inline) |
| `.bs-overlay` / `.bs-sheet` | Bottom sheet overlay y panel |

**Compartidos:**
| Clase | Propósito |
|---|---|
| `.toast-container` | `position: fixed; bottom-right` |
| `.toast` / `.toast-success` / `.toast-error` / `.toast-info` | Estados de toast |
| `.toast-action` | Botón inline en toast |
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

### Branch actual: `main` (estable)

### Últimos commits:
```
refactor(subtemas): single row per subtema + migration + kebab menu  ← HEAD
merge(fix/editorial-collapsible-header): collapsible header in Editorial
feat(editorial): collapsible header matching Mesa Medios pattern
merge(fix/medios-ui-improvements): reposition subtema button and add collapsible header
fix(medios-ui): reposition subtema button and add collapsible header
```

### Branches:
```
main                                       ← estable ✅
feat/subtema-single-row-refactor           ← mergeada a main ✅
fix/editorial-collapsible-header           ← mergeada a main ✅
fix/medios-ui-improvements                 ← mergeada a main ✅
feat/subtemas-mesa-medios                  ← mergeada a main ✅
fix/sheet-buttons-styling                  ← mergeada a main ✅
```

### ANTES DEL DEPLOY — ejecutar en Supabase SQL Editor (en orden):
```
1. scripts/add-subtemas-jerarquia.sql          (si no se ejecutó antes)
2. scripts/migrate-subtemas-to-single-row.sql  (NUEVO — obligatorio para el modelo single-row)
```

---

## 9. Scripts SQL de Migración

Todos en `scripts/`. Ejecutar en **Supabase SQL Editor** (no en producción automática).

| Archivo | Estado | Descripción |
|---|---|---|
| `add-archived-field.sql` | ✅ Ejecutado | `archived BOOLEAN` + `archived_at TIMESTAMPTZ` en `mesa_editorial_acciones` |
| `add-completed-at.sql` | ✅ Ejecutado | `completed_at TIMESTAMPTZ` en `mesa_editorial_acciones` |
| `add-parent-and-tipologia.sql` | ✅ Ejecutado | `parent_id UUID` + `tipologia_resultado TEXT` |
| `add-pin-per-user.sql` | ✅ Ejecutado | `pin_hash` + `pin_updated_at` en `usuarios_autorizados`; tabla `pin_login_attempts` |
| `migrate-ao-to-always-on.sql` | ✅ Ejecutado | Renombra `tipo = 'AO'` → `'Always ON'` |
| `migrate-rrss-split.sql` | ✅ Ejecutado | Migra `rrss` → `instagram` en JSONB de `contenidos` |
| `migrate-tipo-accion.sql` | ✅ Ejecutado | Normaliza valores del campo `tipo_accion` |
| `refactor-temas-sincronizacion.sql` | ✅ Ejecutado | Crea tabla `temas`; agrega `tema_id` a `contenidos` y `mesa_editorial_acciones` |
| `rename-ejes.sql` | ✅ Ejecutado | `'Discusión País'` → `'Conversación País'`; `'Salud y Medicina'` → `'Salud'` |
| `security-rpc-usuarios.sql` | ✅ Ejecutado | Crea funciones RPC `validate_pin`, `admin_list_users`, `admin_set_pin` (SECURITY DEFINER) |
| `security-rpc-cleanup.sql` | ✅ Ejecutado | Elimina policy `anon_can_read_active_users` (ya no necesaria con RPC) |
| `add-performance-indexes.sql` | ✅ Ejecutado | Índices de performance en contenidos, mesa_editorial_acciones, audit_logs, pin_login_attempts |
| `add-archived-medios.sql` | ⏳ **PENDIENTE** | `archived BOOLEAN` + `archived_at TIMESTAMPTZ` + índice en tabla `temas` — **ejecutar antes de usar la feature** |
| `add-medios-status.sql` | ✅ Ejecutado | `status TEXT DEFAULT 'Nuevo'` + CHECK + backfill + índice en tabla `temas` |
| `migrate-cell-no-to-empty.sql` | ✅ Ejecutado | Limpia celdas con valor `'no'` en JSONB de `contenidos.medios` |
| `add-subtemas-jerarquia.sql` | ⏳ **PENDIENTE — EJECUTAR ANTES DEL DEPLOY** | `parent_id UUID`, `fecha_inicio DATE`, `fecha_termino DATE` en `temas` + índice. Agrega jerarquía Campaña → Subtemas. |
| `migrate-subtemas-to-single-row.sql` | ⏳ **PENDIENTE — EJECUTAR ANTES DEL DEPLOY** | Migra datos al modelo single-row: elimina contenidos duplicados por subtema (retiene el más reciente), crea fila de contenidos para subtemas sin ninguna. Obligatorio tras el refactor subtemas single-row. |

---

## 10. Deuda Técnica

### Resoluciones — última revisión 2026-04-27

| Ítem | Resolución |
|---|---|
| Dead code en `src/` raíz | No existía |
| Login duplicado en audit_logs | No existía |
| N+1 query en UserProfilePanel | Resuelto |
| Matching frágil por primer nombre | Resuelto — `.ilike('responsable', userName)` |
| `isContentEditable` faltante en atajos teclado | No existía — ya implementado |
| Sin beforeunload en editorial | Resuelto |
| Date input no controlado en EjeSection | Resuelto |
| `audit_logs.details` inconsistente | Resuelto — helper `logAuditEntry()` |
| KPI items sin separación visual (gap: 0) | Resuelto — `gap: 16px` en `.kpi-full-content` |
| Botón "Explorar" invisible sobre fondo blanco | Resuelto — colores corregidos para fondo claro |
| pin_hash expuesto a anon directamente | Resuelto — RPC SECURITY DEFINER + policy eliminada |
| Falta de índices en queries frecuentes | Resuelto — script add-performance-indexes.sql |
| Performance MediaTable (re-render completo por edición) | Resuelto — memoización `TemaRow` + patrón `temasRef` + `ResizeObserver` debounced |
| Virtualización vertical `react-window` (MediaTable) | Evaluado — umbral no alcanzado (18 temas en producción vs. umbral 30). Implementar si temas > 30. Nota: requeriría refactorizar `<table>` → `<div>` grid por incompatibilidad de `react-window` con `position: sticky` horizontal. |
| Accesibilidad sin auditoría WCAG | Resuelto parcialmente — WCAG AA en ARIA, landmarks, focus visible, contraste y focus traps. Reporte completo en docs/A11Y-AUDIT.md |
| Exports sin usar (`getGroupCols`, `EJE_LABELS`) | Resuelto — eliminados en `chore/repo-cleanup` (2026-04-27) |

> **Auditoría Knip 2026-04-27:** 0 archivos sin uso · 0 dependencias sin uso · 0 imports rotos · 0 exports sin usar (post-cleanup) · 3 `console.*` todos legítimos (error handlers + env warning). Repositorio sin deuda técnica de código muerto.

### Deuda activa

| Ítem | Ubicación | Impacto |
|---|---|---|
| Navegación por teclado en celdas de MediaTable | src/apps/mesa-medios/components/MediaTable.jsx + CellPopover.jsx | Usuarios con teclado puro (sin mouse) no pueden editar celdas. Requiere roving tabindex + arrow key navigation (Fase 5 del plan de accesibilidad). Afecta WCAG 2.1.1 parcialmente. |

> Si surge nueva deuda técnica, documentarla aquí con: **Problema · Ubicación · Impacto**.

---

## 11. Funcionalidades por Módulo

### Mesa de Medios

| Funcionalidad | Estado |
|---|---|
| **Visores Excel Online (SharePoint):** Botones en la barra de tabs de ambas mesas (Editorial: `.editorial-tabs`; Medios: `.medios-tabs-desktop`). Componentes: `SheetButtons` (botones + state), `SheetViewer` (modal con iframe). Config centralizada en `shared/utils/sheetsConfig.js`. Alineados al extremo derecho vía `margin-left: auto` en `.sheet-buttons`. En mobile, el desktop tab bar está oculto (`display: none`) por lo que SheetButtons no aparece en mobile (comportamiento aceptado). Sin atributo sandbox en iframe (requisito SSO Microsoft 365). | ✅ |
| Tabla con 39 canales (3 grupos, múltiples sub-grupos) | ✅ |
| Edición inline de celdas (si/pd + notas) via popover directo | ✅ |
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
| Vista mobile (cards por tema) | ✅ |
| Bottom sheet de filtros mobile | ✅ |
| Sync de temas desde Editorial | ✅ |
| **Hover guides: fila (CSS) + columna (DOM, sin React state)** | ✅ |
| **Archivar tema (botón caja, navy, confirmación no-destructiva)** | ✅ |
| **Eliminar tema: diferenciado visualmente del archivar (rojo)** | ✅ |
| **Tabs Activos / Archivados con conteo realtime** | ✅ |
| **Tab Archivados: solo lectura, fecha archivado, reactivar** | ✅ |
| **Badge "Inactivo · Xd" para temas sin planificación > 30 días** | ✅ |
| **Archivado en mobile (TemaCard con botones archive/reactivate)** | ✅ |
| **Exportación Excel:** Botón "Exportar" en toolbar de filtros (solo tab Activos). Abre modal con selección de temas/acciones, búsqueda, pre-selección según filtros. Genera `.xlsx` con diseño ejecutivo: header USS, bloques por tema con subheaders de color, celdas coloreadas por estado. Helpers: `shared/utils/excelExportMedios.js` y `excelExportEditorial.js` (xlsx-js-style). | ✅ |
| **Status de temas (Nuevo / En desarrollo / Completado):** Badge de color + select en cada tema. Auto-transición Nuevo→En desarrollo al editar primera celda o agregar planificación. Completado→archivado automático con ConfirmDialog. Require SQL: `add-medios-status.sql`. | ✅ |
| **Alerta fecha desfasada:** Badge naranja "⚠ Cerrar tema" en temas "En desarrollo" con todas las planificaciones con fecha > 14 días pasados. Click → ConfirmDialog → archivado. Umbral: `STALE_THRESHOLD_DAYS = 14` en `config.js`. | ✅ |
| **CellPopover rediseñado:** Input directo enfocado al abrir. Enter = Confirmar (si). Botones: Por definir (pd), Vaciar, Confirmar. Sin modos view/edit, sin estado "No". Compatible con formato legacy `"si/Juan"`. | ✅ |
| **CellPopover UX mejorado (fix/post-release-2):** min-width 340px, padding cómodo, sección "Detalle actual" cuando hay texto guardado. Enter guarda texto escrito o "sí" si vacío. getCellMeta recibe `notas` → celdas muestran texto real (no "Sí" genérico). Fix aplicado en MediaTable y MobileCardView. | ✅ |
| **Filtros multi-columna:** Icono funnel/X en cada header de columna. Selección múltiple. `visibleCols` prioriza columnas activas sobre grupo. `displayTemas` filtra planifs por datos en columnas filtradas. Auto-expand de temas con datos. Badge "X columnas filtradas" en toolbar + botón "Limpiar columnas". Sección con checkboxes por grupo en BottomSheet mobile. Filtros se resetean al cambiar tab. | ✅ |
| **Filtros multi-columna desktop mejorados (fix/post-release-2):** Chips por columna activa con X individual. Select "+ Añadir columna" con optgroups para sumar columnas sin limpiar el filtro. | ✅ |
| **Status "Nuevo" no seleccionable manualmente:** Badge informativo solo. Cuando status es "Nuevo", MediaTable muestra solo el badge (sin dropdown). Para "En desarrollo" y "Completado" aparece el select (sin opción "Nuevo"). Auto-transición a "En desarrollo" después de 7 días via `checkAndTransitionStaleNew()` en fetchData. | ✅ |
| **Hitos sincronizados desde Editorial:** fetchData trae `tipo` de acciones editoriales con `sync_to_medios=true` usando `tema_id` FK. Badge read-only en TemaRow: Ancla (amarillo), Soporte (azul), Always ON (verde). | ✅ |
| **Jerarquía Campaña → Subtemas (modelo single-row):** Tabla `temas` con `parent_id` auto-referencial. Árbol 2 niveles: TemaRow (padre) → SubtemaRow (subtema). Cada subtema tiene exactamente 1 fila en `contenidos` con las 39 celdas de medios. Fecha de la planif editable inline. KebabMenu por subtema (Editar subtema / Eliminar subtema). Modal `edit-subtema` para nombre + fecha_inicio + fecha_termino. Sin expand/collapse por subtema (siempre visible). `src/apps/shared/components/KebabMenu.jsx` como componente reutilizable. Require SQL: `add-subtemas-jerarquia.sql` + `migrate-subtemas-to-single-row.sql`. | ✅ |
| **Botón "+ Subtema" inline en TemaRow:** Movido de `tema-action-btns` (celda derecha) a la celda izquierda sticky (`tema-header-name`), después del nombre y el badge de inactividad. Clase `.btn-add-subtema-inline` (dashed border, compacto, 11px). Oculto cuando tema está archivado. Mobile no cambia (ya usa `.btn-add-subtema` en card header). | ✅ |
| **Header colapsable con persistencia:** Botón chevron en `header-row-actions` colapsa/expande Zona B (`.medios-filter-bar` desktop + `.medios-tabs-mobile` + `.mobile-action-line` mobile) vía clase `zona-b-collapsed`. Estado persistido en `localStorage` clave `uss_medios_header_expanded`. Punto ámbar (`filter-active-dot`) indica filtros activos cuando header colapsado. `hasActiveFilters` corregido para incluir `activeColumnFilters.size > 0`. | ✅ |

### Mesa Editorial

| Funcionalidad | Estado |
|---|---|
| 5 ejes colapsables con progress bar | ✅ |
| Ejes actualizados: Conversación País, Salud (renombrados) | ✅ |
| Tipos: Ancla, Soporte, Always ON | ✅ |
| Resultados con backlogs vinculados (expandibles) | ✅ |
| Backlogs huérfanos con asignador | ✅ |
| Edición inline de todos los campos (tema, acción, fecha, responsable, status, tipo, eje) | ✅ |
| **Eje editable por fila (columna select en desktop, badge select en mobile)** | ✅ |
| Status: Pendiente / En desarrollo / Completado | ✅ |
| Filtros: texto, eje, status, tipo acción, rango de fechas | ✅ |
| Explorador por eje y tema (sidebar) | ✅ |
| Ordenar por fecha | ✅ |
| Agregar acción con modal | ✅ |
| Eliminar con confirmación (cascade backlogs) | ✅ |
| Tab Archivadas / Activas | ✅ |
| Auto-archivo al marcar Completado | ✅ |
| Reactivar acción archivada | ✅ |
| Sync tema → Mesa de Medios | ✅ |
| KPI bar (completadas, en desarrollo, pendientes, %) | ✅ |
| KPI bar historial (tab Archivadas) | ✅ |
| KPI bar colapsable en mobile | ✅ |
| Bottom sheet de filtros mobile | ✅ |
| Header sticky unificado (bloque único) | ✅ |
| Realtime | ✅ |
| Audit log | ✅ |
| Vista mobile (cards) | ✅ |
| **Exportación Excel:** Botón "Exportar" en toolbar (solo tab Activas, desktop). Modal con selección de acciones, búsqueda, pre-selección según filtros activos. Genera `.xlsx` con bloques por eje, colores de eje en subheaders, columnas STATUS con colores. Helper: `shared/utils/excelExportEditorial.js`. | ✅ |
| **Header colapsable con persistencia:** Botón chevron en `header-row-actions` colapsa/expande Zona B (`.editorial-tabs` + `.editorial-kpi-bar` + `.editorial-filter-bar` + `.editorial-mobile-action-line` + `.explorer-active-filter`) vía clase `zona-b-collapsed`. Estado persistido en `localStorage` clave `uss_editorial_header_expanded` (independiente de Medios). Punto ámbar (`filter-active-dot`) indica filtros activos cuando header colapsado. `hasActiveFilters` incluye: `filterInput`, `filterEje`, `filterStatus`, `filterTipoAccion`, `filterDateRange`, `sortDir`. KPI bar mobile desaparece junto con Zona B al colapsar (comportamiento esperado). | ✅ |

### Autenticación y Admin

| Funcionalidad | Estado |
|---|---|
| Login PIN por usuario (SHA-256, sin Supabase Auth) | ✅ |
| Validación PIN via RPC SECURITY DEFINER (pin_hash nunca expuesto) | ✅ |
| Sesión local en localStorage (sin cookie Supabase) | ✅ |
| Rate limiting 5 intentos / 10 min (sessionStorage) | ✅ |
| Panel de usuario con stats de actividad | ✅ |
| Historial de actividad personal | ✅ |
| Gestión de PINs via RPC (solo leonardo.munoz@uss.cl) | ✅ |
| Selector de módulo con "último usado" | ✅ |
| Rollback de emergencia documentado en Login.jsx y UserProfilePanel.jsx | ✅ |

### Accesibilidad

| Funcionalidad | Estado |
|---|---|
| WCAG AA en ARIA labels, landmarks y estructura semántica | ✅ |
| Focus visible en todos los elementos interactivos | ✅ |
| Focus traps en modales, bottom sheets y overlays | ✅ |
| Skip link para saltar al contenido | ✅ |
| Retorno de focus al trigger al cerrar overlays | ✅ |
| Contraste de colores WCAG AA | ✅ |
| Navegación por teclado en celdas de tabla (flechas tipo Excel) | ⏳ Pendiente (deuda activa) |
