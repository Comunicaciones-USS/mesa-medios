import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const COOLDOWN_SECONDS = 60

export default function Login() {
  const [email,     setEmail]     = useState('')
  const [sent,      setSent]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [cooldown,  setCooldown]  = useState(0)
  const [mode,      setMode]      = useState('magic') // 'magic' | 'pin'
  const [pin,       setPin]       = useState('')

  // ── Cooldown timer ──────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // ── Recover cooldown from sessionStorage on mount ───────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('mm_cooldown_until')
    if (saved) {
      const remaining = Math.round((parseInt(saved) - Date.now()) / 1000)
      if (remaining > 0) setCooldown(remaining)
    }
  }, [])

  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS)
    sessionStorage.setItem('mm_cooldown_until', String(Date.now() + COOLDOWN_SECONDS * 1000))
  }, [])

  // ── Magic link submit ───────────────────────────────────────────
  async function handleMagicLink(e) {
    e.preventDefault()
    setError('')

    if (!email.toLowerCase().endsWith('@uss.cl')) {
      setError('Solo se permiten correos institucionales @uss.cl')
      return
    }

    if (cooldown > 0) {
      setError(`Espera ${cooldown}s antes de solicitar otro link`)
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: 'https://comunicaciones-uss.github.io/mesa-medios/',
        shouldCreateUser: true,
      },
    })
    setLoading(false)

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('rate') || msg.includes('limit') || msg.includes('exceeded') || msg.includes('too many')) {
        setError('Se alcanzó el límite de envíos. Usa el acceso con PIN o intenta más tarde.')
        startCooldown()
      } else {
        setError('Error al enviar el link: ' + error.message)
      }
    } else {
      setSent(true)
      startCooldown()
    }
  }

  // ── PIN submit ──────────────────────────────────────────────────
  async function handlePinLogin(e) {
    e.preventDefault()
    setError('')

    if (!email.toLowerCase().endsWith('@uss.cl')) {
      setError('Solo se permiten correos institucionales @uss.cl')
      return
    }

    if (!pin.trim()) {
      setError('Ingresa el PIN de acceso')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: pin.trim(),
    })
    setLoading(false)

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('invalid') || msg.includes('credentials')) {
        setError('PIN incorrecto o correo no registrado')
      } else {
        setError('Error de acceso: ' + error.message)
      }
    }
  }

  // ── Render: success state ──────────────────────────────────────
  if (sent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <LoginHeader />
          <div className="login-body login-sent">
            <div className="sent-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="#c6efce" stroke="#82c985" strokeWidth="1.5" />
                <path d="M14 24l7 7 13-13" stroke="#276221" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>¡Revisa tu correo!</h3>
            <p>
              Enviamos un link de acceso a <strong>{email}</strong>.
              Haz clic en el link para ingresar al dashboard.
            </p>
            <p className="sent-hint">El link expira en 1 hora. Si no llega, revisa la carpeta de spam.</p>
            {cooldown > 0 && (
              <p className="cooldown-text">Puedes reenviar en {cooldown}s</p>
            )}
            <div className="sent-actions">
              <button
                className="btn-secondary"
                onClick={() => setSent(false)}
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar link'}
              </button>
              <button
                className="btn-text"
                onClick={() => { setSent(false); setMode('pin') }}
              >
                Usar PIN en su lugar
              </button>
            </div>
          </div>
        </div>
        <PageFooter />
      </div>
    )
  }

  // ── Render: login form ─────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="login-card">
        <LoginHeader />

        <div className="login-body">
          <p className="login-desc">
            {mode === 'magic'
              ? 'Ingresa tu correo institucional USS para recibir un link de acceso seguro. No necesitas contraseña.'
              : 'Ingresa tu correo institucional USS y el PIN de acceso proporcionado por el administrador.'
            }
          </p>

          <div className="login-mode-toggle">
            <button
              className={`mode-btn ${mode === 'magic' ? 'mode-active' : ''}`}
              onClick={() => { setMode('magic'); setError('') }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1.5 4l5.5 3.5L12.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Magic Link
            </button>
            <button
              className={`mode-btn ${mode === 'pin' ? 'mode-active' : ''}`}
              onClick={() => { setMode('pin'); setError('') }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="3" y="6" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 6V4.5a2 2 0 014 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              PIN de acceso
            </button>
          </div>

          <form onSubmit={mode === 'magic' ? handleMagicLink : handlePinLogin}>
            <div className="form-group">
              <label htmlFor="email">Correo institucional USS</label>
              <input
                id="email"
                type="email"
                placeholder="nombre@uss.cl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {mode === 'pin' && (
              <div className="form-group">
                <label htmlFor="pin">PIN de acceso</label>
                <input
                  id="pin"
                  type="password"
                  placeholder="Ingresa el PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            )}

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              className="btn-primary login-btn"
              disabled={loading || !email || (mode === 'magic' && cooldown > 0)}
            >
              {loading
                ? 'Verificando...'
                : mode === 'magic'
                  ? cooldown > 0
                    ? `Espera ${cooldown}s`
                    : 'Enviar link de acceso'
                  : 'Ingresar con PIN'
              }
            </button>
          </form>
        </div>

        <div className="login-footer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#5a7a96" strokeWidth="1.2" />
            <path d="M7 6v4M7 4.5v.5" stroke="#5a7a96" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Solo usuarios autorizados pueden acceder
        </div>
      </div>
      <PageFooter />
    </div>
  )
}

