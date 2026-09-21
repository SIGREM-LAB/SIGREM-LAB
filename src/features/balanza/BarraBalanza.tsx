import { Icon } from '@iconify/react'
import { Alert, Button, Chip, Stack, Typography } from '@mui/material'

import { useBalanza } from './contextoBalanza'

/**
 * El estado de la balanza: conectar, ver la lectura en vivo, soltar.
 *
 * Se usa donde hay espacio para mirarla —el panel de prácticas—. Un campo
 * suelto, en cambio, lleva `BotonBalanza`, que conecta solo y no ocupa una fila
 * entera.
 */
export function BarraBalanza() {
  const { estado, soportado, lectura, error, conectar, desconectar } = useBalanza()

  if (!soportado) {
    return (
      <Alert severity="info" icon={<Icon icon="mdi:scale-balance" />}>
        Este navegador no puede leer la balanza. Hace falta Chrome o Edge de escritorio.
      </Alert>
    )
  }

  if (estado === 'conectada') {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          size="small"
          color={lectura?.estable === true ? 'success' : 'default'}
          icon={<Icon icon="mdi:scale-balance" />}
          label={lectura === null ? 'Sin lectura' : `${lectura.valor} ${lectura.unidad}`}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {lectura?.estable === true ? 'Peso estable' : 'Estabilizando…'}
        </Typography>
        <Button size="small" variant="text" color="secondary" onClick={() => void desconectar()}>
          Desconectar
        </Button>
      </Stack>
    )
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        startIcon={<Icon icon="mdi:scale-balance" />}
        // El error ya se pinta aquí abajo desde el contexto; el `catch` es para
        // que el rechazo no salga por consola como si nadie lo atendiera.
        onClick={() => void conectar().catch(() => {})}
        disabled={estado === 'conectando'}
      >
        {estado === 'conectando' ? 'Conectando…' : 'Conectar balanza'}
      </Button>
      {error !== null ? (
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          {error}
        </Typography>
      ) : null}
    </Stack>
  )
}
