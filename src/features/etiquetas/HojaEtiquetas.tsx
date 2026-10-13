import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { GlobalStyles } from '@mui/material'

import { ETIQUETA_MM, type DatosEtiqueta } from './codigo'
import { EtiquetaQR } from './EtiquetaQR'

type Props = {
  etiquetas: DatosEtiqueta[]
  /** Se llama cuando el diálogo de impresión se cierra, se haya impreso o no. */
  onTerminar: () => void
}

/**
 * Imprime las etiquetas con la impresión del navegador: sin servidor ni driver
 * especial. En el diálogo se elige la Brother, y su driver toma cada página
 * como una etiqueta y corta la cinta.
 *
 * Mientras está montada, la impresión enseña sólo esta hoja: el resto de la app
 * se esconde con `@media print`. En pantalla no se ve.
 */
export function HojaEtiquetas({ etiquetas, onTerminar }: Props) {
  // Abrir el diálogo de impresión es un efecto sobre el navegador. Se espera un
  // cuadro para que el portal ya esté pintado cuando el navegador lo capture.
  useEffect(() => {
    window.addEventListener('afterprint', onTerminar, { once: true })
    const cuadro = requestAnimationFrame(() => window.print())
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener('afterprint', onTerminar)
    }
  }, [onTerminar])

  return createPortal(
    <>
      <GlobalStyles
        styles={{
          '@page': { size: `${ETIQUETA_MM.ancho}mm ${ETIQUETA_MM.alto}mm`, margin: 0 },
          '.hoja-etiquetas': { display: 'none' },
          '@media print': {
            'body > *:not(.hoja-etiquetas)': { display: 'none !important' },
            '.hoja-etiquetas': { display: 'block' },
            body: { margin: 0, background: '#fff' },
          },
        }}
      />
      <div className="hoja-etiquetas" data-testid="hoja-etiquetas">
        {etiquetas.map((e) => (
          <EtiquetaQR key={e.codigo} {...e} />
        ))}
      </div>
    </>,
    document.body,
  )
}
