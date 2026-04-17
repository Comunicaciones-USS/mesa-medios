import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { sha256 } from '../utils/crypto'
import logoUSS from '../../../assets/escudo-uss-horizontal-blanco.svg'

// ── Rate limiting client-side (sessionStorage) ───────────────────
const BLOCK_THRESHOLD = 5
const BLOCK_WINDOW_MS = 10 * 60 * 1000 // 10 minutos

function getFailedAttempts(email) {
  const key = `pin_fail_${btoa(email).replace(/[+/=]/g, '')}`
  try {
    const data = JSON.parse(sessionStorage.getItem(key) || '[]')
    const cutoff = Date.now() - BLOCK_WINDOW_MS
    return data.filter(t => t > cutoff)
  } catch { return [] }
}

function recordFailedAttempt(email) {
  const key = `pin_fail_${btoa(email).replace(/[+/=]/g, '')}`
  const recent = getFailedAttempts(email)
  recent.push(Date.now())
  try { sessionStorage.setItem(key, JSON.stringify(recent)) } catch { /* ignore */ }
}

// ── Componente principal ─────────────────────────────────────────
export default function Login({ onLogin }) {
  const [email,   setEmail]   = useState('')
  const [pin,     setPin]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail.endsWith('@uss.cl')) {
      setError('Solo se permiten correos institucionales @uss.cl')
      return
    }
    if (!pin.trim()) {
      setError('Ingresa tu PIN de acceso')
      return
    }

    // Verificar rate limiting
    const recentFails = getFailedAttempts(normalizedEmail)
    if (recentFails.length >= BLOCK_THRESHOLD) {
      const blockedUntil = recentFails[0] + BLOCK_WINDOW_MS
      const remaining = Math.ceil((blockedUntil - Date.now()) / 60000)
      setError(`Demasiados intentos fallidos. Intenta nuevamente en ${remaining} minuto${remaining === 1 ? '' : 's'}.`)
      return
    }

    setLoading(true)

    // Consultar usuarios_autorizados
    const { data, error: dbErr } = await supabase
      .from('usuarios_autorizados')
      .select('email, nombre, pin_hash')
      .eq('email', normalizedEmail)
      .eq('activo', true)
      .single()

    if (dbErr || !data) {
      recordFailedAttempt(normalizedEmail)
      try { await supabase.from('pin_login_attempts').insert([{ email: normalizedEmail, success: false }]) } catch { /* ignore */ }
      setLoading(false)
      setError('Credenciales incorrectas')
      return
    }

    if (!data.pin_hash) {
      setLoading(false)
      setError('No tienes PIN configurado. Contacta al administrador.')
      return
    }

    // Hashear y comparar
    const enteredHash = await sha256(pin.trim())
    if (enteredHash !== data.pin_hash) {
      recordFailedAttempt(normalizedEmail)
      try { await supabase.from('pin_login_attempts').insert([{ email: normalizedEmail, success: false }]) } catch { /* ignore */ }
      setLoading(false)
      setError('Credenciales incorrectas')
      return
    }

    // Login exitoso
    try { await supabase.from('pin_login_attempts').insert([{ email: normalizedEmail, success: true }]) } catch { /* ignore */ }
    try {
      await supabase.from('audit_logs').insert([{
        mesa_type:  null,
        user_email: normalizedEmail,
        action:     'login',
        table_name: null,
        record_id:  null,
        details:    JSON.stringify({ description: 'Inició sesión con PIN' }),
      }])
    } catch { /* ignore */ }

    setLoading(false)
    onLogin({ email: normalizedEmail, nombre: data.nombre || normalizedEmail })
  }

  return (
    <div className="login-page">
      <div className="login-container">

        {/* ── Columna izquierda: formulario (60%) ── */}
        <div className="login-left">
          <div className="login-form-inner">
            <h1 className="login-title">Iniciar sesión</h1>
            <p className="login-subtitle">Ingresa tus credenciales para acceder</p>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="login-email" className="login-label">
                  Correo institucional
                </label>
                <input
                  id="login-email"
                  type="email"
                  className={`login-input${error ? ' login-input-error' : ''}`}
                  placeholder="nombre@uss.cl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  required
                  autoComplete="email"
                />
              </div>

              <div className="login-field">
                <label htmlFor="login-pin" className="login-label">
                  PIN de acceso
                </label>
                <input
                  id="login-pin"
                  type="password"
                  className={`login-input${error ? ' login-input-error' : ''}`}
                  placeholder="••••••"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && <p className="login-error-msg">{error}</p>}

              <button
                type="submit"
                className="login-submit"
                disabled={loading || !email || !pin}
              >
                {loading ? (
                  <>
                    <span className="login-btn-spinner" />
                    Verificando...
                  </>
                ) : 'Ingresar'}
              </button>
            </form>

            <p className="login-contact">
              ¿No tienes acceso? <strong>Contacta al administrador</strong>
            </p>
          </div>
        </div>

        {/* ── Columna derecha: imagen hero (40%) ── */}
        <div className="login-right">
          <div className="login-hero">
            {/* Logo USS oficial */}
            <img
              src={logoUSS}
              alt="Universidad San Sebastián"
              className="login-hero-logo"
            />

            {/* Overlay gradiente para legibilidad del texto */}
            <div className="login-overlay" />

            {/* Texto sobre la imagen */}
            <div className="login-hero-text">
              <p className="login-hero-headline">
                Planifica con <strong>propósito.</strong>
              </p>
              <p className="login-hero-sub">
                Sistema interno de gestión de contenidos del equipo de Comunicaciones USS.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
