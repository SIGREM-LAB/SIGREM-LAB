import { Box, Stack, TextField, Typography } from '@mui/material'

import { BarraBalanza } from '@/features/balanza/BarraBalanza'
import { BotonBalanza } from '@/features/balanza/BotonBalanza'
import { aNumero, aTexto } from './campoNumero'
import { consumoDe, type ElementoCaptura } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

export function CapturaPeso({ elemento, onCambiar }: Props) {
  const consumo = consumoDe(elemento)

  return (
    <Stack spacing={2}>
      <BarraBalanza />

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          type="number"
          label={`Peso inicial (${elemento.unidadBase})`}
          value={aTexto(elemento.pesoInicial)}
          onChange={(e) => onCambiar({ pesoInicial: aNumero(e.target.value) })}
        />
        <BotonBalanza
          unidad={elemento.unidadBase}
          onPeso={(valor) => onCambiar({ pesoInicial: valor })}
        />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          type="number"
          label={`Peso final (${elemento.unidadBase})`}
          value={aTexto(elemento.pesoFinal)}
          onChange={(e) => onCambiar({ pesoFinal: aNumero(e.target.value) })}
        />
        <BotonBalanza
          unidad={elemento.unidadBase}
          onPeso={(valor) => onCambiar({ pesoFinal: valor })}
        />
      </Stack>

      {/* Se muestra pero NO se envía: `consumo` es una columna generada, y la
          aritmética vive en la base porque una resta que calcula el frontend se
          puede equivocar en silencio. */}
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Consumo calculado
        </Typography>
        <Typography variant="h2" sx={{ color: 'institucional.main' }}>
          {consumo === null ? '—' : `${consumo} ${elemento.unidadBase}`}
        </Typography>
      </Box>
    </Stack>
  )
}
