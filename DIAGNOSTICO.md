# Diagnóstico técnico — Sistema Mesa de Medios USS

> Generado: 2026-04-13 | Rama: main (post feature/estadisticas-perfil)

---

## 1. Archivos huérfanos

El proyecto tiene una capa de migración incompleta. Existe `src/apps/` con la arquitectura actual (dos mesas + shared), pero persiste el directorio raíz `src/components/` con versiones antiguas de los mismos componentes.

**Archivos huérfanos confirmados — ninguno es importado por código activo:**

| Ruta | Equivalente activo |
|------|--------------------|
| `src/components/AddRowModal.jsx` | `src/apps/mesa-medios/components/AddRowModal.jsx` |
| `src/components/AuditLogPanel.jsx` | `src/apps/mesa-medios/components/AuditLogPanel.jsx` |
| `src/components/CellPopover.jsx` | `src/apps/mesa-medios/components/CellPopover.jsx` |
| `src/components/ConfirmDialog.jsx` | `src/apps/shared/components/ConfirmDialog.jsx` |
| `src/components/Header.jsx` | `src/apps/mesa-medios/components/Header.jsx` |
| `src/components/Login.jsx` | `src/apps/shared/components/Login.jsx` |
| `src/components/MediaTable.jsx` | `src/apps/mesa-medios/components/MediaTable.jsx` |
| `src/components/MobileCardView.jsx` | `src/apps/mesa-medios/components/MobileCardView.jsx` |
| `src/components/Toaster.jsx` | `src/apps/shared/components/Toaster.jsx` |
| `src/components/USSLoader.jsx` | `src/apps/shared/components/USSLoader.jsx` |
| `src/hooks/useDebounce.js` | `src/apps/shared/hooks/useDebounce.js` |
| `src/hooks/useToast.js` | `src/apps/shared/hooks/useToast.js` |
| `src/config.js` | `src/apps/mesa-medios/config.js` |
| `src/supabase.js` | `src/apps/shared/utils/supabase.js` |

**Recomendación:** Eliminar `src/components/`, `src/hooks/`, `src/config.js` y `src/supabase.js` en un PR de limpieza. Son dead code puro, no afectan el bundle (Vite tree-shakes correctamente).

---

## 2. Calidad de código

### 2.1 Inconsistencia en check `inInput` (atajos de teclado)

**MesaMediosApp.jsx:57** no incluye `isContentEditable`:
```js
const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
```

**MesaEditorialApp.jsx:55** sí lo incluye (correcto):
```js
const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable
```

Mesa Medios no tiene campos `contentEditable`, pero por consistencia y prevención debería incluirlo.

### 2.2 Login duplicado en Mesa Editorial

`App.jsx:42` registra un login global (`mesa_type: null`) al verificar autorización. Luego `MesaEditorialApp.jsx:47` registra otro login con `mesa_type: 'editorial'`. Mesa Medios no registra login propio (solo hereda el global de App.jsx). Esto genera inconsistencia en `audit_logs`:

- Usuario de Editorial: 2 registros de login por sesión
- Usuario de Medios: 1 registro de login por sesión
- El `UserProfilePanel` cuenta todos los logins indiscriminadamente → infla el contador de Editorial

**Recomendación:** Eliminar el `logAction('LOGIN', ...)` de `MesaEditorialApp.jsx:47` y agregar el equivalente en `MesaMediosApp`, o manejar el login de mesa en `App.jsx` pasando el dashboard seleccionado.

### 2.3 Formato inconsistente en `audit_logs.details`

`App.jsx:48` inserta `details: 'Inició sesión'` (string plano). Todos los demás insertan `details: JSON.stringify({...})`. El `UserProfilePanel` usa `parseDetails()` con try/catch, por lo que no falla, pero retorna `{}` para el login de App.jsx.

### 2.4 Matching de responsable por primer nombre (fragil)

`UserProfilePanel.jsx:90-91`:
```js
const firstName = userName.split(' ')[0].toLowerCase()
const assigned = editorialRows.filter(r => r.responsable?.toLowerCase().includes(firstName))
```

Si dos usuarios comparten primer nombre (ej. "María García" y "María López"), las filas de ambas se mezclan en el panel de cada una. Mejor usar email o nombre completo para el match.

### 2.5 `stats.firstLogin` renderizado antes de cargar

En la versión desktop de `UserProfilePanel.jsx:281`, se accede a `stats.firstLogin` fuera del bloque `loading ? ... : ...`. Durante la carga, `stats` tiene valores por defecto vacíos (firstLogin = null), por lo que no renderiza — esto es correcto. Sin embargo, si `stats` se recalcula después del fetch, puede causar un re-render visible. Impacto bajo.

---

## 3. Capa de datos (Supabase)

### 3.1 Tablas en uso

| Tabla | Propósito | Notas |
|-------|-----------|-------|
| `contenidos` | Filas de Mesa Medios | JSONB `medios` con formato dual (legacy string / objeto `{valor, notas}`) |
| `mesa_editorial_acciones` | Filas de Mesa Editorial | Columnas simples + `completed_at TIMESTAMPTZ` (migración reciente) |
| `audit_logs` | Historial de acciones | `mesa_type` nullable, `details` mayormente JSON |
| `usuarios_autorizados` | Lista blanca de acceso | `email` + `activo` boolean |

