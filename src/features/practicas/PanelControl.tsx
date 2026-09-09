import { Icon } from '@iconify/react'
import { Alert, Box, Divider, Paper, Stack, Typography } from '@mui/material'

import { CapturaCantidad } from './CapturaCantidad'
import { CapturaPeso } from './CapturaPeso'
import { CapturaPrestamo } from './CapturaPrestamo'
import type { Motivo } from './consultas'
import { errorDeElemento, type ElementoCaptura } from './esquemas'
import { aspectoDeMetodo } from './metodos'
import { Observaciones } from './Observaciones'

type Props = {
  elemento: ElementoCaptura | null
  motivos: Motivo[]
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

export function PanelControl({ elemento, motivos, onCambiar }: Props) {
  if (elemento === null) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
        <Icon icon="mdi:package-variant-closed" width={40} aria-hidden />
        <Typography sx={{ color: 'text.secondary' }}>Seleccione un producto</Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          Haga clic en una fila de la tabla
        </Typography>
      </Stack>
    )
  }

  const metodo = aspectoDeMetodo(elemento.metodo)
  const error = errorDeElemento(elemento)

  return (
    <Stack spacing={2}>
      {/* Qué producto se está capturando. Sin esto, quien llena tres productos
          seguidos pierde de vista cuál es cuál. */}
      <Paper
        variant="outlined"
        sx={{ p: 1.5, borderLeft: '4px solid', borderLeftColor: metodo.color }}
      >
        <Typography sx={{ fontWeight: 600 }}>{elemento.nombre}</Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: metodo.color }}>
          {elemento.codigo}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {`${elemento.almacenClave} · ${elemento.disponible} ${elemento.unidadBase}`}
        </Typography>
      </Paper>

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', color: metodo.color, fontWeight: 600 }}
      >
        <Icon icon={metodo.icono} aria-hidden />
        <span>{metodo.titulo}</span>
      </Stack>

      {/* El sub-panel se elige por el método que trae la fila, que lo puso
          `metodo_de_control()` en la base. Nunca por la clasificación ni por un
          condicional sobre el almacén. */}
      <Box>
        {elemento.metodo === 'peso' ? (
          <CapturaPeso elemento={elemento} onCambiar={onCambiar} />
        ) : null}
        {elemento.metodo === 'cantidad' ? (
          <CapturaCantidad elemento={elemento} onCambiar={onCambiar} />
        ) : null}
        {elemento.metodo === 'prestamo' ? (
          <CapturaPrestamo elemento={elemento} onCambiar={onCambiar} />
        ) : null}
      </Box>

      <Divider />

      <Observaciones elemento={elemento} motivos={motivos} onCambiar={onCambiar} />

      {/* El problema se dice donde se captura, no al finalizar: si sale hasta el
          envío, quien lo lee ya no sabe cuál de los productos fue. */}
      {error === null ? (
        <Alert severity="success" icon={<Icon icon="mdi:check-circle-outline" />}>
          Producto completado
        </Alert>
      ) : (
        <Alert severity="warning" icon={<Icon icon="mdi:alert-outline" />}>
          {error}
        </Alert>
      )}
    </Stack>
  )
}
