-- migrate-cell-no-to-empty.sql
-- Migrar todas las celdas con valor 'no' a vacío en contenidos.medios (JSONB)
-- Cubre formato legacy (string) y nuevo (objeto {valor, notas})
-- EJECUTAR EN SUPABASE SQL EDITOR ANTES DEL DEPLOY

UPDATE contenidos
SET medios = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN jsonb_typeof(value) = 'string' AND lower(value::text) IN ('"no"', '"no/"') THEN 'null'::jsonb
      WHEN jsonb_typeof(value) = 'string' AND lower(value::text) LIKE '"no/%' THEN 'null'::jsonb
      WHEN jsonb_typeof(value) = 'object' AND lower(value->>'valor') = 'no' THEN 'null'::jsonb
      ELSE value
    END
  )
  FROM jsonb_each(medios)
)
WHERE medios IS NOT NULL
  AND (
    medios::text LIKE '%"no"%'
    OR medios::text LIKE '%"no/%'
    OR medios::text LIKE '%"valor":"no"%'
    OR medios::text LIKE '%"valor": "no"%'
  );

-- Verificar resultado con:
-- SELECT id, medios FROM contenidos
-- WHERE medios::text ILIKE '%"no"%'
--   AND medios::text NOT ILIKE '%"notas"%';
