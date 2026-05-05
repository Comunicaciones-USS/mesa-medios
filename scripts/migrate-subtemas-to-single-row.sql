-- ============================================================
-- MIGRACIÓN: Consolidar subtemas a 1 fila por subtema
-- ============================================================
-- PROPÓSITO: El nuevo modelo exige exactamente 1 contenido por
-- subtema (en vez de N). Esta migración limpia la BD existente
-- para coincidir con el nuevo comportamiento del front-end.
--
-- ⚠️  EJECUTAR MANUALMENTE en el panel SQL de Supabase
--     ANTES del deploy del branch feat/subtema-single-row-refactor
--
-- PASOS:
--  1. Para cada subtema con >1 contenido, conserva el más reciente
--     (o el que tenga más campos medios no-vacíos) y elimina los demás.
--  2. Para cada subtema con 0 contenidos, crea 1 fila vacía.
-- ============================================================

-- ─── PASO 1: eliminar duplicados ────────────────────────────────
-- Para cada subtema que tenga >1 contenido, conservar solo el que
-- tenga la semana más alta (más reciente); en caso de empate, el
-- de mayor id. Eliminar todos los demás.
DO $$
DECLARE
  sub RECORD;
  keep_id UUID;
BEGIN
  FOR sub IN
    SELECT tema_id
    FROM contenidos
    WHERE tema_id IN (SELECT id FROM temas WHERE parent_id IS NOT NULL)
    GROUP BY tema_id
    HAVING COUNT(*) > 1
  LOOP
    -- Elegir el contenido a conservar: primero por semana DESC, luego por id DESC
    SELECT id INTO keep_id
    FROM contenidos
    WHERE tema_id = sub.tema_id
    ORDER BY semana DESC NULLS LAST, id DESC
    LIMIT 1;

    -- Eliminar todos los demás
    DELETE FROM contenidos
    WHERE tema_id = sub.tema_id
      AND id <> keep_id;
  END LOOP;
END $$;

-- ─── PASO 2: crear contenidos para subtemas sin ninguno ──────────
-- Subtemas que no tienen ningún contenido (porque fueron creados
-- con el front-end anterior que no insertaba automáticamente).
-- Se crea 1 fila con medios vacíos y semana = fecha_inicio del subtema.
INSERT INTO contenidos (tema_id, semana, medios, nombre)
SELECT
  t.id,
  t.fecha_inicio,       -- puede ser NULL; el usuario puede editarla después
  '{}'::jsonb,
  t.nombre
FROM temas t
WHERE t.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contenidos c WHERE c.tema_id = t.id
  );

-- ─── VERIFICACIÓN (ejecutar después para confirmar) ─────────────
-- SELECT t.id, t.nombre, COUNT(c.id) as n_contenidos
-- FROM temas t
-- LEFT JOIN contenidos c ON c.tema_id = t.id
-- WHERE t.parent_id IS NOT NULL
-- GROUP BY t.id, t.nombre
-- ORDER BY n_contenidos DESC;
