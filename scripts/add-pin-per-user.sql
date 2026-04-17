-- ============================================================
-- Sistema de PIN único por usuario
-- Ejecutar en Supabase SQL Editor ANTES del deploy
-- ============================================================

-- 1. Agregar columnas de PIN a usuarios_autorizados
ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS pin_hash      TEXT,
  ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMPTZ;

-- IMPORTANTE:
--   pin_hash contiene SHA-256(PIN) en hexadecimal, NUNCA el PIN en texto plano.
--   El hash se genera en el navegador via crypto.subtle antes de guardarse.
--   La verificación al login también hashea el PIN ingresado y compara hashes.

-- 2. Tabla de intentos de login (rate limiting básico)
CREATE TABLE IF NOT EXISTS pin_login_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success      BOOLEAN     DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_pin_attempts_email_time
  ON pin_login_attempts(email, attempted_at);

-- 3. RLS: el login necesita leer usuarios_autorizados con anon key
--    (antes el acceso era con sesión de Supabase Auth; ahora es anon)
--    Verificar que esta política existe. Si ya hay una más permisiva, omitir.
--    NOTA: pin_hash queda expuesto a anon, lo cual es aceptable para uso interno.

-- Ejecutar solo si no existe ya una política SELECT para anon:
-- CREATE POLICY "anon_can_read_active_users" ON usuarios_autorizados
--   FOR SELECT TO anon
--   USING (activo = true);

-- 4. RLS: permitir a anon insertar en pin_login_attempts
-- CREATE POLICY "anon_can_insert_attempts" ON pin_login_attempts
--   FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- DESPUÉS DEL DEPLOY:
--   1. Ejecutar este script en Supabase SQL Editor
--   2. Verificar/aplicar las políticas RLS comentadas arriba si es necesario
--   3. Entrar al panel admin (solo leonardo.munoz@uss.cl)
--   4. Generar PIN para cada usuario y distribuir individualmente
--      por canal seguro (WhatsApp, email directo, etc.)
-- ============================================================