### 3.2 Fetch de acciones editoriales en UserProfilePanel (sin filtro)

`UserProfilePanel.jsx:70-71` carga **todas** las filas de `mesa_editorial_acciones` sin filtrar por responsable:
```js
supabase.from('mesa_editorial_acciones').select('id, responsable, status, created_at, completed_at')
```

En producción con cientos de filas esto es ineficiente. Supabase filtra en el cliente, no en la BD.

**Recomendación:** Agregar `.ilike('responsable', `%${firstName}%`)` en la query, o mejor, guardar email en `responsable` para hacer un `.eq('responsable_email', userEmail)`.

### 3.3 Dual format en `medios` JSONB

`utils.js` soporta legado string (`"si/Juan"`) y nuevo objeto (`{valor: "si", notas: "Juan"}`). El código de migración implícita está bien encapsulado en `getCellData/setCellData`. Sin deuda técnica activa, pero conviene documentar que el formato legacy puede existir en filas antiguas.

### 3.4 Realtime subscriptions

Ambas mesas abren un canal al montar y lo limpian en el `return` del `useEffect`. Implementación correcta. No hay fugas de subscripciones.

---

## 4. Performance

### 4.1 MediaTable sin virtualización

`MediaTable.jsx` renderiza todas las filas × 30 columnas en el DOM. Para el volumen actual (~52 semanas × contenidos) es manejable, pero con >200 filas se volvería lento. Sin embargo, en la práctica Mesa Medios tiene pocas filas (contenidos semanales del año en curso), por lo que no es un problema inmediato.

### 4.2 `useMemo` correctamente aplicado

- `displayRows` en ambas mesas: dependencias precisas, no recalcula innecesariamente.
- `kpi` en MesaEditorialApp: separado de `displayRows`, correcto.
- `stats` en UserProfilePanel: cálculo pesado (loops sobre 200 logs + filas editoriales) memoizado correctamente.

### 4.3 `useDebounce(300ms)` en filtros de texto

Implementado en ambas mesas. Evita recalcular `displayRows` en cada tecla.

### 4.4 Build size (post feature/estadisticas-perfil)

```
index.css  55.01 kB  │ gzip: 10.68 kB
index.js  425.04 kB  │ gzip: 117.88 kB
```

El JS está en un solo chunk. Para este tamaño de proyecto es aceptable. No hay code-splitting por dashboard (ambos se cargan siempre), pero el overhead es bajo dado que comparten Supabase client y hooks.

---

## 5. UI / UX

### 5.1 Fortalezas

- **Realtime**: cambios de otros usuarios se reflejan al instante sin polling.
- **Optimistic updates**: UI actualiza antes de confirmar en BD; revierte si hay error.
- **Empty states**: bien manejados en ambas tablas (sin datos / sin resultados de filtro).
- **Toaster**: auto-dismiss, posición no invasiva.
- **Atajos de teclado**: Esc, Ctrl+K, N — documentados en `shortcuts-hint`.
- **Mobile**: vistas separadas con `MobileCardView`, no degraded desktop.
- **Sticky bars**: KPI bar y filter bar de Editorial con `position: sticky`.

### 5.2 Oportunidades de mejora

| Área | Problema | Severidad |
|------|----------|-----------|
| ContentEditable | Guarda solo en `onBlur` — si el usuario cierra la pestaña sin hacer click fuera, pierde cambios | Media |
| EjeSection fecha | `<input type="date">` con `defaultValue` (no controlled) — si la fila cambia por realtime, el input no se actualiza | Media |
| UserProfilePanel matching | Nombre → puede mezclar usuarios con mismo primer nombre | Media |
| Scroll horizontal MediaTable | Sin indicador visual de que la tabla hace scroll horizontal en mobile | Baja |
| Filter Mesa Medios | Solo filtra por `nombre`; no busca por `semana` ni por contenido de celdas | Baja |

### 5.3 Consistencia visual

- Ambas mesas comparten header, colores, tipografía y sistema de modales.
- `profile-panel-header` usa navy (`#0f2b41`) igual que el header principal.
- Los badges de acción (create/update/delete/login) son consistentes entre AuditLogPanel y UserProfilePanel.

---

## 6. Resumen de deuda técnica

| Prioridad | Item | Esfuerzo |
|-----------|------|----------|
| Alta | Eliminar `src/components/`, `src/hooks/`, `src/config.js`, `src/supabase.js` (dead code) | 15 min |
| Alta | Fix login duplicado en Mesa Editorial | 10 min |
| Media | Filtrar `mesa_editorial_acciones` por responsable en la BD (no en cliente) | 20 min |
| Media | Fix `inInput` en MesaMediosApp para incluir `isContentEditable` | 5 min |
| Media | Matching de responsable por email o nombre completo en UserProfilePanel | 30 min |
| Baja | ContentEditable: agregar `beforeunload` warning si hay cambios pendientes | 45 min |
| Baja | EjeSection fecha: convertir a controlled input | 20 min |
