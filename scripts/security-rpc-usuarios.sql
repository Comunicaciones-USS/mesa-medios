-- ═══════════════════════════════════════════════════════════════════
-- security-rpc-usuarios.sql
-- Funciones RPC SECURITY DEFINER para autenticación y admin de PINs
--
-- INSTRUCCIONES:
-- 1. Copiar todo este archivo
-- 2. Pegarlo en el SQL Editor de Supabase
-- 3. Ejecutar (botón "Run")
-- 4. Verificar que aparecen 3 funciones en Database > Functions:
--    - validate_pin
--    - admin_list_users
--    - admin_set_pin
-- 5. Recién después hacer el git push && npm run deploy
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. validate_pin
--    Compara hash server-side. El cliente NUNCA recibe pin_hash.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_pin(p_email TEXT, p_pin_hash TEXT)
RETURNS TABLE(valid BOOLEAN, email TEXT, nombre TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT ua.email, ua.nombre, ua.pin_hash
  INTO v_user
  FROM usuarios_autorizados ua
  WHERE ua.email = p_email AND ua.activo = TRUE;

  IF NOT FOUND OR v_user.pin_hash IS NULL OR v_user.pin_hash != p_pin_hash THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_user.email, v_user.nombre;
END;
$$;

REVOKE ALL ON FUNCTION validate_pin(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_pin(TEXT, TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 2. admin_list_users
--    Lista usuarios con has_pin (boolean). Nunca expone pin_hash.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE(email TEXT, nombre TEXT, has_pin BOOLEAN, activo BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ua.email,
    ua.nombre,
    (ua.pin_hash IS NOT NULL) AS has_pin,
    ua.activo
  FROM usuarios_autorizados ua
  ORDER BY ua.nombre;
END;
$$;

REVOKE ALL ON FUNCTION admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_users() TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 3. admin_set_pin
--    Actualiza pin_hash de un usuario.
--    Solo el admin (leonardo.munoz@uss.cl) puede invocarlo.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_pin(
  p_admin_email  TEXT,
  p_target_email TEXT,
  p_new_hash     TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_admin_email != 'leonardo.munoz@uss.cl' THEN
    RETURN FALSE;
  END IF;

  UPDATE usuarios_autorizados
  SET pin_hash        = p_new_hash,
      pin_updated_at  = NOW()
  WHERE email = p_target_email;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_pin(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_pin(TEXT, TEXT, TEXT) TO anon, authenticated;
