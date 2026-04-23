# Auditoría WCAG AA — Sistema de Gestión USS

**Fecha:** 2026-04-23  
**Rama:** main (commit fc362aa)  
**Criterio:** WCAG 2.1 Nivel AA  
**Estado:** Solo documentación — sin fixes aplicados aún

---

## Metodología

Revisión estática de código (JSX + CSS) de los siguientes archivos:

- `src/index.css` (~4 900 líneas)
- Todos los `.jsx` en `src/apps/`
- Cálculo manual de relaciones de contraste usando la fórmula WCAG 2.1 (luminancia relativa)

---

## Resumen ejecutivo

| Severidad | Cantidad | Issues principales |
|-----------|----------|--------------------|
| CRÍTICA | 7 | Contraste dorado/blanco, focus sin outline, falta focus trap, sin landmark `<main>` |
| ALTA | 11 | Falta `aria-expanded`, `aria-labelledby` en diálogos, `aria-current` en tabs, `scope` en TH, `<caption>`, heading h2 en selector |
| MEDIA | 8 | Labels en selects de tabla, `aria-sort`, skip link ausente, botones sin aria-label |
| BAJA | 5 | `aria-describedby`, reduced-motion parcial, roles en overlays, landmarks complementarios |

---

## SECCIÓN 1 — Contraste de colores (WCAG 1.4.3)

### Cálculo de luminancia relativa

**Fórmula:** L = 0.2126·R + 0.7152·G + 0.0722·B (canales linearizados)  
**Ratio:** (L1 + 0.05) / (L2 + 0.05) donde L1 ≥ L2  
**Umbral:** ≥ 4.5:1 texto normal | ≥ 3:1 texto grande (≥18pt normal o ≥14pt bold)

---

### 1.1 Acento dorado `#ceb37c` sobre blanco `#ffffff`

**Severidad: CRÍTICA**

- R=206, G=179, B=124 → L_acento ≈ 0.477  
- L_blanco = 1.0  
- **Ratio: (1.05) / (0.477 + 0.05) = 1.99:1** ❌ FALLA (necesita 4.5:1 para normal, 3:1 para grande)

