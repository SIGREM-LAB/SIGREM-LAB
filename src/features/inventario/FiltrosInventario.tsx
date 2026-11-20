import { Icon } from '@iconify/react'
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'

import { ESTADO } from './presentacion'
import {
  CLASIFICACIONES,
  conAlmacen,
  ORDENES,
  SIN_UBICACION,
  type Filtros,
  type Mueble,
} from './filtros'

type Props = {
  filtros: Filtros
  almacenes: { id: number; clave: string }[]
  /**
   * Si se dibuja el selector de almacén. Va aparte de `almacenes` y no se
   * deduce de que la lista venga vacía: mientras la consulta está en vuelo lo
   * está, y el selector aparecería un instante después que el resto de la fila.
   */
  mostrarAlmacen: boolean
  /** Los muebles del almacén elegido. Vacío mientras no hay almacén. */
  muebles: Mueble[]
  onCambio: (filtros: Filtros) => void
}

export function FiltrosInventario({
  filtros,
  almacenes,
  mostrarAlmacen,
  muebles,
  onCambio,
}: Props) {
  // Un solo camino para publicar cambios: así ningún control se olvida de
  // conservar el resto del estado. Sin esto, cambiar el tipo borraría el término
  // ya tecleado.
  const cambiar = (parche: Partial<Filtros>) => onCambio({ ...filtros, ...parche })

  // Las ubicaciones son de cada almacén: sin uno elegido no hay qué ofrecer.
  const sinAlmacen = filtros.almacenId === 'todos'
  const repisas = muebles.find((m) => m.nombre === filtros.mueble)?.repisas ?? []
  // Un mueble que ya no está en la lista (la consulta todavía en vuelo, o un
  // dato que cambió) se deja como opción: un Select con un valor fuera de sus
  // opciones queda en blanco y MUI lo reporta en consola.
  const repisaActiva = !sinAlmacen && filtros.mueble !== '' && filtros.mueble !== SIN_UBICACION
  const huerfano =
    filtros.mueble !== '' &&
    filtros.mueble !== SIN_UBICACION &&
    !muebles.some((m) => m.nombre === filtros.mueble)

  return (
    // Rejilla y no `Stack` con `flexWrap`: Stack separa con márgenes, y al
    // partirse en dos renglones el primero del segundo queda con sangría y
    // pegado al de arriba. Aquí cada control cae en una columna, los renglones
    // quedan alineados y el buscador no se encoge cuando un mueble trae un
    // nombre largo. En teléfono queda una sola columna.
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 2,
        alignItems: 'start',
      }}
    >
      <TextField
        label="Buscar"
        type="search"
        value={filtros.termino}
        onChange={(e) => cambiar({ termino: e.target.value })}
        placeholder="Nombre, marca, código o ubicación"
        size="small"
        // Dos columnas: es el control que más se usa y el placeholder es largo.
        sx={{ gridColumn: { xs: '1 / -1', sm: 'span 2' } }}
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

      <FormControl size="small">
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

      {mostrarAlmacen ? (
        <FormControl size="small">
          <InputLabel id="filtro-almacen">Almacén</InputLabel>
          <Select
            labelId="filtro-almacen"
            label="Almacén"
            value={filtros.almacenId}
            onChange={(e) =>
              onCambio(
                conAlmacen(
                  filtros,
                  e.target.value === 'todos' ? 'todos' : Number(e.target.value),
                ),
              )
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
      ) : null}

      <FormControl size="small" disabled={sinAlmacen}>
        {/* `''` es "todos" y se pinta con su texto: sin `shrink` y `notched`
            la etiqueta quedaría encima de él. Apagado no se pinta nada y la
            etiqueta vuelve a su sitio. */}
        <InputLabel id="filtro-mueble" shrink={!sinAlmacen}>
          Mueble
        </InputLabel>
        <Select
          labelId="filtro-mueble"
          label="Mueble"
          value={sinAlmacen ? '' : filtros.mueble}
          displayEmpty={!sinAlmacen}
          notched={!sinAlmacen}
          // Cambiar de mueble suelta la repisa: la 2 de un anaquel no es la
          // del otro.
          onChange={(e) => cambiar({ mueble: e.target.value, repisa: '' })}
        >
          <MenuItem value="">Todos los muebles</MenuItem>
          <MenuItem value={SIN_UBICACION}>Sin ubicación</MenuItem>
          {huerfano ? <MenuItem value={filtros.mueble}>{filtros.mueble}</MenuItem> : null}
          {muebles.map((m) => (
            <MenuItem key={m.nombre} value={m.nombre}>
              {m.nombre}
            </MenuItem>
          ))}
        </Select>
        {sinAlmacen ? <FormHelperText>Elige un almacén</FormHelperText> : null}
      </FormControl>

      <FormControl
        size="small"
        disabled={!repisaActiva}
      >
        <InputLabel id="filtro-repisa" shrink={repisaActiva}>
          Repisa
        </InputLabel>
        <Select
          labelId="filtro-repisa"
          label="Repisa"
          value={repisaActiva ? filtros.repisa : ''}
          displayEmpty={repisaActiva}
          notched={repisaActiva}
          onChange={(e) => cambiar({ repisa: e.target.value })}
        >
          <MenuItem value="">Todas las repisas</MenuItem>
          {filtros.repisa !== '' && !repisas.includes(filtros.repisa) ? (
            <MenuItem value={filtros.repisa}>{filtros.repisa}</MenuItem>
          ) : null}
          {repisas.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small">
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

      <FormControl size="small">
        <InputLabel id="filtro-orden">Ordenar por</InputLabel>
        <Select
          labelId="filtro-orden"
          label="Ordenar por"
          value={filtros.orden}
          onChange={(e) => cambiar({ orden: e.target.value as Filtros['orden'] })}
        >
          {ORDENES.map((o) => (
            <MenuItem key={o.valor} value={o.valor}>
              {o.etiqueta}
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
        // El alto de un control `small`: así la casilla queda centrada con los
        // selectores de su renglón y no pegada arriba.
        sx={{ height: 40 }}
      />
    </Box>
  )
}
