import { Icon } from '@iconify/react'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material'

import { ESTADO } from './presentacion'
import { CLASIFICACIONES, type Filtros } from './filtros'

type Props = {
  filtros: Filtros
  almacenes: { id: number; clave: string }[]
  onCambio: (filtros: Filtros) => void
}

export function FiltrosInventario({ filtros, almacenes, onCambio }: Props) {
  // Un solo camino para publicar cambios: así ningún control se olvida de
  // conservar el resto del estado. Sin esto, cambiar el tipo borraría el término
  // ya tecleado.
  const cambiar = (parche: Partial<Filtros>) => onCambio({ ...filtros, ...parche })

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap' }}
    >
      <TextField
        label="Buscar"
        type="search"
        value={filtros.termino}
        onChange={(e) => cambiar({ termino: e.target.value })}
        placeholder="Nombre, marca o código"
        size="small"
        sx={{ flex: 1, minWidth: 220 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {/* Decorativo: la etiqueta ya dice qué hace el campo. */}
                <Icon icon="mdi:magnify" width={20} aria-hidden />
              </InputAdornment>
            ),
          },
        }}
      />

      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="filtro-tipo">Tipo</InputLabel>
        <Select
          labelId="filtro-tipo"
          label="Tipo"
          value={filtros.clasificacion}
          onChange={(e) => cambiar({ clasificacion: e.target.value as Filtros['clasificacion'] })}
        >
          <MenuItem value="todas">Todos los tipos</MenuItem>
          {CLASIFICACIONES.map((c) => (
            <MenuItem key={c.valor} value={c.valor}>
              {c.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="filtro-almacen">Almacén</InputLabel>
        <Select
          labelId="filtro-almacen"
          label="Almacén"
          value={filtros.almacenId}
          onChange={(e) =>
            cambiar({
              almacenId: e.target.value === 'todos' ? 'todos' : Number(e.target.value),
            })
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

      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="filtro-estado">Estado</InputLabel>
        <Select
          labelId="filtro-estado"
          label="Estado"
          value={filtros.estado}
          onChange={(e) => cambiar({ estado: e.target.value as Filtros['estado'] })}
        >
          <MenuItem value="todos">Todos los estados</MenuItem>
          {Object.entries(ESTADO).map(([valor, aspecto]) => (
            <MenuItem key={valor} value={valor}>
              {aspecto.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Checkbox
            checked={filtros.incluirBaja}
            onChange={(e) => cambiar({ incluirBaja: e.target.checked })}
          />
        }
        label="Incluir bajas"
      />
    </Stack>
  )
}
