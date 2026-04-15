UPDATE contenidos
SET medios = medios || jsonb_build_object('instagram', medios->>'rrss')
WHERE medios ? 'rrss' AND NOT medios ? 'instagram';
