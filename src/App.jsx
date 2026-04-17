import { useState, useEffect } from 'react'
import Login from './apps/shared/components/Login'
import USSLoader from './apps/shared/components/USSLoader'
import MesaMediosApp from './apps/mesa-medios/MesaMediosApp'
import MesaEditorialApp from './apps/mesa-editorial/MesaEditorialApp'
import DashboardSelector from './apps/shared/DashboardSelector'

const SESSION_KEY = 'uss_local_session'

export default function App() {
  const [localSession,      setLocalSession]      = useState(null) // { email, nombre }
  const [loading,           setLoading]           = useState(true)
  const [selectedDashboard, setSelectedDashboard] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed?.email) {
          setLocalSession(parsed)
          const last = localStorage.getItem('uss_last_dashboard')
          if (last) setSelectedDashboard(last)
        }
      } catch {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    setLoading(false)
  }, [])

  function handleLogin(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setLocalSession(session)
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setLocalSession(null)
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

  if (!localSession) return <Login onLogin={handleLogin} />

  // Objeto compatible con session.user.email que usan MesaMediosApp y MesaEditorialApp
  const sessionCompat = { user: { email: localSession.email } }

  if (!selectedDashboard) return (
    <DashboardSelector
      userName={localSession.nombre}
      userEmail={localSession.email}
      onSelect={handleSelectDashboard}
      onLogout={handleLogout}
    />
  )

  if (selectedDashboard === 'medios') return (
    <MesaMediosApp
      session={sessionCompat}
      userName={localSession.nombre}
      onLogout={handleLogout}
      onBackToSelector={handleBackToSelector}
      onSwitchDashboard={() => handleSelectDashboard('editorial')}
      otherDashboardName="Mesa Editorial"
    />
  )

  if (selectedDashboard === 'editorial') return (
    <MesaEditorialApp
      session={sessionCompat}
      userName={localSession.nombre}
      onLogout={handleLogout}
      onBackToSelector={handleBackToSelector}
      onSwitchDashboard={() => handleSelectDashboard('medios')}
      otherDashboardName="Mesa de Medios"
    />
  )

  return null
}
