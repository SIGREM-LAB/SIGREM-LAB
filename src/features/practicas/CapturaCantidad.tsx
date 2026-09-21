import { Box, Stack, TextField, Typography } from '@mui/material'

import { BarraBalanza } from '@/features/balanza/BarraBalanza'
import { BotonBalanza } from '@/features/balanza/BotonBalanza'
import { aNumero, aTexto } from './campoNumero'
import { perdidasDe, type ElementoCaptura } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

export function CapturaCantidad({ elemento, onCambiar }: Props) {
  const perdidas = perdidasDe(elemento)

  return (
    <Stack spacing={2}>
      <BarraBalanza />

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          type="number"
          label="Cantidad entregada"
          value={aTexto(elemento.cantidadEntregada)}
          onChange={(e) => onCambiar({ cantidadEntregada: aNumero(e.target.value) })}
        />
        <BotonBalanza
          unidad={elemento.unidadBase}
          onPeso={(valor) => onCambiar({ cantidadEntregada: valor })}
        />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          type="number"
          label="Cantidad devuelta"
          value={aTexto(elemento.cantidadDevuelta)}
          onChange={(e) => onCambiar({ cantidadDevuelta: aNumero(e.target.value) })}
        />
        <BotonBalanza
          unidad={elemento.unidadBase}
          onPeso={(valor) => onCambiar({ cantidadDevuelta: valor })}
        />
      </Stack>

      {/* Dañada y perdida se capturan por separado porque la base escribe DOS
          movimientos distintos: 'merma' para lo dañado y 'consumo' para lo no
          devuelto. Juntarlas tiraría esa distinción. */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          type="number"
          label="Cantidad dañada"
          value={aTexto(elemento.cantidadDanada)}
          onChange={(e) => onCambiar({ cantidadDanada: aNumero(e.target.value) })}
        />
        <BotonBalanza
          unidad={elemento.unidadBase}
          onPeso={(valor) => onCambiar({ cantidadDanada: valor })}
        />
      </Stack>

      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Pérdidas calculadas
        </Typography>
        <Typography variant="h2" sx={{ color: 'institucional.main' }}>
          {perdidas === null ? '—' : `${perdidas} ${elemento.unidadBase}`}
        </Typography>
      </Box>
    </Stack>
  )
}
