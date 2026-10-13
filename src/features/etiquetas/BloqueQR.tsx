import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Box, Button, Stack } from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'

import type { DatosEtiqueta } from './codigo'
import { HojaEtiquetas } from './HojaEtiquetas'

/**
 * El QR de una existencia en su panel, con el botón para imprimir su etiqueta.
 *
 * En pantalla el QR va sobre blanco aunque el tema sea oscuro: invertido, muchos
 * lectores no lo leen.
 */
export function BloqueQR(datos: DatosEtiqueta) {
  const [imprimiendo, setImprimiendo] = useState(false)
  // Estable: `HojaEtiquetas` lo usa como dependencia de su efecto.
  const [terminar] = useState(() => () => setImprimiendo(false))

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
      <Box sx={{ bgcolor: '#fff', p: 1, borderRadius: 1, lineHeight: 0, flexShrink: 0 }}>
        <QRCodeSVG value={datos.codigo} level="M" size={96} title={`QR de ${datos.codigo}`} />
      </Box>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Icon icon="mdi:printer-outline" width={18} />}
        onClick={() => setImprimiendo(true)}
      >
        Imprimir etiqueta
      </Button>
      {imprimiendo ? <HojaEtiquetas etiquetas={[datos]} onTerminar={terminar} /> : null}
    </Stack>
  )
}