**Contextos afectados:**
- `.selector-last-badge`: "Último usado" (#ceb37c bg, #0f2b41 text) — ver sección siguiente
- `.mobile-filter-badge` (`src/index.css` línea ~4643): fondo `#ceb37c`, texto `#fff`  
  - Ratio ceb37c/#fff: (0.477 + 0.05) / (0 + 0.05) = **10.54:1** ✅ (pero solo 17×17px, texto muy pequeño)
- `.mobile-add-btn` (`src/index.css` línea ~4661): fondo `#ceb37c`, color `#fff`  
  - Ratio: **10.54:1** ✅ (ícono, no texto)
- `.kpi-pct` (`src/index.css` línea 2978): `color: #ceb37c` sobre fondo `#0f2b41`  
  - L_navy = 0.0118  
  - Ratio: (0.477 + 0.05) / (0.0118 + 0.05) = **8.53:1** ✅
- `.profile-since` (`src/index.css` línea 3715): `color: #ceb37c` sobre `#0f2b41`  
  - **8.53:1** ✅

**Caso problemático principal:** Si el acento dorado se usa sobre fondo BLANCO o claro, falla 4.5:1. En el código actual esto ocurre en:
- `.empty-state-cta` (`src/index.css` línea 488): fondo `var(--accent)=#ceb37c`, texto `var(--primary)=#0f2b41` → **3.82:1** ❌ para texto normal (14px bold — necesita 4.5:1 o si se considera "texto grande" bold ≥14pt ≈ 18.67px, necesita 3:1 → borderline)
- `.btn-add` (`src/index.css` línea 131): fondo `#ceb37c`, color `#0f2b41` — mismo cálculo **3.82:1** ❌

**Nota:** El ratio exacto entre `#ceb37c` (L≈0.477) y `#0f2b41` (L≈0.0118):  
(0.477 + 0.05) / (0.0118 + 0.05) = 0.527 / 0.0618 = **8.53:1** — este par SÍ cumple.  
Sin embargo, la computación para `#ceb37c` como *fondo* con texto `#0f2b41` da el mismo ratio 8.53:1 ✅.  
**El problema real:** `#ceb37c` sobre fondos CLAROS (no `#0f2b41`).

**Recalculando `#ceb37c` sobre `#0f2b41`:** (mayor + 0.05) / (menor + 0.05) = (0.477 + 0.05) / (0.0118 + 0.05) = **8.53:1** ✅ — btn-add y empty-state-cta sí cumplen.

**Caso sí falla — `.selector-last-badge`:** fondo `#ceb37c` (L≈0.477), texto `#0f2b41` (L≈0.0118) = **8.53:1** ✅

**Conclusión contraste acento:** El par `#ceb37c / #0f2b41` pasa con 8.53:1. El problema es cuando `#ceb37c` se usa como texto sobre fondos intermedios.

---

### 1.2 Texto muted `#5a7a96` sobre fondos claros

**Severidad: ALTA**

- RGB(90, 122, 150) → L_muted ≈ 0.189  
- Fondo `#ffffff` (L=1.0): ratio = (1.05) / (0.189 + 0.05) = **4.39:1** ❌ (necesita 4.5:1)  
- Fondo `#f0f6fc` = `--row-odd` (L ≈ 0.916): ratio = (0.916 + 0.05) / (0.189 + 0.05) = **4.04:1** ❌

**Contextos afectados:**
- `.semana-text` (`src/index.css` línea 359): `color: var(--text-muted)` sobre `--row-even` (#fff) = 4.39:1 ❌
- `.planif-count` badge sobre `#eef4fb`: ratio aún menor, ≈ 3.8:1 ❌
- `.sub-sublabel` (`src/index.css` línea 263): `color: var(--text-muted)` sobre `#dbeafe` (L≈0.845) → (0.845+0.05)/(0.189+0.05) = **3.74:1** ❌
- `.log-date`, `.log-detalle` sobre fondo blanco: **4.39:1** ❌
- `.empty-state-sub`: `color: var(--text-muted)` sobre blanco = 4.39:1 ❌
- `.canal-text` (`src/index.css` línea 3206): `color: #64748b` (L≈0.154) sobre blanco = (1.05)/(0.154+0.05) = **5.14:1** ✅
- `.selector-subtitle`, `.selector-card-desc`: `color: #64748b` sobre blanco = **5.14:1** ✅

**Fix propuesto:** Oscurecer `--text-muted` de `#5a7a96` a `#4a6a82` (L≈0.152) → ratio sobre blanco ≈ 5.2:1 ✅, o usar `#4f6e87`.

---

### 1.3 Estados de celda MediaTable

**Severidad: CRÍTICA para SI, ALTA para PD**

**Estado SI — `#1e6621` sobre `#c6efce`:**
- L_texto = RGB(30, 102, 33) → L ≈ 0.128  
- L_fondo = RGB(198, 239, 206) → L ≈ 0.843  
- Ratio: (0.843 + 0.05) / (0.128 + 0.05) = **5.02:1** ✅

**Estado PD — `#7d5a00` sobre `#fff2cc`:**
- L_texto = RGB(125, 90, 0) → L ≈ 0.120  
- L_fondo = RGB(255, 242, 204) → L ≈ 0.897  
- Ratio: (0.897 + 0.05) / (0.120 + 0.05) = **5.57:1** ✅

**Estado NO — `#8b0000` sobre `#ffc7ce`:**
- L_texto = RGB(139, 0, 0) → L ≈ 0.082  
- L_fondo = RGB(255, 199, 206) → L ≈ 0.614  
- Ratio: (0.614 + 0.05) / (0.082 + 0.05) = **5.02:1** ✅

**Conclusión:** Los tres estados de celda cumplen WCAG AA.  

**Sin embargo:** el texto dentro de las celdas es `.cell-text` con `font-size: .72rem` ≈ 11.5px, lo cual es **texto no-grande** → el umbral es 4.5:1. Los ratios calculados pasan. Pero el tamaño de fuente es extremadamente pequeño — no es un issue de contraste sino de legibilidad general (no regulado por WCAG directamente).

---

### 1.4 Colores de ejes editoriales

**Severidad: MEDIA**

Los ejes tienen colores definidos en `src/apps/mesa-editorial/config.js` (no revisado directamente). Los colores visibles en el CSS son:

- Eje verde `#1D7A4F` como texto/fondo de `.tema-canales`: L ≈ 0.144 sobre fondo `#eef4fb` (L≈0.907) → ratio (0.907+0.05)/(0.144+0.05) = **4.93:1** ✅
- `.group-organicos`: fondo `#1D7A4F`, texto `#fff` → L_verde=0.144, ratio (1.05)/(0.144+0.05) = **5.41:1** ✅
- `.group-alianzas`: fondo `var(--secondary)=#275da5` (L≈0.100), texto `#fff` → (1.05)/(0.100+0.05) = **7:1** ✅
- `.group-pub-pagada`: fondo `var(--primary-light)=#163d5a` (L≈0.024), texto `#fff` → (1.05)/(0.024+0.05) = **14.2:1** ✅

**Encabezados de tabla editorial** (`.editorial-table th`):  
- color `#475569` (L≈0.079) sobre `#f1f5f9` (L≈0.889) → (0.889+0.05)/(0.079+0.05) = **7.28:1** ✅

**`#64748b` sobre `#f8fafc`** (eje-count sobre header eje):  
- L_text=0.154, L_bg≈0.953 → (1.003)/(0.204) = **4.92:1** ✅

---

### 1.5 Header subtitle

**Severidad: ALTA**

`.header-subtitle`: `color: rgba(255,255,255,.55)` sobre `#0f2b41`  
- Blanco al 55% ≈ `#8fa0ad` en términos de contraste efectivo aproximado → ratio sobre navy ≈ **2.8:1** ❌  
- También `.user-email`: `color: rgba(255,255,255,.5)` → ratio ≈ **2.5:1** ❌  
- `.realtime-badge` texto: `color: rgba(255,255,255,.7)` → ratio ≈ **3.6:1** — borderline ❌ para texto normal

**Fix propuesto:** Subir opacidad a mínimo `.8` para cumplir 4.5:1, o usar `rgba(255,255,255,0.9)`.

---

### 1.6 Login hero text

**Severidad: ALTA**

- `.login-hero-headline`: `color: rgba(255,255,255,0.88)` sobre imagen (no calculable estáticamente)
- `.login-hero-sub`: `color: rgba(255,255,255,0.78)` sobre overlay `rgba(0,0,0,0.55)`  
  - Fondo efectivo ≈ `#737373` (L≈0.193) → blanco al 78% ≈ `#c7c7c7` (L≈0.586) → ratio ≈ **3.1:1** — borderline

Texto decorativo sobre imagen, no contenido funcional crítico. Marcar como **deuda consciente** si el fix estético resulta complicado.

---

### 1.7 Subgrupos verdes (`#1D7A4F` sobre `#e8f5e9`)

**Severidad: MEDIA**

`.subgroup-header-row th`: `color: #1D7A4F` (L≈0.144) sobre `#e8f5e9` (L≈0.882)  
Ratio: (0.882+0.05)/(0.144+0.05) = **4.80:1** ✅ (justo encima del límite)

---

## SECCIÓN 2 — Labels y nombres accesibles (WCAG 4.1.2)

### 2.1 Botones icon-only sin aria-label

**Severidad: ALTA**

| Archivo | Línea aprox. | Elemento | Issue |
|---------|-------------|---------|-------|
| `mesa-medios/components/MediaTable.jsx` | 173 | `.tema-expand-btn` (chevron expand/collapse tema) | Sin `aria-label`, solo `title` — `title` no es accesible a lectores de pantalla en todos los contextos |
| `mesa-medios/components/MediaTable.jsx` | 234–244 | `.tema-trash-btn` (eliminar tema) | Solo `title="Eliminar tema"`, sin `aria-label` |
| `mesa-medios/components/MediaTable.jsx` | 293–302 | `.btn-delete` (eliminar planificación) | Solo `title="Eliminar planificación"`, sin `aria-label` |
| `mesa-editorial/components/EjeSection.jsx` | 221 | `.resultado-toggle` (expandir backlogs) | Solo `title`, sin `aria-label` |
| `mesa-editorial/components/EjeSection.jsx` | 299–308 | `.btn-sync-medios` | Solo `title`, sin `aria-label` |
| `mesa-editorial/components/EjeSection.jsx` | 309–318 | `.btn-add-backlog` | Solo `title`, sin `aria-label` |
| `mesa-editorial/components/EjeSection.jsx` | 313–319 | `.btn-delete-row` (Resultado) | Solo `title`, sin `aria-label` |
| `mesa-editorial/components/EjeSection.jsx` | 475 | `.btn-delete-row` (Backlog) | Solo `title`, sin `aria-label` |
| `mesa-medios/components/Header.jsx` | 53–57 | `.btn-logout` | Solo `title="Cerrar sesión"`, sin `aria-label` |
| `mesa-editorial/components/Header.jsx` | 53–57 | `.btn-logout` | Ídem |
| `mesa-medios/components/Header.jsx` | 24–28 | `.btn-back-selector` | Solo `title="Volver al selector"`, sin `aria-label` |
| `mesa-editorial/components/Header.jsx` | 24–28 | `.btn-back-selector` | Ídem |
| `mesa-editorial/components/ExplorerSidebar.jsx` | 51 | `.modal-close` (cerrar sidebar) | Sin `aria-label` |
| `mesa-medios/components/AddRowModal.jsx` | 147 | `.modal-close` (desktop) | Sin `aria-label` |
| `mesa-editorial/components/EjeSection.jsx` | 286–296 | `.btn-reactivate` | Sí tiene texto visible "Reactivar" ✅ |

**Fix propuesto:** Añadir `aria-label` descriptivo a cada botón. Para botones dinámicos (expand/collapse), usar `aria-label={isExpanded ? 'Colapsar tema' : 'Expandir tema'}`.

---

### 2.2 Selects en tabla sin label visible

**Severidad: ALTA**

| Archivo | Elemento | Issue |
|---------|---------|-------|
| `mesa-editorial/components/EjeSection.jsx` línea ~171 | `<select>` Hito (ResultadoRow) | Sin `<label>` asociado ni `aria-label` |
| `mesa-editorial/components/EjeSection.jsx` línea ~184 | `<select>` Eje (ResultadoRow) | Sin `<label>` |
| `mesa-editorial/components/EjeSection.jsx` línea ~209 | `<select>` Tipología (ResultadoRow) | Sin `<label>` |
| `mesa-editorial/components/EjeSection.jsx` línea ~277 | `<select>` Status (ResultadoRow) | Sin `<label>` |
| `mesa-editorial/components/EjeSection.jsx` línea ~354 | `<select>` Hito (BacklogRow) | Sin `<label>` |
| `mesa-editorial/components/EjeSection.jsx` línea ~367 | `<select>` Eje (BacklogRow) | Sin `<label>` |
| `mesa-editorial/components/EjeSection.jsx` línea ~443 | `<select>` Status (BacklogRow) | Sin `<label>` |

El encabezado de columna actúa como label implícito en la tabla, pero para AT se requiere asociación programática.  
**Fix propuesto:** Añadir `aria-label` a cada select (ej. `aria-label="Hito del resultado"`, `aria-label={`Estado de ${row.accion}`}`).

---

### 2.3 Inputs de filtro de fecha sin label visible

**Severidad: MEDIA**

| Archivo | Línea | Elemento | Issue |
|---------|-------|---------|-------|
| `mesa-editorial/MesaEditorialApp.jsx` | ~735 | `<input type="date">` filtro from | Sin `<label>`, solo placeholder visual implícito (separador "→") |
| `mesa-editorial/MesaEditorialApp.jsx` | ~736 | `<input type="date">` filtro to | Ídem |

**Fix propuesto:** Agregar `aria-label="Fecha desde"` y `aria-label="Fecha hasta"`.

---

### 2.4 Tabs Activas/Archivadas sin aria-current ni role

**Severidad: ALTA**

`mesa-editorial/MesaEditorialApp.jsx` líneas ~408–423:

```jsx
<div className="editorial-tabs">
  <button className={`tab-btn${activeTab === 'active' ? ' tab-active' : ''}`}>
    Activas
  </button>
```

- No tiene `role="tab"` ni `aria-selected`
- No tiene `aria-current="page"` o similar
- El contenedor no tiene `role="tablist"`

**Fix propuesto:** Añadir `role="tablist"` al contenedor, `role="tab"` a cada botón y `aria-selected={activeTab === 'active'}`.

---

### 2.5 contentEditable sin accesibilidad

**Severidad: ALTA**

`mesa-editorial/components/EjeSection.jsx` usa `contentEditable` en celdas de tabla para tema, acción y responsable:

```jsx
<span contentEditable={!isArchived} suppressContentEditableWarning
  onBlur={e => handleInlineEdit('accion', e.currentTarget.textContent.trim())}
  className="editorial-editable">
```

- No tiene `role="textbox"`
- No tiene `aria-label` ni `aria-labelledby`
- No tiene `aria-multiline`

**Fix propuesto:** Agregar `role="textbox"`, `aria-label="Acción"`, `aria-multiline="false"` a cada `contentEditable`. O mejor aún, reemplazar por `<input>` convencional (más accesible de base).

---

## SECCIÓN 3 — Estructura semántica (WCAG 1.3.1)

### 3.1 Falta landmark `<main>`

**Severidad: CRÍTICA**

Ningún componente envuelve el contenido principal en un `<main>`. El `App.jsx` retorna directamente los componentes de módulo sin wrapping semántico. Lectores de pantalla no pueden navegar al contenido principal.

**Archivos afectados:**
- `src/App.jsx` — retorna componentes sin `<main>`
- `src/apps/mesa-medios/MesaMediosApp.jsx` — usa `<div className="app">` 
- `src/apps/mesa-editorial/MesaEditorialApp.jsx` — usa `<div className="app app-editorial">`

**Fix propuesto:** Cambiar la `<div className="app">` por `<main className="app">` o añadir `<main>` que envuelva el contenido principal (excluyendo el `<header>`).

---

### 3.2 Falta `<nav>` en el sidebar explorador

**Severidad: MEDIA**

`mesa-editorial/components/ExplorerSidebar.jsx`: El elemento `.explorer-sidebar` actúa como sidebar de navegación pero usa `<div>`. No tiene `role="complementary"` ni `<aside>`, ni `aria-label`.

**Fix propuesto:** Cambiar `<div className="explorer-sidebar">` por `<aside className="explorer-sidebar" aria-label="Explorador de ejes y temas">`.

---

### 3.3 Tabla MediaTable sin `<caption>` ni `scope` en `<th>`

**Severidad: ALTA**

`mesa-medios/components/MediaTable.jsx`:

- La tabla principal no tiene `<caption>` — lectores de pantalla no saben qué tabla están leyendo
- Los `<th>` en `group-header-row`, `subgroup-header-row` y `sub-header-row` no tienen `scope="col"` ni `scope="colgroup"`
- Las cabeceras "TEMAS" y "FECHA" (que abarcan 3 filas con `rowSpan={3}`) no tienen `scope="col"`

**Fix propuesto:**
```jsx
<table className="media-table">
  <caption className="sr-only">Tabla de planificación de medios por tema y fecha</caption>
  // ...
  <th ... scope="colgroup" colSpan={groupColCount}>...</th>
  <th ... scope="col">...</th>
```

---

### 3.4 Tabla Editorial sin `scope` en `<th>`

**Severidad: ALTA**

`mesa-editorial/components/EjeSection.jsx` línea ~79:
```jsx
<th className="col-tipo">Hito</th>
<th className="col-eje">Eje</th>
// etc.
```

Ningún `<th>` tiene `scope="col"`.

**Fix propuesto:** Añadir `scope="col"` a todos los `<th>` de encabezado.

---

### 3.5 Jerarquía de headings

**Severidad: MEDIA**

Análisis de la jerarquía de encabezados:

- Login: `<h1 className="login-title">Iniciar sesión</h1>` ✅
- Selector: `<h1 className="selector-title">Sistema de Gestión USS</h1>` ✅  
  Pero las cards usan `<h2>` dentro de `<button>` (`selector-card-title`) — `<h2>` dentro de `<button>` es **HTML inválido** ❌
- Mesa de Medios Header: `<h1 className="header-title">Mesa de Medios</h1>` ✅
- Mesa Editorial Header: `<h1 className="header-title">Mesa Editorial</h1>` ✅
- `EjeSection.jsx` línea 54: `<h2 className="eje-title">{eje.label}</h2>` ✅ (correcto bajo h1 del header)
- `ConfirmDialog.jsx` línea 30: `<h3 className="confirm-title">` — pero no hay h2 padre → salta de h1 a h3 ❌
- `ExplorerSidebar.jsx` línea 42: `<h3 className="explorer-title">` — salta de h1 a h3 ❌
- `AddRowModal.jsx` línea 146: `<h2>` en modal — modal es contexto aislado, aceptable si tiene `role="dialog"`

**Fix propuesto:**
- `DashboardSelector.jsx`: reemplazar `<h2 className="selector-card-title">` por `<span className="selector-card-title">` con estilos equivalentes
- `ConfirmDialog.jsx`: cambiar `<h3>` a `<h2>` (el dialog es su propio contexto)
- `ExplorerSidebar.jsx`: cambiar `<h3>` a `<h2>` dentro del aside

---

## SECCIÓN 4 — Focus management (WCAG 2.4.3, 2.4.7)

### 4.1 Elementos con `outline: none` sin alternativa

**Severidad: CRÍTICA**

Múltiples inputs y elementos eliminan el outline sin ofrecer un indicador de foco alternativo visible:

| Archivo `src/index.css` | Línea | Elemento | Estado |
|------------------------|-------|---------|--------|
| línea 380 | `.inline-edit` (date inputs tabla) | `outline: none` — solo `border-color` en focus ❌ (border-color cambia pero no es visible indicador) |
| línea 571 | `.popover-name-input input` | `outline: none` — solo `border-color: var(--secondary)` en focus — borderline ✅ |
| línea 705 | `.form-group input` (AddRowModal) | `outline: none` — solo border ❌ |
| línea 822 | `.login-input` | `outline: none` — solo border ❌ |
| línea 1318 | `.mobile-card-name-input` | `outline: none` ❌ |
| línea 1583 | (sheet-name-input) | `outline: none` ❌ |
| línea 1894 | (otra clase) | `outline: none` ❌ |
| línea 1978 | `.popover-notas-input` | `outline: none` — solo border ❌ |
| línea 2045 | (otra clase) | `outline: none` ❌ |
| línea 2375 | `.tema-name-edit` | `outline: none` ❌ |
| línea 3214 | `.editorial-editable` | `outline: none` — usa `box-shadow` en focus ✅ (borderline) |
| línea 3504–3505 | `.modal-body select:focus` | `outline: none` — usa box-shadow ✅ |
| línea 3529–3531 | `.modal-body input:focus, textarea:focus` | `outline: none` — usa box-shadow ✅ |
| línea 4610 | `.mobile-search-input` | `outline: none` ❌ |

**Regla WCAG 2.4.7:** El indicador de foco debe ser visible. Un `border-color` sutil puede no ser suficiente para usuarios con baja visión. El uso de `box-shadow: 0 0 0 3px` es aceptable como alternativa a outline.

**Fix propuesto:**  
Reemplazar todos los `outline: none` aislados por un focus visible consistente:
```css
outline: none;
box-shadow: 0 0 0 2px var(--secondary);
```
O usar `outline: 2px solid var(--secondary); outline-offset: 1px;`.

---

### 4.2 Focus trap incompleto en ConfirmDialog

**Severidad: CRÍTICA**

`src/apps/shared/components/ConfirmDialog.jsx`:

- ✅ Auto-focus en botón "Cancelar" al abrir
- ✅ Escape cierra el diálogo
- ❌ **Sin focus trap**: Tab desde el último elemento sale del diálogo y llega a elementos del fondo

**Fix propuesto:** Implementar focus trap con `useEffect` que intercepte Tab/Shift+Tab y circule dentro del diálogo.

---

### 4.3 Focus trap ausente en BottomSheet

**Severidad: CRÍTICA**

`src/apps/shared/components/BottomSheet.jsx`:

- ✅ Escape no está implementado — `onClose` no se llama con Escape ❌
- ❌ Sin focus trap (Tab sale del sheet)
- ❌ Sin auto-focus al abrir

**Fix propuesto:** Añadir `useEffect` para Escape + focus trap completo.

---

### 4.4 Focus trap ausente en AddRowModal y AddActionModal

**Severidad: ALTA**

- `AddRowModal.jsx`: Solo auto-focus en primer input. Sin focus trap. Tab puede salir del modal.
- `AddActionModal.jsx`: Auto-focus en `firstRef`. Escape cierra ✅. Sin focus trap.

**Fix propuesto:** Implementar focus trap en ambos.

---

### 4.5 Focus trap ausente en ExplorerSidebar

**Severidad: ALTA**

`ExplorerSidebar.jsx`: Sin focus trap. El sidebar overlay cubre el contenido pero Tab puede navegar detrás.

---

### 4.6 Retorno de focus al trigger al cerrar modales

**Severidad: ALTA**

Ninguno de los modales/overlays devuelve el focus al elemento que los abrió al cerrarse. Tras cerrar un modal, el foco queda en `document.body`.

**Archivos afectados:**
- `ConfirmDialog.jsx`
- `BottomSheet.jsx`  
- `AddRowModal.jsx`
- `AddActionModal.jsx`
- `ExplorerSidebar.jsx`
- `AuditLogPanel` (no revisado en detalle)

**Fix propuesto:** En cada modal, guardar `document.activeElement` antes de abrir y restaurarlo al cerrar.

---

### 4.7 Skip link ausente

**Severidad: ALTA**

No existe ningún enlace "Saltar al contenido principal" que permita a usuarios de teclado evitar la navegación del header en cada carga de página.

**Fix propuesto:** Añadir en `App.jsx` o en cada Header:
```jsx
<a href="#main-content" className="skip-link">Saltar al contenido principal</a>
```
Con CSS:
```css
.skip-link {
  position: absolute;
  transform: translateY(-100%);
  transition: transform 0.2s;
}
.skip-link:focus {
  transform: translateY(0);
}
```

---

### 4.8 CellPopover no es navegable por teclado

**Severidad: MEDIA**

`CellPopover.jsx`:

- ✅ Escape cierra/retrocede al modo vista
- ✅ Las opciones de radio son navegables con flechas nativas
- ❌ La celda `<td>` que abre el popover no es un elemento nativo interactivo (sin `tabindex`, sin `role="button"`) — no es alcanzable por Tab
- ❌ El popover no recibe auto-focus al abrirse (el usuario no puede usar el popover sin mouse)

**Fix propuesto:** Para Fase 5 (navegación arrow keys).

---

## SECCIÓN 5 — ARIA (WCAG 4.1.2)

### 5.1 `aria-expanded` faltante en botones de colapso

**Severidad: ALTA**

| Archivo | Elemento | Issue |
|---------|---------|-------|
| `MediaTable.jsx` línea 173 | `.tema-expand-btn` | Sin `aria-expanded={isExpanded}` |
| `EjeSection.jsx` línea 51 | `.eje-header` (div con onClick) | Es un `<div>` con `onClick`, debería ser `<button>` con `aria-expanded` |
| `MesaEditorialApp.jsx` línea 428 | `.kpi-mobile-summary` | Sin `aria-expanded={kpiExpanded}` |
| `MediaTable.jsx` línea ~452–470 | `<th>` grupo con onClick collapse | Sin `role="button"` ni `aria-expanded` |
| `EjeSection.jsx` línea 221 | `.resultado-toggle` (expandir backlogs) | Sin `aria-expanded={expanded}` |

---

### 5.2 `aria-current` faltante en tabs

**Severidad: ALTA**

`MesaEditorialApp.jsx` líneas 408–423: Los botones de tab no tienen `aria-current="page"` ni `aria-selected`.

---

### 5.3 `role="dialog"` + `aria-labelledby` incompleto

**Severidad: ALTA**

| Archivo | Estado |
|---------|--------|
| `ConfirmDialog.jsx` | `role="dialog"` ✅, `aria-modal="true"` ✅, **`aria-labelledby` faltante** ❌ |
| `AddRowModal.jsx` | `<div className="modal">` sin `role="dialog"` ❌, sin `aria-modal` ❌, sin `aria-labelledby` ❌ |
| `AddActionModal.jsx` | `<div className="modal-content">` sin `role="dialog"` ❌, sin `aria-modal` ❌ |
| `ExplorerSidebar.jsx` | `.explorer-sidebar` sin `role` ❌ |
| `AuditLogPanel` | No revisado en detalle |

**Fix propuesto:**
```jsx
// ConfirmDialog
<div role="dialog" aria-modal="true" aria-labelledby="confirm-title">
  <h2 id="confirm-title">...</h2>

// AddRowModal
<div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">{titleLabel}</h2>
```

---

### 5.4 `aria-live` para toasts

**Severidad: MEDIA**

`Toaster.jsx`:

- ✅ `role="alert"` en cada toast (implica `aria-live="assertive"`)
- ❌ Para toasts de tipo `info` o `success`, `role="alert"` es demasiado interrumpivo — debería usar `role="status"` (equivale a `aria-live="polite"`)

**Fix propuesto:**
```jsx
<div role={t.type === 'error' ? 'alert' : 'status'} ...>
```

---

### 5.5 `aria-sort` en columnas ordenables

**Severidad: MEDIA**

La Mesa Editorial tiene un botón de ordenación por fecha (`sortDir`) pero no hay `aria-sort` en los encabezados de la tabla editorial.

---

### 5.6 Falta `aria-labelledby` en ExplorerSidebar

**Severidad: MEDIA**

`ExplorerSidebar.jsx`: El sidebar actúa como región de navegación pero sin `aria-labelledby` que apunte al `<h3 className="explorer-title">`.

---

## SECCIÓN 6 — Teclado general (WCAG 2.1.1)

### 6.1 `<div>` y `<td>` interactivos sin rol teclado

**Severidad: CRÍTICA**

| Archivo | Elemento | Issue |
|---------|---------|-------|
| `EjeSection.jsx` línea 51 | `<div className="eje-header" onClick={onToggle}>` | `<div>` no es activable con Enter/Space, no tiene `role="button"` ni `tabIndex` |
| `MediaTable.jsx` línea 133–138 | `<td className="group-collapsed-cell" onClick={...}>` | `<td>` interactivo no es alcanzable por Tab |
| `MediaTable.jsx` línea ~149–163 | `<td className="media-cell" onClick={...}>` | Celdas de medios solo activables con mouse |
| `MediaTable.jsx` línea 277–284 | `<span className="semana-text" onClick={...}>` | Span interactivo sin `tabIndex` ni `role` |
| `MediaTable.jsx` línea 197 | `<span className="tema-nombre" onDoubleClick={...}>` | Edición solo via doble-click — no accesible por teclado |

**Fix propuesto para celdas de medios (Fase 5):** Implementar `tabindex="0"` con roving tabindex y navegación por flechas.

---

### 6.2 Escape en BottomSheet

**Severidad: ALTA**

`BottomSheet.jsx` no implementa cierre con Escape. Al estar abierto un BottomSheet, el usuario de teclado no puede cerrarlo con Escape.

---

## SECCIÓN 7 — Issues adicionales

### 7.1 Foco visible en `.tema-expand-btn`

`src/index.css` línea 2335: `.tema-expand-btn` no tiene estilo de focus visible (`:focus-visible`).

---

### 7.2 Imágenes decorativas

`Header.jsx` (mesa-medios y mesa-editorial): El logo USS tiene `alt="USS"` — correcto si USS es el texto completo significativo, pero debería ser `alt="Universidad San Sebastián"` para ser descriptivo. (`DashboardSelector.jsx` ya lo hace bien con `alt="Universidad San Sebastián"`).

---

### 7.3 Falta `<label>` en filtro de búsqueda

`mesa-editorial/MesaEditorialApp.jsx` línea ~474: el `<input type="text">` del filtro de búsqueda no tiene `<label>` asociado. Solo tiene `placeholder`. El `placeholder` no es suficiente como label accesible.

Ídem en `MesaMediosApp.jsx` filtro de búsqueda.

**Fix propuesto:** Añadir `aria-label="Buscar tema, acción o responsable"` al input.

---

### 7.4 Tabla con filas mixtas (header + data) en MediaTable

`MediaTable.jsx`: Los `<tr className="tema-header-row">` que actúan como separadores de sección son `<tr>` en `<tbody>` pero contienen `<td>` con información de sección. Para AT, estos deberían tener `role="rowheader"` o `aria-label` que explique que son encabezados de grupo.

---

## Priorización de fixes

### Para Fase 2 (alto impacto, bajo riesgo):

1. ✅ `aria-label` en todos los botones icon-only (Secciones 2.1, 2.2)
2. ✅ `aria-expanded` en botones de colapso (Sección 5.1)
3. ✅ `role="dialog"` + `aria-modal` + `aria-labelledby` en AddRowModal y AddActionModal (Sección 5.3)
4. ✅ `aria-live="polite"` / `role="status"` en toasts info/success (Sección 5.4)
5. ✅ `scope="col"` en `<th>` de ambas tablas (Secciones 3.3, 3.4)
6. ✅ `<main>` landmark (Sección 3.1)
7. ✅ `<aside aria-label>` para ExplorerSidebar (Sección 3.2)
8. ✅ Skip link (Sección 4.7)
9. ✅ `aria-current` en tabs (Sección 5.2)
10. ✅ `aria-label` en filtros de búsqueda (Sección 7.3)
11. ✅ `aria-label` en date inputs de filtro (Sección 2.3)

### Para Fase 3 (contraste):

1. Oscurecer `--text-muted` de `#5a7a96` → `~#4a6a82` (Sección 1.2)
2. Subir opacidad de `.header-subtitle` y `.user-email` (Sección 1.5)
3. `.btn-add` y `.empty-state-cta`: verificar si pasa como "texto grande" (bold 14px = ~10.5pt — NO es texto grande por WCAG). Evaluar oscurecer texto a full `#0f2b41`.

### Para Fase 4 (focus management):

1. Focus trap en ConfirmDialog (Sección 4.2)
2. Focus trap + Escape en BottomSheet (Secciones 4.3, 6.2)
3. Focus trap en AddRowModal, AddActionModal (Sección 4.4)
4. Retorno de focus al trigger (Sección 4.6)
5. Focus visible en `.tema-expand-btn` y otros sin `:focus-visible` (Sección 4.1)
6. Hacer `<div className="eje-header">` un `<button>` (Sección 6.1)

### Para Fase 5 (arrow keys MediaTable):

1. Navegación arrow keys en celdas de medios (Sección 6.1)
2. `tabIndex` en celdas interactivas con roving tabindex
3. Focus en CellPopover al abrirse (Sección 4.8)

---

## Deudas conscientes (no bloquean AA)

| Issue | Razón |
|-------|-------|
| Texto sobre imagen en login hero (Sección 1.6) | Decorativo, no contenido funcional |
| `.cell-text` font-size 11.5px | No regulado directamente por WCAG AA (WCAG 1.4.4 solo cubre redimensionado) |
| `contentEditable` inline en EjeSection | Funcional pero mejorable; reemplazar por `<input>` es refactor de lógica de negocio |
| Doble-click para editar nombre de tema | Añadir botón accesible alternativo sin romper UX existente |

---

*Auditoría generada el 2026-04-23. No se aplicaron cambios de código en esta fase.*
