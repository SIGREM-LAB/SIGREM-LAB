import { Alert, Stack, Typography } from '@mui/material'

export function PaginaInventarioGeneral() {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h1">Inventario general</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Vista administrativa de las existencias de todos los almacenes.
        </Typography>
      </Stack>
      <Alert severity="info">Esta pantalla se implementará en un hito posterior.</Alert>
    </Stack>
  )
}
