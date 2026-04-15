import { MEDIA_COLS } from './config'

// Lee valor de celda desde formato JSONB nuevo o legacy string
export function getCellData(medios, colId) {
  const raw = medios?.[colId]
  if (!raw) return { valor: '', notas: '' }
  if (typeof raw === 'string') return { valor: raw, notas: '' }
  return { valor: raw.valor || '', notas: raw.notas || '' }
}

export function setCellData(medios, colId, valor, notas) {
  const existing = getCellData(medios, colId)
  const newNotas = notas !== undefined ? notas : existing.notas
  if (!valor && !newNotas) return { ...medios, [colId]: null }
  return { ...medios, [colId]: { valor: valor || '', notas: newNotas || '' } }
}

export function getRowProgress(medios) {
  const filled = MEDIA_COLS.filter(col => {
    const { valor } = getCellData(medios, col.id)
    return valor && valor !== 'no'
  }).length
  const total = MEDIA_COLS.length
  return { filled, total, pct: Math.round((filled / total) * 100) }
}

export function getRowProgressFiltered(medios, cols) {
  if (!cols || cols.length === 0) return { filled: 0, total: 0, pct: 0 }
  const filled = cols.filter(col => {
    const { valor } = getCellData(medios, col.id)
    return valor && valor !== 'no'
  }).length
  const total = cols.length
  return { filled, total, pct: Math.round((filled / total) * 100) }
}
