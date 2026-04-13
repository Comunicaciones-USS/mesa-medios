-- Agregar campo completed_at a mesa_editorial_acciones
ALTER TABLE mesa_editorial_acciones
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- Rellenar completed_at para las acciones que ya están completadas
-- (usa la fecha de updated_at o created_at como aproximación)
UPDATE mesa_editorial_acciones
  SET completed_at = COALESCE(updated_at, created_at)
  WHERE status = 'Completado' AND completed_at IS NULL;
