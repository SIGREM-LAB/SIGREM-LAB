import { Icon } from '@iconify/react'
import {
  Box,
  ButtonBase,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'

import { aspectoDeAlmacen } from '@/app/almacenes'
import type { Tables } from '@/types/database'
import { aspectoDeEstado, cortarNombre } from './presentacion'

export type Fila = Tables<'existencia_listado'>

/**
 * Alto fijo de renglon. Un nombre de reactivo trae segunda linea y uno de
 * equipo no, asi que sin esto los renglones miden 40 u 57 px segun el dato y la
 * tabla cambia de alto al cambiar de almacen. Con la medida clavada, dos
 * paginas llenas ocupan exactamente lo mismo.
 */
const ALTO_FILA = 56

/**
 * Los anchos van aqui y se aplican con `<colgroup>` sobre una tabla
 * `table-layout: fixed`. Es la otra mitad del mismo problema: con el reparto
 * automatico, el ancho de cada columna sale del contenido, asi que al cambiar
 * de almacen las seis columnas se recolocan. Fijos, no se mueven nunca.
 *
 * `Nombre` va sin ancho: se queda con lo que sobra.
 */
const COLUMNAS: { etiqueta: string; ancho?: number }[] = [
  { etiqueta: 'Código', ancho: 116 },
  { etiqueta: 'Nombre' },
  { etiqueta: 'Existencia', ancho: 116 },
  { etiqueta: 'Estado', ancho: 140 },
  { etiqueta: 'Almacén', ancho: 104 },
  { etiqueta: 'Ubicación', ancho: 168 },
]

/** Suma de los anchos fijos mas el minimo que se le deja al nombre. */
const ANCHO_MINIMO = 884

const ESTILO_CABECERA = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  whiteSpace: 'nowrap',
} as const

type Props = {
  filas: Fila[]
  total: number
  pagina: number
  porPagina: number
  /** `null` para admin y consulta: no hay almacén propio contra el que contrastar. */
  almacenPropio: number | null
  /** Primera carga: se dibujan renglones vacíos con la medida final. */
  cargando?: boolean
  onPagina: (pagina: number) => void
  onPorPagina: (porPagina: number) => void
  onAbrir: (fila: Fila) => void
}

function PuntoEstado({ estado }: { estado: Fila['estado'] }) {
  const aspecto = aspectoDeEstado(estado)
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: aspecto.color, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {aspecto.etiqueta}
      </Typography>
    </Stack>
  )
}

/** El hueco de la primera carga, con el mismo alto que un renglón de verdad. */
function FilasCargando({ cuantas }: { cuantas: number }) {
  return (
    <>
      {Array.from({ length: cuantas }, (_, i) => (
        <TableRow key={i} sx={{ height: ALTO_FILA }}>
          {COLUMNAS.map((columna) => (
            <TableCell key={columna.etiqueta}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function TablaExistencias({
  filas,
  total,
  pagina,
  porPagina,
  almacenPropio,
  cargando = false,
  onPagina,
  onPorPagina,
  onAbrir,
}: Props) {
  return (
    <>
      {/* El contenedor desplaza en horizontal por su cuenta: a 1024 px, que es
          la resolución de las máquinas del almacén, seis columnas no caben, y
          es preferible que ruede la tabla y no la página entera. El alto mínimo
          evita que un filtro con dos resultados encoja la tarjeta de golpe. */}
      <TableContainer sx={{ overflowX: 'auto', minHeight: 240 }}>
        <Table
          aria-label="Existencias de los almacenes"
          size="small"
          sx={{ tableLayout: 'fixed', minWidth: ANCHO_MINIMO }}
        >
          <colgroup>
            {COLUMNAS.map((columna) => (
              <col key={columna.etiqueta} style={{ width: columna.ancho }} />
            ))}
          </colgroup>

          <TableHead>
            <TableRow>
              {COLUMNAS.map((columna) => (
                <TableCell key={columna.etiqueta} sx={ESTILO_CABECERA}>
                  {columna.etiqueta}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {cargando ? <FilasCargando cuantas={Math.min(porPagina, 8)} /> : null}

            {!cargando && filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS.length} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary' }}>
                    No se encontraron existencias con esos filtros
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}

            {cargando
              ? null
              : filas.map((f) => {
                  const { cabeza, resto } = cortarNombre(f.nombre_canonico ?? '')
                  const aspecto = aspectoDeAlmacen(f.almacen_clave)
                  const ajeno = almacenPropio !== null && f.almacen_id !== almacenPropio
                  const segundaLinea = [f.marca, resto !== '' ? resto : f.descripcion]
                    .filter(Boolean)
                    .join(' · ')

                  return (
                    <TableRow key={f.codigo ?? f.id} hover sx={{ height: ALTO_FILA }}>
                      <TableCell>
                        {/* El control enfocable vive AQUÍ y no en el <tr>: a un <tr>
                            no se llega con Tab, y el prototipo pone ahí el onClick.
                            Sin esto la pantalla no se puede usar sin ratón. */}
                        <ButtonBase
                          onClick={() => onAbrir(f)}
                          aria-label={`Ver detalle de ${f.codigo ?? 'la existencia'}`}
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: 'primary.main',
                            borderRadius: 1,
                            px: 0.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {f.codigo}
                        </ButtonBase>
                      </TableCell>

                      <TableCell>
                        {/* noWrap en las dos líneas: un nombre largo que se
                            partiera en tres renglones volvería a mover la tabla.
                            El texto completo sigue disponible en el title. */}
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: 500 }}
                          title={f.nombre_canonico ?? ''}
                        >
                          {cabeza}
                        </Typography>
                        {segundaLinea === '' ? null : (
                          <Typography
                            variant="caption"
                            noWrap
                            component="p"
                            title={segundaLinea}
                            sx={{ color: 'text.secondary' }}
                          >
                            {segundaLinea}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {f.cantidad === null ? '—' : `${f.cantidad} ${f.unidad_base ?? ''}`.trim()}
                      </TableCell>

                      <TableCell>
                        <PuntoEstado estado={f.estado} />
                      </TableCell>

                      <TableCell>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Box
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              bgcolor: aspecto.color,
                              color: 'common.white',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {f.almacen_clave}
                          </Box>
                          {ajeno ? (
                            // El `title` va en el span y no en el <Icon>: Iconify lo
                            // pintaría como <title> dentro del SVG, y ahí queda a
                            // merced de cómo trate cada lector de pantalla los SVG.
                            <Box
                              component="span"
                              title="De otro almacén: solo consulta"
                              sx={{ display: 'inline-flex', color: 'text.secondary' }}
                            >
                              <Icon icon="mdi:eye-outline" width={16} aria-hidden />
                            </Box>
                          ) : null}
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography
                          variant="caption"
                          noWrap
                          component="p"
                          title={f.ubicacion ?? ''}
                          sx={{ color: 'text.secondary' }}
                        >
                          {f.ubicacion ?? '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={pagina}
        rowsPerPage={porPagina}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_, p) => onPagina(p)}
        onRowsPerPageChange={(e) => onPorPagina(Number(e.target.value))}
        labelRowsPerPage="Por página:"
        labelDisplayedRows={({ from, to, count }) =>
          cargando ? '—' : `${from}–${to} de ${count}`
        }
        sx={{ borderTop: '1px solid', borderColor: 'divider' }}
      />
    </>
  )
}
