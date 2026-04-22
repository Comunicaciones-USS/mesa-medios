-- ═══════════════════════════════════════════════════════════════════
-- security-rpc-cleanup.sql
--
-- ⚠️  NO EJECUTAR HASTA VERIFICAR QUE EL LOGIN FUNCIONA EN PRODUCCIÓN.
--
-- Ejecutar SOLO después de loguearte exitosamente al menos una vez
-- con el código nuevo desplegado (ver POST-DEPLOY.md → Paso 1).
--
-- Qué hace: elimina la policy que permite a anon leer pin_hash
-- directamente desde la tabla usuarios_autorizados.
-- Con las RPCs SECURITY DEFINER ya en producción, esta policy
-- ya no es necesaria y es un riesgo de seguridad.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY "anon_can_read_active_users" ON usuarios_autorizados;
