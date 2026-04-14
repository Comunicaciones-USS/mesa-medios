import { useState, useEffect } from 'react'
import { supabase } from './apps/shared/utils/supabase'
import Login from './apps/shared/components/Login'
import USSLoader from './apps/shared/components/USSLoader'
import MesaMediosApp from './apps/mesa-medios/MesaMediosApp'
import MesaEditorialApp from './apps/mesa-editorial/MesaEditorialApp'
import DashboardSelector from './apps/shared/DashboardSelector'


export default function App() {
  const [session,           setSession]           = useState(null)
  const [loading,           setLoading]           = useState(true)
  const [authorized,        setAuthorized]        = useState(null)
  const [userName,          setUserName]          = useState('')
  const [selectedDashboard, setSelectedDashboard] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkAuthorized(session.user.email)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkAuthorized(session.user.email)
      else { setAuthorized(null); setLoading(false); setSelectedDashboard(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function checkAuthorized(email) {
    const [data] = await Promise.all([
      supabase
        .from('usuarios_autorizados').select('email, nombre')
        .eq('email', email.toLowerCase()).eq('activo', true).single()
        .then(res => res.data),
      new Promise(resolve => setTimeout(resolve, 400))
    ])
    if (data) {
      setAuthorized(true)
      setUserName(data.nombre || email)
      await supabase.from('audit_logs').insert([{
        mesa_type:  null,
        user_email: email.toLowerCase(),
        action:     'login',
        table_name: null,
        record_id:  null,
        details:    JSON.stringify({ description: 'Inició sesión' }),
      }])
      const last = localStorage.getItem('uss_last_dashboard')
      if (last) setSelectedDashboard(last)
    } else {
      setAuthorized(false)
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setAuthorized(null)
    setUserName('')
    setSelectedDashboard(null)
  }

  function handleSelectDashboard(dashboard) {
    setSelectedDashboard(dashboard)
    localStorage.setItem('uss_last_dashboard', dashboard)
  }

  function handleBackToSelector() {
    setSelectedDashboard(null)
  }

  if (loading) return (
    <div className="fullscreen-center">
      <USSLoader />
      <span>Cargando...</span>
    </div>
  )

  if (!session) return <Login />

  if (authorized === null) return (
    <div className="fullscreen-center">
      <USSLoader />
      <span>Verificando acceso...</span>
    </div>
  )

  if (authorized === false) return (
    <div className="fullscreen-center">
      <div className="not-authorized">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#9C0006" strokeWidth="2" fill="#FFC7CE" />
          <path d="M24 14v12M24 32v2" stroke="#9C0006" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h2>Acceso denegado</h2>
        <p>Tu correo <strong>{session.user.email}</strong> no está en la lista de usuarios autorizados.</p>
        <button className="btn-add" onClick={handleLogout}>Volver</button>
      </div>
    </div>
  )

  if (!selectedDashboard) return (
    <DashboardSelector
      userName={userName}
      userEmail={session.user.email}
      onSelect={handleSelectDashboard}
      onLogout={handleLogout}
    />
  )

  if (selectedDashboard === 'medios') return (
    <MesaMediosApp
      session={session}
      userName={userName}
      onLogout={handleLogout}
      onBackToSelector={handleBackToSelector}
    />
  )

  if (selectedDashboard === 'editorial') return (
    <MesaEditorialApp
      session={session}
      userName={userName}
      onLogout={handleLogout}
      onBackToSelector={handleBackToSelector}
    />
  )

  return null
}
