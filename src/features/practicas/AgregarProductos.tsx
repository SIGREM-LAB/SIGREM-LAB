import { Icon } from '@iconify/react'
import { Button, Stack } from '@mui/material'

type Props = {
  onEscanear: () => void
  onBuscar: () => void
  /** Sin laboratorio elegido no hay almacén, y sin almacén no hay qué buscar. */
  deshabilitado: boolean
}

export function AgregarProductos({ onEscanear, onBuscar, deshabilitado }: Props) {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      <Button
        variant="contained"
        color="secondary"
        startIcon={<Icon icon="mdi:qrcode-scan" />}
        onClick={onEscanear}
        disabled={deshabilitado}
      >
        Escanear QR
      </Button>

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
