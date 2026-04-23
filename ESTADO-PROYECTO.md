# Estado del Proyecto — Mesa de Medios USS
**Actualizado:** 2026-04-23 | **Branch:** `main` | **Commit:** `7411bf6`

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
| Estilos | CSS puro (index.css, ~4900 líneas) | — |
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
│       │   │   └── BottomSheet.jsx     # Bottom sheet para filtros mobile
│       │   ├── hooks/
│       │   │   ├── useToast.js         # Toast state: addToast / removeToast
│       │   │   └── useDebounce.js      # 300ms debounce para filtros
│       │   └── utils/
│       │       ├── supabase.js         # Cliente Supabase (NO MODIFICAR)
│       │       ├── crypto.js           # SHA-256 hash de PINs via crypto.subtle
│       │       └── audit.js            # logAuditEntry() — helper centralizado audit_logs
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
│       │       └── CellPopover.jsx     # Popover edición de celdas (si/pd/no + notas)
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
│   ├── add-completed-at.sql
│   ├── add-parent-and-tipologia.sql
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
| `filterCellStatus` | String | Filtro `si`/`pd`/`no` |
| `collapsedGroups` | Set | IDs de grupos colapsados |
| `expandedTemas` | Set | IDs de temas con filas expandidas |
| `showMobileFilters` | Boolean | Bottom sheet de filtros mobile visible |

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
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
nombre      TEXT        NOT NULL
origen      TEXT        NOT NULL DEFAULT 'medios'   -- 'medios' | 'editorial'
eje         TEXT
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()     -- Auto-actualizado por trigger
```
> Trigger `temas_updated_at_trigger` actualiza `updated_at` en cada UPDATE.

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
| `.table-scroll` | Scroll vertical interno (`height: calc(100vh - var(--above-table) - 70px)`) |
| `.media-table` | `<table>` principal |
| `.sticky-col` | `position: sticky` para "Contenidos" y "Semana" |
| `.col-contenidos` | `left: 0; z-index: 30` |
| `.col-semana` | `left: 200px; z-index: 30` |
| `.group-header-row` | Fila header de grupos |
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

### Branch actual: `main` (HEAD: `7411bf6`)

### Últimos commits:
```
7411bf6 perf(medios): memoize rows and handlers in MediaTable
4650896 feat(editorial): rename ejes + editable eje field per row
3d4fe60 fix(desktop): KPI gap + Explorar button style on white background
01c937e fix(mobile): fix action bar overflow + desktop KPI spacing
9b611d0 feat(security): migrate PIN validation to SECURITY DEFINER RPC
04fdd76 merge(feat/mobile-ux-bottom-sheet): UX mobile bottom sheet + compact header
d5a5836 feat(mobile): bottom sheet filters + compact header + KPI colapsable
02f4bc7 merge(fix/deuda-tecnica-seccion-10): resolver deuda técnica sección 10
15eadb6 refactor(audit): standardize new details entries to JSON via helper
c49dbd6 fix(editorial): make date inputs controlled to reflect realtime changes
4ea6e17 feat(editorial): warn before unload if there are unsaved edits
95c48db merge(fix/sticky-header-editorial): sticky header unificado Mesa Editorial
baee408 merge(feat/editorial-archive): sistema de archivado Mesa Editorial
a49a1d9 feat(login): redesign split layout + PIN-per-user auth + Always ON fecha
a19f700 release(medios): Release 2 — UX refactor Mesa de Medios, temas canónicos, sync Editorial↔Medios
```

### Branches:
```
main                              ← producción ✅
```
> Todas las branches de features previas fueron mergeadas a main.

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

---

## 10. Deuda Técnica

### Sin deuda activa conocida — última revisión 2026-04-23

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
| Vista mobile (cards por tema) | ✅ |
| Bottom sheet de filtros mobile | ✅ |
| Sync de temas desde Editorial | ✅ |

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
