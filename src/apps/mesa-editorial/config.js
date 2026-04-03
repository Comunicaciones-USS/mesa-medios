export const EJES = [
  { id: 'discusion',     label: 'Discusión País',          color: '#2A5BA8' },
  { id: 'orgullo',       label: 'Orgullo USS',              color: '#C8102E' },
  { id: 'salud',         label: 'Salud',                    color: '#1D7A4F' },
  { id: 'investigacion', label: 'Investigación',            color: '#7A2AB8' },
  { id: 'vinculacion',   label: 'Vinculación con el Medio', color: '#B06A00' },
]

export const EJE_LABELS = EJES.map(e => e.label)

export const EJE_COLOR_MAP = Object.fromEntries(EJES.map(e => [e.label, e.color]))

export const TIPOS_CONFIG = {
  'Ancla':   { color: '#C8102E', bg: '#FEE2E2', label: 'Ancla' },
  'AO':      { color: '#2A5BA8', bg: '#DBEAFE', label: 'AO' },
  'Soporte': { color: '#7A2AB8', bg: '#EDE9FE', label: 'Soporte' },
}

export const STATUS_CONFIG = {
  'Completado':    { dot: '#16A34A', text: '#166534', bg: '#DCFCE7' },
  'En desarrollo': { dot: '#D97706', text: '#92400E', bg: '#FEF3C7' },
  'Pendiente':     { dot: '#DC2626', text: '#991B1B', bg: '#FEE2E2' },
}

export const STATUS_OPTIONS = ['Pendiente', 'En desarrollo', 'Completado']

export const TIPO_ACCION_OPTIONS = [
  'Interna', 'Externo', 'Interno y Externo', 'Interna-Externa', 'Externa-Interno',
]
