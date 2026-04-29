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
