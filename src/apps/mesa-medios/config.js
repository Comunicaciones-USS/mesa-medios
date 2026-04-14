export const MEDIA_COLS = [
  // ── MEDIOS PROPIOS ───────────────────────────────────────────────
  { id: 'sitio_web',          label: 'Sitio Web',           sub: '',               group: 'PROPIOS' },
  { id: 'mailing',            label: 'Mailings',            sub: '',               group: 'PROPIOS' },
  { id: 'rrss',               label: 'Redes Sociales',      sub: '',               group: 'PROPIOS' },
  { id: 'youtube',            label: 'YouTube',             sub: '',               group: 'PROPIOS' },
  { id: 'intranet',           label: 'Intranet',            sub: '',               group: 'PROPIOS' },
  { id: 'fondo_pantalla',     label: 'Fondo de Pantalla',   sub: '',               group: 'PROPIOS' },
  { id: 'pantallas',          label: 'Pantallas',           sub: '',               group: 'PROPIOS' },
  { id: 'whatsapp',           label: 'WhatsApp',            sub: '',               group: 'PROPIOS' },
  { id: 'firmas',             label: 'Firmas',              sub: '',               group: 'PROPIOS' },
  // ── MEDIOS PAGADOS ───────────────────────────────────────────────
  { id: 'lt_publirreportaje', label: 'LT / Educa',          sub: 'Publirreportaje', group: 'PAGADOS' },
  { id: 'lt_conversatorio',   label: 'LT / Educa',          sub: 'Conversatorio',   group: 'PAGADOS' },
  { id: 'lt_columna',         label: 'LT / Educa',          sub: 'Col. Opinión',    group: 'PAGADOS' },
  { id: 'lt_huinchas',        label: 'LT / Educa',          sub: 'Huinchas',        group: 'PAGADOS' },
  { id: 'lt_digital_papel',   label: 'LT / Publi',          sub: 'Digital / Papel', group: 'PAGADOS' },
  { id: 'duna',               label: 'Duna',                sub: 'Aire Fresco',     group: 'PAGADOS' },
  { id: 'dinamo_entrevista',  label: 'Dinamo',              sub: 'Entrevista',      group: 'PAGADOS' },
  { id: 'dinamo_columna',     label: 'Dinamo',              sub: 'Columna',         group: 'PAGADOS' },
  { id: 'infinita',           label: 'Infinita',            sub: 'Entrevista',      group: 'PAGADOS' },
  { id: 't13_entrevista1',    label: 'T13 Radio',           sub: 'Entrevista 1',    group: 'PAGADOS' },
  { id: 't13_entrevista2',    label: 'T13 Radio',           sub: 'Entrevista 2',    group: 'PAGADOS' },
  { id: 'conquistador',       label: 'El Conquistador',     sub: 'Chile Renace',    group: 'PAGADOS' },
  { id: 'agricultura',        label: 'Agricultura',         sub: 'Entrevista',      group: 'PAGADOS' },
  { id: 'biobio',             label: 'BioBioChile',         sub: 'Publinotas',      group: 'PAGADOS' },
  { id: 'emol',               label: 'El Mercurio / EMOL',  sub: 'Publinotas',      group: 'PAGADOS' },
  { id: 'santiago_adicto',    label: 'Santiago Adicto',     sub: '',               group: 'PAGADOS' },
  { id: 'club_cambio',        label: 'Club del Cambio',     sub: '',               group: 'PAGADOS' },
  { id: 'peras_finanzas',     label: 'Peras y Finanzas',    sub: '',               group: 'PAGADOS' },
  { id: 'shot',               label: 'Shot',                sub: '',               group: 'PAGADOS' },
  { id: 'radio',              label: 'Radio',               sub: '',               group: 'PAGADOS' },
  { id: 'tv',                 label: 'TV',                  sub: '',               group: 'PAGADOS' },
  { id: 'via_publica',        label: 'Vía Pública',         sub: '',               group: 'PAGADOS' },
  { id: 'avisos',             label: 'Avisos',              sub: '',               group: 'PAGADOS' },
]

export const N_PROPIOS = MEDIA_COLS.filter(c => c.group === 'PROPIOS').length
export const N_PAGADOS = MEDIA_COLS.filter(c => c.group === 'PAGADOS').length
