import { Icon } from '@iconify/react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'

type Props = {
  abierto: boolean
  onCerrar: () => void
}

/**
 * Sólo espera. El código lo recibe `PaginaNuevaPractica`, que tomó la pistola
 * para toda la pantalla, y lo cierra en cuanto lo agrega.
 *
 * No lleva campo de texto a propósito: la escucha global se aparta cuando el
 * foco está en uno (ahí la pistola teclea como teclado) y el escaneo no llegaría.
 */
export function DialogoEscanear({ abierto, onCerrar }: Props) {
  return (
    <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="xs">
      <DialogTitle sx={{ color: 'institucional.main' }}>Escanear QR</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
          <Icon icon="mdi:qrcode-scan" width={56} aria-hidden />
          <Typography>Dispara la pistola sobre la etiqueta del producto.</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Se agrega solo a la práctica. También puedes escanear sin abrir esta ventana, siempre
            que el cursor no esté en un campo de texto.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  )
}
