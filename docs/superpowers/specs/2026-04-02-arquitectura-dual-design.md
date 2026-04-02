# Diseño: Sistema Dual de Dashboards USS

**Fecha:** 2026-04-02  
**Branch:** `arquitectura-dual` (nuevo, desde `mejoras-quick-wins`)  
**Estado:** Aprobado

---

## Contexto

El proyecto USS cuenta con un dashboard funcional de "Mesa de Medios" con Quick Wins 1-7 implementados. Se requiere extender el sistema para soportar un segundo dashboard "Mesa Editorial", manteniendo un único punto de autenticación y componentes compartidos, sin romper la funcionalidad existente.

---

## Decisiones clave

| Decisión | Elección | Razón |
|----------|----------|-------|
| Nombres de tabla Supabase | Mantener actuales (`contenidos`, `logs`, `usuarios_autorizados`) | Cero riesgo de regresión en Mesa de Medios |
| Nueva tabla Editorial | `mesa_editorial_acciones` | Nombre nuevo, sin conflicto |
| Datos iniciales | SQL con INSERT desde HTML de referencia | ~60 registros extraídos de `Dashboard__USS_Semana_30_abril.html` |
| Sin dependencias npm nuevas | Confirmado | Usar solo lo que ya existe |

---

## Arquitectura de carpetas

```
src/
├── apps/
│   ├── mesa-medios/
│   │   ├── MesaMediosApp.jsx       ← App.jsx actual renombrado
│   │   ├── components/
│   │   │   ├── MediaTable.jsx
│   │   │   ├── MobileCardView.jsx
│   │   │   ├── AddRowModal.jsx
│   │   │   ├── Header.jsx          ← agrega prop onBackToSelector
│   │   │   └── AuditLogPanel.jsx
│   │   └── config.js
│   │
│   ├── mesa-editorial/
│   │   ├── MesaEditorialApp.jsx
│   │   ├── components/
│   │   │   ├── EditorialTable.jsx  ← grupos por EJE colapsables
│   │   │   ├── EjeSection.jsx      ← sección colapsable con progress
│   │   │   ├── MobileCardView.jsx
│   │   │   ├── AddActionModal.jsx
│   │   │   └── Header.jsx          ← tema navy/dorado
│   │   └── config.js               ← EJES, colores, columnas
│   │
│   └── shared/
│       ├── DashboardSelector.jsx
│       ├── components/
│       │   ├── Toaster.jsx
│       │   ├── ConfirmDialog.jsx
│       │   ├── USSLoader.jsx
│       │   └── Login.jsx
│       ├── hooks/
│       │   ├── useToast.js
│       │   └── useDebounce.js
│       └── utils/
│           └── supabase.js
│
├── App.jsx                         ← nuevo router principal con auth
├── main.jsx                        ← sin cambios
└── index.css                       ← sin cambios
```

---

## Flujo de navegación

```
main.jsx
    └── App.jsx (maneja auth + routing)
            ├── [!session]          → <Login />
            ├── [!authorized]       → <USSLoader /> "Verificando acceso..."
            ├── [!selectedDashboard]→ <DashboardSelector />
            ├── ['medios']          → <MesaMediosApp onBackToSelector />
            └── ['editorial']       → <MesaEditorialApp onBackToSelector />
```

**Auth:** `App.jsx` asume toda la lógica de auth (sesión, verificación en `usuarios_autorizados`, logout). Las apps hijas reciben `session`, `userName`, `onLogout` como props.

**localStorage:** key `uss_last_dashboard` → persiste la última app usada. El Selector muestra badge "Último usado: ..." si existe.

**Botón Volver:** Ambos headers tienen `← Inicio` que llama `onBackToSelector()`.

---

## Base de datos

### Tabla nueva: `mesa_editorial_acciones`

```sql
CREATE TABLE mesa_editorial_acciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  eje TEXT NOT NULL,
  tipo TEXT,
  tema TEXT,
  accion TEXT,
  tipo_accion TEXT,
  fecha DATE,
  responsable TEXT,
  status TEXT DEFAULT 'Pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mesa_editorial_acciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autorizados pueden hacer todo" ON mesa_editorial_acciones
  FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM usuarios_autorizados WHERE activo = true
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE mesa_editorial_acciones;
```

**RLS usa `usuarios_autorizados` (nombre real en DB, no `authorized_users`).**

### Tablas existentes sin cambios

| Tabla | Uso |
|-------|-----|
| `contenidos` | Mesa de Medios, sin tocar |
| `logs` | Audit log compartido (ambas apps escriben aquí) |
| `usuarios_autorizados` | Auth compartido |

### Datos iniciales

SQL con INSERT statements generados desde `Dashboard__USS_Semana_30_abril.html` (array `data`, líneas 738-799). Son **56 registros** (el spec original decía 74, pero el conteo real del HTML es 56). Los registros con `status: ''` se insertan como `'Pendiente'`. Campo `resp` del HTML → columna `responsable`.

---

## Mesa Editorial — Vista

### Agrupación por EJE

Cada eje es una sección colapsable:

```
┌─ [●] Orgullo USS ─────────────── 4 acciones · 25% ── [▼] ─┐
│ Tipo  │ Tema        │ Acción      │ Canal │ Fecha  │ Resp │ Status   │ │
│ Ancla │ Nuevo rector│ Video saludo│ Intern│ 1 abr  │ Clau │ Pendiente│ 🗑 │
└────────────────────────────────────────────────────────────────────────┘
```

**Header de eje:** stripe vertical 8px con color del eje + título + contador + progress bar + toggle colapso.

### Colores de eje

| Eje | Color |
|-----|-------|
| Orgullo USS | `#C8102E` |
| Discusión País | `#2A5BA8` |
| Salud | `#1D7A4F` |
| Investigación | `#7A2AB8` |
| Vinculación con el Medio | `#B06A00` |

