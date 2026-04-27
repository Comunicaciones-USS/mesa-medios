import XLSX from 'xlsx-js-style'
import { MEDIA_COLS } from '../../mesa-medios/config'
import { getCellData } from '../../mesa-medios/utils'

const C = {
  NAVY:        '0F2B41',
  WHITE:       'FFFFFF',
  GRAY_HEADER: 'F5F5F5',
  GRAY_TEXT:   '374151',
  BODY_TEXT:   '1F2937',
  ALT_ROW:     'FAFAFA',
  GREEN_BG:    'D1FAE5',
  GREEN_FG:    '065F46',
  YELLOW_BG:   'FEF3C7',
  YELLOW_FG:   '92400E',
  BORDER:      'E5E7EB',
}

function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
}

function makeCell(value, style = {}) {
  return { v: value ?? '', t: 's', s: style }
}

function navyFill() {
  return makeCell('', { fill: { patternType: 'solid', fgColor: { rgb: C.NAVY } } })
}

function bodyStyle(bgRgb, fgRgb) {
  return {
    font:      { name: 'Montserrat', sz: 10, color: { rgb: fgRgb } },
    fill:      { patternType: 'solid', fgColor: { rgb: bgRgb } },
    alignment: { vertical: 'center', wrapText: false },
  }
}

export function generateMediosExcel({ temas, selectedIds, userName }) {
  const NCOLS = 4
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
    'PLAN DE COBERTURA — UNIVERSIDAD SAN SEBASTIÁN',
    { font: { name: 'Montserrat', sz: 16, bold: true, color: { rgb: C.NAVY } } }
  )
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
  row++

  // Row 2: subtitle
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(
    'Mesa de Medios — Reporte ejecutivo',
    { font: { name: 'Montserrat', sz: 11, color: { rgb: '6B7280' } } }
  )
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
  row++

  // Row 3: meta
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(
    `Generado el ${dateStr} · Por: ${userName} · ${n} tema${n !== 1 ? 's' : ''} incluido${n !== 1 ? 's' : ''}`,
    { font: { name: 'Montserrat', sz: 9, color: { rgb: '9CA3AF' } } }
  )
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
  row++

  // Row 4: empty separator
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell('')
  row++

  // Tema blocks start at row 5
  const selectedTemas = temas.filter(t => !t.archived && selectedIds.has(t.id))

  for (const tema of selectedTemas) {
    // Subheader: tema name (navy, white bold)
    const subheaderStyle = {
      font:      { name: 'Montserrat', sz: 12, bold: true, color: { rgb: C.WHITE } },
      fill:      { patternType: 'solid', fgColor: { rgb: C.NAVY } },
      alignment: { vertical: 'center' },
    }
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(
      (tema.nombre || '').toUpperCase(),
      subheaderStyle
    )
    for (let c = 1; c < NCOLS; c++) {
      ws[XLSX.utils.encode_cell({ r: row, c })] = navyFill()
    }
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NCOLS - 1 } })
    row++

    // Column headers (gray bg, dark bold text)
    const colHeaders = ['FECHA', 'CANAL', 'ACCIÓN / DESCRIPCIÓN', 'RESPONSABLE']
    const colHeaderStyle = {
      font:      { name: 'Montserrat', sz: 10, bold: true, color: { rgb: C.GRAY_TEXT } },
      fill:      { patternType: 'solid', fgColor: { rgb: C.GRAY_HEADER } },
      border:    { bottom: { style: 'thin', color: { rgb: C.BORDER } } },
      alignment: { vertical: 'center' },
    }
    colHeaders.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: row, c })] = makeCell(h, colHeaderStyle)
    })
    row++

    // Data rows: one row per cell with valor 'si'/'sí' or 'pd'
    let dataCount = 0
    const sortedPlanifs = [...tema.planificaciones].sort((a, b) =>
      (a.semana || '').localeCompare(b.semana || '')
    )

    for (const planif of sortedPlanifs) {
      for (const col of MEDIA_COLS) {
        const { valor, notas } = getCellData(planif.medios, col.id)
        const v    = (valor || '').toLowerCase()
        const isSi = v.startsWith('si') || v.startsWith('sí')
        const isPd = v.startsWith('pd')
        if (!isSi && !isPd) continue

        const alt      = dataCount % 2 === 1
        const baseBg   = alt ? C.ALT_ROW : C.WHITE
        const notesStr = notas?.trim()

        const descBg  = notesStr ? baseBg : (isSi ? C.GREEN_BG  : C.YELLOW_BG)
        const descFg  = notesStr ? C.BODY_TEXT : (isSi ? C.GREEN_FG : C.YELLOW_FG)
        const descTxt = notesStr || (isSi ? 'Sí' : 'Por definir')

        const canal = col.sub ? `${col.label} / ${col.sub}` : col.label

        ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell(fmtDate(planif.semana),   bodyStyle(baseBg, C.BODY_TEXT))
        ws[XLSX.utils.encode_cell({ r: row, c: 1 })] = makeCell(canal,                    bodyStyle(baseBg, C.BODY_TEXT))
        ws[XLSX.utils.encode_cell({ r: row, c: 2 })] = makeCell(descTxt,                  bodyStyle(descBg, descFg))
        ws[XLSX.utils.encode_cell({ r: row, c: 3 })] = makeCell(planif.responsable || '',  bodyStyle(baseBg, C.BODY_TEXT))

        row++
        dataCount++
      }
    }

    // Empty row separator between temas
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = makeCell('')
    row++
  }

  // Sheet metadata
  ws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: NCOLS - 1 } })
  ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 52 }, { wch: 20 }]
  ws['!merges'] = merges
  ws['!rows']   = Array(5).fill(null)
  ws['!rows'][0] = { hpx: 10 }
  ws['!rows'][1] = { hpx: 28 }
  ws['!rows'][4] = { hpx: 10 }

  ws['!sheetViews'] = [{
    state:        'frozen',
    ySplit:       5,
    topLeftCell:  'A6',
    showGridLines: false,
  }]

  XLSX.utils.book_append_sheet(wb, ws, 'Mesa de Medios')

  const fname = `Mesa-Medios-USS-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}.xlsx`
  XLSX.writeFile(wb, fname)
}
