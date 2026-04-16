-- ══════════════════════════════════════════════════════════════════
-- REFACTOR: Tabla temas + sincronización Editorial ↔ Medios
-- Ejecutar en Supabase SQL Editor ANTES del deploy de esta versión
-- ══════════════════════════════════════════════════════════════════

-- 1. Crear tabla temas (entidad canónica de topic)
CREATE TABLE IF NOT EXISTS temas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT        NOT NULL,
  origen     TEXT        NOT NULL DEFAULT 'medios',   -- 'medios' | 'editorial'
  eje        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Agregar tema_id a contenidos
--    ON DELETE CASCADE: al borrar el tema se borran sus planificaciones
ALTER TABLE contenidos
  ADD COLUMN IF NOT EXISTS tema_id UUID REFERENCES temas(id) ON DELETE CASCADE;

-- 3. Agregar sync_to_medios y tema_id a mesa_editorial_acciones
ALTER TABLE mesa_editorial_acciones
  ADD COLUMN IF NOT EXISTS sync_to_medios BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tema_id        UUID    REFERENCES temas(id) ON DELETE SET NULL;

-- 4. Migración: crear un tema por cada nombre único en contenidos y vincularlos
WITH inserted AS (
  INSERT INTO temas (nombre, origen)
  SELECT DISTINCT nombre, 'medios'
  FROM   contenidos
  WHERE  nombre IS NOT NULL AND nombre <> ''
  RETURNING id, nombre
)
UPDATE contenidos c
SET    tema_id = i.id
FROM   inserted i
WHERE  c.nombre = i.nombre;

-- 5. Trigger para auto-actualizar updated_at en temas
CREATE OR REPLACE FUNCTION update_temas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS temas_updated_at_trigger ON temas;
CREATE TRIGGER temas_updated_at_trigger
  BEFORE UPDATE ON temas
  FOR EACH ROW EXECUTE FUNCTION update_temas_updated_at();
