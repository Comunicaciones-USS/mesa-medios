import XLSX from 'xlsx-js-style'
import { EJES } from '../../mesa-editorial/config'

const C = {
  WHITE:     'FFFFFF',
  BODY_TEXT: '1F2937',
  GRAY_TEXT: '374151',
  GRAY_HDR:  'F5F5F5',
  ALT_ROW:   'FAFAFA',
  BORDER:    'E5E7EB',
  SUBTITLE:  '6B7280',
  META:      '9CA3AF',
  NAVY:      '0F2B41',
}

const STATUS_STYLE = {
  'Completado':    { bg: 'DCFCE7', fg: '166534' },
  'En desarrollo': { bg: 'FEF3C7', fg: '92400E' },
  'Pendiente':     { bg: 'FEE2E2', fg: '991B1B' },
}

function hexRgb(color) {
  return color.replace('#', '').toUpperCase()
}

function fmtDate(d) {
  if (!d) return ''
  const parts = d.split('-')
  if (parts.length < 3) return d
  const [y, m, day] = parts
  return `${day}-${m}-${y}`
}

function makeCell(value, style = {}) {
  return { v: value ?? '', t: 's', s: style }
}

function bodyStyle(bgRgb, fgRgb) {
  return {
    font:      { name: 'Montserrat', sz: 10, color: { rgb: fgRgb } },
    fill:      { patternType: 'solid', fgColor: { rgb: bgRgb } },
    alignment: { vertical: 'center', wrapText: false },
  }
}

export function generateEditorialExcel({ rows, selectedIds, userName }) {
  const NCOLS = 7 // TIPO, TEMA, RESULTADO, TIPOLOGÍA, FECHA, RESPONSABLE, STATUS
  const wb    = XLSX.utils.book_new()
  const ws    = {}
  const merges = []

  const today   = new Date()
  const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`
  const n       = selectedIds.size

  let row = 0

  // Row 0: empty spacer
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell('')
  row++

  // Row 1: main title
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(
    'PLAN EDITORIAL — UNIVERSIDAD SAN SEBASTIÁN',
    { font: { name: 'Montserrat', sz: 16, bold: true, color: { rgb: C.NAVY } } }
  )
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
  row++

  // Row 2: subtitle
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(
    'Mesa Editorial — Reporte ejecutivo',
    { font: { name: 'Montserrat', sz: 11, color: { rgb: C.SUBTITLE } } }
  )
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
  row++

  // Row 3: meta
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(
    `Generado el ${dateStr} · Por: ${userName ?? '—'} · ${n} acción${n !== 1 ? 'es' : ''} incluida${n !== 1 ? 's' : ''}`,
    { font: { name: 'Montserrat', sz: 9, color: { rgb: C.META } } }
  )
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
  row++

  // Row 4: empty separator
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell('')
  row++

  // Build eje→rows map respecting EJES order
  const selectedRows = rows.filter(r => !r.archived && selectedIds.has(r.id))
  const byEje = new Map()
  EJES.forEach(eje => byEje.set(eje.label, []))
  selectedRows.forEach(r => {
    if (byEje.has(r.eje)) byEje.get(r.eje).push(r)
  })

  const colHeaders = ['TIPO', 'TEMA', 'RESULTADO', 'TIPOLOGÍA', 'FECHA', 'RESPONSABLE', 'STATUS']

  for (const eje of EJES) {
    const ejeRows = byEje.get(eje.label) || []
    if (ejeRows.length === 0) continue

    const ejeRgb = hexRgb(eje.color)

    // Eje subheader (eje color, white bold, merged)
    const subStyle = {
      font:      { name: 'Montserrat', sz: 12, bold: true, color: { rgb: C.WHITE } },
      fill:      { patternType: 'solid', fgColor: { rgb: ejeRgb } },
      alignment: { vertical: 'center' },
    }
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(eje.label.toUpperCase(), subStyle)
    for (let c = 1; c < NCOLS; c++) {
      ws[XLSX.utils.encode_cell({ r: row, c })] = makeCell('', {
        fill: { patternType: 'solid', fgColor: { rgb: ejeRgb } }
      })
    }
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
    row++

    // Column headers (gray, bold)
    const colHdrStyle = {
      font:      { name: 'Montserrat', sz: 10, bold: true, color: { rgb: C.GRAY_TEXT } },
      fill:      { patternType: 'solid', fgColor: { rgb: C.GRAY_HDR } },
      border:    { bottom: { style: 'thin', color: { rgb: C.BORDER } } },
      alignment: { vertical: 'center' },
    }
    colHeaders.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: row, c })] = makeCell(h, colHdrStyle)
    })
    row++

    // Data rows, sorted by fecha ascending
    const sorted = [...ejeRows].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

    sorted.forEach((r2, idx) => {
      const alt    = idx % 2 === 1
      const base   = alt ? C.ALT_ROW : C.WHITE
      const st     = STATUS_STYLE[r2.status] || { bg: base, fg: C.BODY_TEXT }

      ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(r2.tipo        || '', bodyStyle(base, C.BODY_TEXT))
      ws[XLSX.utils.encode_cell({ r: row, c: 1 })] = makeCell(r2.tema        || '', bodyStyle(base, C.BODY_TEXT))
      ws[XLSX.utils.encode_cell({ r: row, c: 2 })] = makeCell(r2.accion      || '', bodyStyle(base, C.BODY_TEXT))
      ws[XLSX.utils.encode_cell({ r: row, c: 3 })] = makeCell(r2.tipologia   || '', bodyStyle(base, C.BODY_TEXT))
      ws[XLSX.utils.encode_cell({ r: row, c: 4 })] = makeCell(fmtDate(r2.fecha),   bodyStyle(base, C.BODY_TEXT))
      ws[XLSX.utils.encode_cell({ r: row, c: 5 })] = makeCell(r2.responsable || '', bodyStyle(base, C.BODY_TEXT))
      ws[XLSX.utils.encode_cell({ r: row, c: 6 })] = makeCell(r2.status      || '', bodyStyle(st.bg, st.fg))

      row++
    })

    // Separator between eje blocks
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell('')
    row++
  }

  // Sheet metadata
  ws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: NCOLS - 1 } })
  ws['!cols'] = [
    { wch: 14 }, // TIPO
    { wch: 32 }, // TEMA
    { wch: 42 }, // RESULTADO
    { wch: 22 }, // TIPOLOGÍA
    { wch: 14 }, // FECHA
    { wch: 20 }, // RESPONSABLE
    { wch: 16 }, // STATUS
  ]
  ws['!merges'] = merges
  ws['!rows'] = []
  ws['!rows'][0] = { hpx: 10 }
  ws['!rows'][1] = { hpx: 28 }
  ws['!rows'][4] = { hpx: 10 }

  ws['!sheetViews'] = [{
    state:        'frozen',
    ySplit:       5,
    topLeftCell:  'A6',
    showGridLines: false,
  }]

  XLSX.utils.book_append_sheet(wb, ws, 'Mesa Editorial')

  const fname = `Mesa-Editorial-USS-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}.xlsx`
  XLSX.writeFile(wb, fname)
}
