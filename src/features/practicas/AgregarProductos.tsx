import { Icon } from '@iconify/react'
import { Button, Stack, Tooltip } from '@mui/material'

type Props = {
  onBuscar: () => void
  /** Sin laboratorio elegido no hay almacén, y sin almacén no hay qué buscar. */
  deshabilitado: boolean
}

const AVISO_QR =
  'El escaneo con cámara todavía no está conectado. Un lector físico de código ' +
  'de barras o QR sí funciona: enfoca el campo de búsqueda y dispara.'

export function AgregarProductos({ onBuscar, deshabilitado }: Props) {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {/* El Tooltip envuelve un <span> porque un botón deshabilitado no dispara
          eventos del ratón, y sin el span el Tooltip nunca aparecería. */}
      <Tooltip title={AVISO_QR}>
        <span>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Icon icon="mdi:qrcode-scan" />}
            disabled
          >
            Escanear QR
          </Button>
        </span>
      </Tooltip>

      <Button
        variant="outlined"
        color="secondary"
        startIcon={<Icon icon="mdi:magnify" />}
        onClick={onBuscar}
        disabled={deshabilitado}
      >
        Buscar producto
      </Button>
    </Stack>
  )
}
