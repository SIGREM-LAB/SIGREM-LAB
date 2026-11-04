import { Box } from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'

import { ETIQUETA_MM, type DatosEtiqueta } from './codigo'

/**
 * Una etiqueta física: QR a la izquierda; código, nombre y ubicación a la
 * derecha. Se mide en milímetros y en negro puro, porque es para la impresora
 * térmica y no para la pantalla: no sigue el tema claro/oscuro.
 *
 * El QR lleva sólo el código. Nivel M de corrección: sigue leyéndose con un
 * rayón o una mancha de reactivo. Lleva dos módulos de margen blanco propio:
 * con menos, la pistola a veces no distingue dónde empieza el código.
 */
export function EtiquetaQR({ codigo, nombre, ubicacion }: DatosEtiqueta) {
  return (
    <Box
      sx={{
        width: `${ETIQUETA_MM.ancho}mm`,
        height: `${ETIQUETA_MM.alto}mm`,
        boxSizing: 'border-box',
        p: '1.2mm',
        display: 'flex',
        gap: '1mm',
        alignItems: 'center',
        bgcolor: '#fff',
        color: '#000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
        breakAfter: 'page',
        pageBreakAfter: 'always',
      }}
    >
      <QRCodeSVG
        value={codigo}
        level="M"
        marginSize={2}
        title={codigo}
        style={{ width: '23mm', height: '23mm', flexShrink: 0 }}
      />
      <Box sx={{ minWidth: 0, flex: 1, lineHeight: 1.15 }}>
        <Box
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '8pt',
            wordBreak: 'break-all',
          }}
        >
          {codigo}
        </Box>
        <Box
          sx={{
            fontSize: '6.5pt',
            fontWeight: 600,
            mt: '0.6mm',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {nombre}
        </Box>
        {ubicacion ? (
          <Box
            sx={{
              fontSize: '6pt',
              mt: '0.6mm',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {ubicacion}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
