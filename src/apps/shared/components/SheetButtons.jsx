import { useState } from 'react'
import { VISOR_SHEETS } from '../utils/sheetsConfig'
import SheetViewer from './SheetViewer'

/**
 * Renderiza un botón por cada entrada de VISOR_SHEETS y gestiona
 * el modal SheetViewer correspondiente al botón activo.
 *
 * En mobile (ancho <= 768px) los botones muestran solo el ícono
 * (el label queda oculto via CSS font-size: 0) con title para tooltip.
 */
export default function SheetButtons() {
  const [activeSheetId, setActiveSheetId] = useState(null)

  const activeSheet = VISOR_SHEETS.find((s) => s.id === activeSheetId) ?? null

  return (
    <>
      <div className="sheet-buttons">
        {VISOR_SHEETS.map((sheet) => (
          <button
            key={sheet.id}
            className="btn-sheet-viewer"
            onClick={() => setActiveSheetId(sheet.id)}
            aria-label={`Abrir visor: ${sheet.label}`}
            title={sheet.label}
          >
            {/* Ícono grid/tabla 14×14 */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.1" />
              <line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.1" />
              <line x1="5" y1="1" x2="5" y2="13" stroke="currentColor" strokeWidth="1.1" />
              <line x1="9" y1="1" x2="9" y2="13" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            {sheet.label}
          </button>
        ))}
      </div>

      <SheetViewer
        isOpen={activeSheet !== null}
        onClose={() => setActiveSheetId(null)}
        title={activeSheet?.label ?? ''}
        url={activeSheet?.url ?? ''}
      />
    </>
  )
}
