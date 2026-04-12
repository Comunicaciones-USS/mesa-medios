-- Migrar valores antiguos a los nuevos
UPDATE mesa_editorial_acciones SET tipo_accion = 'Backlog'
  WHERE tipo_accion IN ('Interna', 'Interno y Externo', 'Interna-Externa');

UPDATE mesa_editorial_acciones SET tipo_accion = 'Resultado'
  WHERE tipo_accion IN ('Externo', 'Externa-Interno');

-- Verificar que no queden valores viejos
SELECT DISTINCT tipo_accion FROM mesa_editorial_acciones;
