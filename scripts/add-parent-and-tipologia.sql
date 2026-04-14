-- 1. Agregar campo parent_id para la jerarquía Resultado → Backlog
ALTER TABLE mesa_editorial_acciones
  ADD COLUMN IF NOT EXISTS parent_id UUID DEFAULT NULL
  REFERENCES mesa_editorial_acciones(id) ON DELETE SET NULL;

-- 2. Agregar campo tipologia_resultado para categorizar los Resultados
ALTER TABLE mesa_editorial_acciones
  ADD COLUMN IF NOT EXISTS tipologia_resultado TEXT DEFAULT NULL;

-- 3. Índice para queries por parent_id
CREATE INDEX IF NOT EXISTS idx_editorial_parent_id
  ON mesa_editorial_acciones(parent_id);
