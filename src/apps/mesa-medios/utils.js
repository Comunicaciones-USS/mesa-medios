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