### KPI Bar (sticky bajo header)

- Total acciones
- Completadas (dot `#4ADE80`)
- En desarrollo (dot `#FCD34D`)
- Pendientes (dot `#FCA5A5`)
- % Avance general

### Filtros

- Ver todas | Por Eje (5 pills) | Por Status (3 pills) | Búsqueda debounced 300ms

### Columnas de tabla

| Columna | Editable | Notas |
|---------|----------|-------|
| Tipo | No | Badge: Ancla/AO/Soporte |
| Tema | Sí | contenteditable inline |
| Acción | Sí | contenteditable, max-width 260px |
| Canal | No | Tipo de acción (Interno/Externo) |
| Fecha | Sí | Formato "6 abr 2026" |
| Responsable | Sí | contenteditable inline |
| Status | Sí | Dropdown 3 estados |
| Acciones | No | Botón eliminar con ConfirmDialog |

---

## Estilos — Tema invertido

```css
/* Mesa de Medios (sin cambios) */
.app-medios {
  --color-primary: #ceb37c;
  --color-secondary: #0f2b41;
  --header-bg: #0f2b41;
  --kpi-bar-bg: #ceb37c;
  --kpi-bar-text: #0f2b41;   /* oscuro sobre dorado ✅ */
}

/* Mesa Editorial — invertido */
.app-editorial {
  --color-primary: #0f2b41;
  --color-secondary: #ceb37c;
  --header-bg: #0f2b41;
  --kpi-bar-bg: #0f2b41;
  --kpi-bar-text: #ffffff;   /* blanco sobre navy ✅ */
}
```

**Regla de contraste — NO NEGOCIABLE:**
- `#ceb37c` → texto siempre `#0f2b41`
- `#0f2b41` → texto `#ffffff` o `#ceb37c`
- NUNCA `#ffffff` sobre `#ceb37c`

---

## Dashboard Selector

**Componente:** `src/apps/shared/DashboardSelector.jsx`

**Diseño:**
```
┌──────────────────────────────────────────┐
│           [Logo USS emblem]              │
│        Sistema de Gestión USS            │
│      Selecciona tu mesa de trabajo       │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │      📊      │  │      📝      │    │
│  │  Mesa de     │  │    Mesa      │    │
│  │  Medios      │  │  Editorial   │    │
│  │              │  │              │    │
│  │ Gestión de   │  │ Plan comuni- │    │
│  │ campañas y   │  │ cacional y   │    │
│  │ contenidos   │  │ acciones     │    │
│  └──────────────┘  └──────────────┘    │
│                                          │
│  Usuario: [nombre] | Cerrar sesión      │
└──────────────────────────────────────────┘
```

- Cards clickables, hover: border `#ceb37c`
- localStorage: `uss_last_dashboard`
- Responsive: columna en mobile
- Keyboard: Tab + Enter
- Animación: fade + slide up

---

## Quick Wins en Mesa Editorial

Todos los Quick Wins de Mesa de Medios se aplican a Editorial usando componentes compartidos:

| Quick Win | Implementación |
|-----------|---------------|
| Toast notifications | `shared/hooks/useToast.js` + `shared/components/Toaster.jsx` |
| ConfirmDialog en delete | `shared/components/ConfirmDialog.jsx` |
| useMemo en filtrado | Local en `MesaEditorialApp.jsx` |
| Debounce búsqueda | `shared/hooks/useDebounce.js` |
| Progress por EJE | `EjeSection.jsx` (% completado por eje) |
| Empty states contextuales | En `EditorialTable.jsx` |
| Keyboard shortcuts | Esc, Ctrl+K, N en `MesaEditorialApp.jsx` |

---

## Sub-agentes y orden de ejecución

```
[S1] Arquitectura/Refactoring       ← BLOQUEANTE para todos
      ↓
[S2] Supabase Schema + SQL  ←→  [S3] Dashboard Selector   ← PARALELOS
      ↓                               ↓
[S4] Mesa Editorial Core            ← requiere S2 + S3
      ↓
[S5] Estilos Editorial              ← puede solaparse con final de S4
      ↓
[S6] Quick Wins Integration
      ↓
[S7] QA + validación final
```

---

## Constraints no negociables

1. Mesa de Medios sin regresiones
2. NUNCA `#ffffff` sobre `#ceb37c`
3. Montserrat en ambas apps
4. Audit logs compartidos (tabla `logs`)
5. Auth compartido (un login)
6. Componentes compartidos (toasts, dialogs, hooks)
7. Mobile-friendly en ambas
8. Realtime sync: canales `contenidos-realtime` (Medios) y `editorial-acciones-realtime` (Editorial)
9. Sin dependencias npm nuevas
10. Branch: `arquitectura-dual` (desde `mejoras-quick-wins`)

---

## Plan de commits

```
feat(architecture): restructure to multi-app architecture with shared/
feat(supabase): add mesa_editorial_acciones table with seed data
feat(selector): add dashboard selector post-login with localStorage
feat(editorial): create Mesa Editorial dashboard core
feat(editorial): apply inverted theme and eje-based styling
feat(editorial): integrate quick wins (toasts, confirm, useMemo, etc)
test(qa): validate dual dashboard system end-to-end
```

---

## Verificación

- `npm run dev` arranca sin errores después de S1
- Mesa de Medios carga con datos reales después de S1
- Selector aparece post-login y navega a ambas apps después de S3
- Mesa Editorial carga 56 registros desde Supabase después de S4
- Ejes colapsables, filtros, edición inline funcionan después de S4+S5
- Todos los Quick Wins operativos en ambas apps después de S6
- QA final confirma cero regresiones en Mesa de Medios (S7)
