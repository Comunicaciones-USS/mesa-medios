import { useState, useEffect, useRef } from 'react'
import { EJES, TIPOS_CONFIG, TIPO_ACCION_OPTIONS, TIPOLOGIA_RESULTADO_OPTIONS } from '../config'

export default function AddActionModal({ onConfirm, onClose, existingResponsables = [], existingTemas = [], prefilled }) {
  const [eje,         setEje]         = useState(prefilled?.eje || EJES[0].label)
  const [tipo,        setTipo]        = useState('Ancla')
  const [tema,        setTema]        = useState(prefilled?.tema || '')
  const [accion,      setAccion]      = useState('')
  const [tipoAccion,         setTipoAccion]         = useState('Backlog')
  const [tipologiaResultado, setTipologiaResultado] = useState('')
  const [fecha,         setFecha]         = useState('')
  const [responsable,   setResponsable]   = useState('')
  const [syncToMedios,  setSyncToMedios]  = useState(false)
  const firstRef = useRef(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSubmit(e) {
    e.preventDefault()
    if (!accion.trim()) return
    onConfirm({
      eje,
      tipo,
      tema,
      accion: accion.trim(),
      tipo_accion: tipoAccion,
      tipologia_resultado: tipoAccion === 'Resultado' ? tipologiaResultado || null : null,
      fecha: fecha || null,
      responsable,
      status: 'Pendiente',
      sync_to_medios: syncToMedios,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>

        <div className="modal-header" style={{ background: '#0f2b41', color: '#fff' }}>
          <h2>Nueva acción editorial</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row-2">
              <div className="form-group">
                <label>Eje</label>
                <select value={eje} onChange={e => setEje(e.target.value)} ref={firstRef}>
                  {EJES.map(e => <option key={e.id} value={e.label}>{e.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Hito</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)}>
                  {Object.keys(TIPOS_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Tema</label>
              <input type="text" value={tema} onChange={e => setTema(e.target.value)} placeholder="Ej: Encuesta Chile, Informe Cescro..." list="tema-suggestions" />
              <datalist id="tema-suggestions">
                {existingTemas.map((t, i) => <option key={i} value={t} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Acción <span className="required">*</span></label>
              <input type="text" value={accion} onChange={e => setAccion(e.target.value)} placeholder="Resultado: sustantivo / Backlog: verbo" required />
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label>Tipo de acción</label>
                <select value={tipoAccion} onChange={e => setTipoAccion(e.target.value)}>
                  {TIPO_ACCION_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
            </div>
            {tipoAccion === 'Resultado' && (
              <div className="form-group">
                <label>Tipología de resultado</label>
                <select value={tipologiaResultado} onChange={e => setTipologiaResultado(e.target.value)}>
                  <option value="">Seleccionar tipología...</option>
                  {TIPOLOGIA_RESULTADO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Responsable</label>
              <input type="text" list="responsable-suggestions" value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Nombre del responsable" />
              <datalist id="responsable-suggestions">
                {existingResponsables.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
          </div>

          <div className="form-group sync-toggle-group">
            <label className="sync-toggle-label">
              <input
                type="checkbox"
                checked={syncToMedios}
                onChange={e => setSyncToMedios(e.target.checked)}
              />
              Planificar en Mesa de Medios
            </label>
            {syncToMedios && (
              <p className="sync-toggle-hint">Se creará un tema vinculado en la planificación de medios.</p>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!accion.trim()}>Agregar acción</button>
          </div>
        </form>

      </div>
    </div>
  )
}
