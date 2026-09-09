import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material'

import type { ElementoCaptura, Funcionamiento } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

/**
 * Dos opciones y no cuatro. El enum `funcionamiento_equipo` de la base es
 * `correcto` / `presenta_fallas`; el «Bueno / Regular / Dañado / Mantenimiento»
 * del prototipo viejo no existe en el esquema.
 */
const ESTADOS: { valor: Funcionamiento; etiqueta: string }[] = [
  { valor: 'correcto', etiqueta: 'Correcto' },
  { valor: 'presenta_fallas', etiqueta: 'Presenta fallas' },
]

export function CapturaPrestamo({ elemento, onCambiar }: Props) {
  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel id="rot-salida">Estado de salida</InputLabel>
        <Select
          labelId="rot-salida"
          label="Estado de salida"
          value={elemento.estadoSalida ?? ''}
          onChange={(e) => onCambiar({ estadoSalida: e.target.value as Funcionamiento })}
        >
          {ESTADOS.map((e) => (
            <MenuItem key={e.valor} value={e.valor}>
              {e.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Opcional: un equipo puede quedarse prestado de un día para otro. Si
          viene, el trigger actualiza `existencia.funcionamiento`. */}
      <FormControl fullWidth>
        <InputLabel id="rot-devolucion">Estado de devolución</InputLabel>
        <Select
          labelId="rot-devolucion"
          label="Estado de devolución"
          value={elemento.estadoDevolucion ?? ''}
          onChange={(e) => onCambiar({ estadoDevolucion: e.target.value as Funcionamiento })}
        >
          {ESTADOS.map((e) => (
            <MenuItem key={e.valor} value={e.valor}>
              {e.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
