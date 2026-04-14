-- Migrar "AO" a "Always ON" en la tabla
UPDATE mesa_editorial_acciones SET tipo = 'Always ON' WHERE tipo = 'AO';
-- Verificar
SELECT DISTINCT tipo FROM mesa_editorial_acciones;
