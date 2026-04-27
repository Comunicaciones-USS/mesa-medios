-- Sistema de archivado para Mesa de Medios — temas
-- Ejecutar en Supabase SQL Editor ANTES del deploy

ALTER TABLE temas
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_temas_archived ON temas(archived);
