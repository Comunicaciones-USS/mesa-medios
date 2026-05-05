-- Migración: Jerarquía Tema padre → Subtemas en Mesa de Medios
-- Aditiva: columnas nullable, no afecta temas existentes (que quedan como padres sin subtemas).

ALTER TABLE temas
  ADD COLUMN IF NOT EXISTS parent_id     UUID REFERENCES temas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fecha_inicio  DATE,
  ADD COLUMN IF NOT EXISTS fecha_termino DATE;

-- Índice para queries de subtemas por padre
CREATE INDEX IF NOT EXISTS idx_temas_parent_id ON temas(parent_id);

-- Comentarios para clarificar semántica
COMMENT ON COLUMN temas.parent_id IS 'NULL = tema padre (campaña). NOT NULL = subtema (sub-campaña).';
COMMENT ON COLUMN temas.fecha_inicio IS 'Solo aplica a subtemas. NULL en padres.';
COMMENT ON COLUMN temas.fecha_termino IS 'Solo aplica a subtemas. NULL en padres.';
