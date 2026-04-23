-- =====================================================================
-- add-performance-indexes.sql
-- Fecha: 2026-04-23
-- Propósito: Índices de performance para queries frecuentes en filtros,
--            Realtime, y paneles de historial (UserProfilePanel).
--
-- Todos los índices usan CREATE INDEX IF NOT EXISTS → idempotente.
-- Seguro de ejecutar múltiples veces. Sin downtime (CREATE INDEX sin
-- CONCURRENTLY es rápido en tablas de este tamaño; si alguna tabla
-- crece mucho en el futuro, considerar migrar a CONCURRENTLY).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) contenidos: filtros por tema_id + rango de fechas (Mesa de Medios)
--    Usado en:
--      - Carga inicial de planificaciones por tema
--      - Filtro filterDateRange
--      - Join implícito temas ↔ contenidos
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contenidos_tema_id_semana
  ON contenidos (tema_id, semana DESC);

-- Índice auxiliar para filtros solo por fecha
CREATE INDEX IF NOT EXISTS idx_contenidos_semana
  ON contenidos (semana DESC);

-- ---------------------------------------------------------------------
-- 2) mesa_editorial_acciones: tab Activas/Archivadas + filtro eje
--    Usado en:
--      - Split activeTab 'active' | 'archived' (archived BOOLEAN)
--      - Filtro filterEje
--      - KPI bar (conteos por status agrupados por eje)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_editorial_archived_eje
  ON mesa_editorial_acciones (archived, eje);

-- Filtro por status dentro de tab Activas (solo rows no archivadas)
CREATE INDEX IF NOT EXISTS idx_editorial_status_active
  ON mesa_editorial_acciones (status)
  WHERE archived = FALSE;

-- Ordenamiento por fecha (sortDir asc/desc en filtros)
CREATE INDEX IF NOT EXISTS idx_editorial_fecha
  ON mesa_editorial_acciones (fecha DESC NULLS LAST);

-- ---------------------------------------------------------------------
-- 3) mesa_editorial_acciones.parent_id: lookup de backlogs por resultado
--    Usado en:
--      - Expansión de resultados para mostrar backlogs vinculados
--      - Conteo de pendingChildCount en handleInitiateArchive
--      - Cascade archive
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_editorial_parent_id
  ON mesa_editorial_acciones (parent_id)
  WHERE parent_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4) audit_logs: historial personal en UserProfilePanel
--    Usado en:
--      - Query "últimas N acciones del usuario X" (order by created_at DESC)
--      - Stats de actividad por usuario
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON audit_logs (user_email, created_at DESC);

-- Índice auxiliar para filtros globales por mesa_type + fecha
CREATE INDEX IF NOT EXISTS idx_audit_logs_mesa_created
  ON audit_logs (mesa_type, created_at DESC)
  WHERE mesa_type IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5) pin_login_attempts: rate limiting (ya tiene índice según doc,
--    pero garantizamos idempotencia)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pin_attempts_email_time
  ON pin_login_attempts (email, attempted_at DESC);

-- =====================================================================
-- Verificación post-ejecución
-- Copiar y ejecutar manualmente para confirmar que los índices existen:
-- =====================================================================
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE indexname LIKE 'idx_%'
--   AND schemaname = 'public'
-- ORDER BY tablename, indexname;
