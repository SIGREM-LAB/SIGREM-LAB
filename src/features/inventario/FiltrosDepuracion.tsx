import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material'

import type { FiltrosPendientes } from './pendientes'
import { MOTIVO, REVISION } from './presentacion'

type Props = {
  filtros: FiltrosPendientes
  almacenes: { id: number; clave: string }[]
  onCambio: (filtros: FiltrosPendientes) => void
}

/**
 * Tres filtros y ninguna caja de búsqueda. No es un olvido: aquí no se busca un
 * frasco, se recorre una cola. Lo que hace falta es acotar por almacén (de
 * quién es el trabajo), por revisión (qué queda) y por motivo (los 224 duplicados
 * se deciden con otra cabeza que los 88 de unidad de empaque).
 */
export function FiltrosDepuracion({ filtros, almacenes, onCambio }: Props) {
  // Un solo camino para publicar cambios: así ningún control se olvida de
  // conservar el resto del estado.
  const cambiar = (parche: Partial<FiltrosPendientes>) => onCambio({ ...filtros, ...parche })

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap' }}
    >
      <FormControl size="small" sx={{ minWidth: 190 }}>
        <InputLabel id="filtro-almacen-pendientes">Almacén</InputLabel>
        <Select
          labelId="filtro-almacen-pendientes"
          label="Almacén"
          value={filtros.almacenId}
          onChange={(e) =>
            cambiar({ almacenId: e.target.value === 'todos' ? 'todos' : Number(e.target.value) })
          }
        >
          <MenuItem value="todos">Todos los almacenes</MenuItem>
          {almacenes.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.clave}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 190 }}>
        <InputLabel id="filtro-revision">Revisión</InputLabel>
        <Select
          labelId="filtro-revision"
          label="Revisión"
          value={filtros.estado}
          onChange={(e) => cambiar({ estado: e.target.value as FiltrosPendientes['estado'] })}
        >
          <MenuItem value="todos">Todo</MenuItem>
          {Object.entries(REVISION).map(([valor, aspecto]) => (
            <MenuItem key={valor} value={valor}>
              {aspecto.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 210 }}>
        <InputLabel id="filtro-motivo">Motivo</InputLabel>
        <Select
          labelId="filtro-motivo"
          label="Motivo"
          value={filtros.motivo}
          onChange={(e) => cambiar({ motivo: e.target.value as FiltrosPendientes['motivo'] })}
        >
          <MenuItem value="todos">Todos los motivos</MenuItem>
          {Object.entries(MOTIVO).map(([valor, aspecto]) => (
            <MenuItem key={valor} value={valor}>
              {aspecto.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
