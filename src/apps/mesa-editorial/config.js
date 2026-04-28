export const EJES = [
  { id: 'discusion',     label: 'Conversación País',          color: '#2A5BA8', responsable: 'Yaritza Ross' },
  { id: 'orgullo',       label: 'Orgullo USS',                color: '#C8102E', responsable: 'Natalie Traverso' },
  { id: 'salud',         label: 'Salud',                      color: '#1D7A4F', responsable: 'Esteban López' },
  { id: 'investigacion', label: 'Investigación y Tecnología', color: '#7A2AB8', responsable: 'Bárbara Ruiz' },
  { id: 'vinculacion',   label: 'Impacto Territorial',        color: '#B06A00', responsable: 'Sebastián Fuentes' },
]

export const EJE_COLOR_MAP = Object.fromEntries(EJES.map(e => [e.label, e.color]))

// Orden forzado: Ancla → Soporte → Always ON
export const TIPOS_CONFIG = {
  'Ancla':     { color: '#C8102E', bg: '#FEE2E2', label: 'Ancla',     order: 1 },
  'Soporte':   { color: '#7A2AB8', bg: '#EDE9FE', label: 'Soporte',   order: 2 },
  'Always ON': { color: '#2A5BA8', bg: '#DBEAFE', label: 'Always ON', order: 3 },
}

export const TIPOS_ORDER = ['Ancla', 'Soporte', 'Always ON']

export const STATUS_CONFIG = {
  'Completado':    { dot: '#16A34A', text: '#166534', bg: '#DCFCE7' },
  'En desarrollo': { dot: '#D97706', text: '#92400E', bg: '#FEF3C7' },
  'Pendiente':     { dot: '#DC2626', text: '#991B1B', bg: '#FEE2E2' },
}

export const STATUS_OPTIONS = ['Pendiente', 'En desarrollo', 'Completado']

export const TIPO_ACCION_OPTIONS = ['Backlog', 'Resultado']

export const TIPOLOGIA_RESULTADO_OPTIONS = [
  'Medios orgánicos',
  'Redes Sociales',
  'Medios Propios',
  'Alianzas',
  'Publicidad Pagada',
  'Eventos Institucionales',
  'Relacionamiento',
]
