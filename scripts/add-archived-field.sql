-- Sistema de archivado para Mesa Editorial
-- Ejecutar DESPUÉS del deploy en Supabase SQL Editor

ALTER TABLE mesa_editorial_acciones
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Índice para queries rápidas separando activos vs archivados
CREATE INDEX IF NOT EXISTS idx_editorial_archived
  ON mesa_editorial_acciones(archived);

-- Las acciones existentes con status = 'Completado' se mantienen como están
-- (activas pero completadas). El usuario decide cuándo archivarlas.
-- La lógica de auto-archivado aplica solo desde el deploy en adelante.