function LoginHeader() {
  return (
    <div className="login-header">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#ceb37c" />
        <rect x="8" y="11" width="24" height="3" rx="1.5" fill="#0f2b41" />
        <rect x="8" y="18.5" width="17" height="3" rx="1.5" fill="#0f2b41" />
        <rect x="8" y="26" width="20" height="3" rx="1.5" fill="#0f2b41" />
      </svg>
      <div>
        <h1>Sistema USS</h1>
        <p>Gestión de comunicaciones</p>
      </div>
    </div>
  )
}

function PageFooter() {
  return (
    <footer className="login-page-footer">
      <div className="footer-inner">
        {/* ── Left: Logo ── */}
        <div className="footer-col footer-logo-col">
          <img
            src="/mesa-medios/escudo-uss-horizontal-blanco.svg"
            alt="Universidad San Sebastián"
            className="footer-uss-logo"
          />
        </div>

        {/* ── Center: Redes sociales ── */}
        <div className="footer-col footer-social-col">
          <span className="footer-label">Síguenos</span>
          <div className="footer-social-links">
            <a href="https://www.instagram.com/usansebastian/" target="_blank" rel="noopener noreferrer" title="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href="https://www.facebook.com/ComunidadUSS/" target="_blank" rel="noopener noreferrer" title="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            </a>
            <a href="https://x.com/USanSebastian" target="_blank" rel="noopener noreferrer" title="X (Twitter)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://cl.linkedin.com/school/universidad-san-sebastian/" target="_blank" rel="noopener noreferrer" title="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a href="https://www.youtube.com/@usansebastian" target="_blank" rel="noopener noreferrer" title="YouTube">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.43z" />
                <polygon points="9.75,15.02 15.5,11.75 9.75,8.48" fill="currentColor" stroke="none" />
              </svg>
            </a>
          </div>
        </div>

        {/* ── Right: Sitios de interés ── */}
        <div className="footer-col footer-links-col">
          <span className="footer-label">Sitios de interés</span>
          <a href="https://www.uss.cl" target="_blank" rel="noopener noreferrer">USS.CL</a>
          <a href="https://www.uss.cl/actualidad-uss/" target="_blank" rel="noopener noreferrer">Noticias USS</a>
          <a href="https://www.uss.cl/admision/" target="_blank" rel="noopener noreferrer">Admisión</a>
        </div>
      </div>

      <div className="footer-copyright">
        © {new Date().getFullYear()} Universidad San Sebastián — Dirección General de Comunicaciones
      </div>
    </footer>
  )
}
