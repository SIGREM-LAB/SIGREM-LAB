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
import {
  cantidadDeRenglon,
  leerProblemas,
  leerRenglon,
  nombreDeRenglon,
  origenDePendiente,
  resumenDeProblemas,
  type Pendiente,
} from './pendientes'
import { cortarNombre, MOTIVO, REVISION } from './presentacion'

/** Mismo alto clavado que en la tabla de existencias, y por lo mismo. */
const ALTO_FILA = 56

/**
 * La cantidad va con su unidad y en su propia columna porque aquí la unidad NO
 * es un adorno del número: de los 337 renglones de N3, 88 están apartados
 * porque la unidad es un empaque («1 paquete», «2 cajas») y otros 17 porque el
 * mismo artículo aparece en dos unidades. Sin esta columna hay que abrir el
 * panel de uno en uno para ver lo que la lista debería dejar escanear.
 */
const COLUMNAS: { etiqueta: string; ancho?: number }[] = [
  { etiqueta: 'Origen', ancho: 156 },
  { etiqueta: 'Artículo' },
  { etiqueta: 'Cantidad', ancho: 124 },
  { etiqueta: 'Qué le falta', ancho: 280 },
  { etiqueta: 'Motivo', ancho: 168 },
  { etiqueta: 'Revisión', ancho: 132 },
]

/** Suma de los anchos fijos más el mínimo que se le deja al artículo. */
const ANCHO_MINIMO = 1060

const ESTILO_CABECERA = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  whiteSpace: 'nowrap',
} as const

type Props = {
  filas: Pendiente[]
  total: number
  pagina: number
  porPagina: number
  /** `null` para admin y consulta: no hay almacén propio contra el que contrastar. */
  almacenPropio: number | null
  almacenes: { id: number; clave: string }[]
  cargando?: boolean
  onPagina: (pagina: number) => void
  onPorPagina: (porPagina: number) => void
  onAbrir: (pendiente: Pendiente) => void
}

function Punto({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }}
      />
      <Typography variant="body2" noWrap>
        {etiqueta}
      </Typography>
    </Stack>
  )
}

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

/**
 * La lista de renglones por revisar. Un renglón por PRODUCTO y no por defecto:
 * un mismo renglón puede violar varias reglas a la vez, y quien revisa mira el
 * frasco, no la regla. Por eso la columna resume el primer problema y el panel
 * enseña los demás.
 */
export function TablaPendientes({
  filas,
  total,
  pagina,
  porPagina,
  almacenPropio,
  almacenes,
  cargando = false,
  onPagina,
  onPorPagina,
  onAbrir,
}: Props) {
  const claveDe = (almacenId: number) =>
    almacenes.find((a) => a.id === almacenId)?.clave ?? '—'

  return (
    <>
      <TableContainer sx={{ overflowX: 'auto', minHeight: 240 }}>
        <Table
          aria-label="Renglones pendientes de revisión"
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
                    No queda ningún renglón con esos filtros
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}

            {cargando
              ? null
              : filas.map((p) => {
                  const renglon = leerRenglon(p.renglon)
                  const { cabeza, resto } = cortarNombre(nombreDeRenglon(renglon))
                  const problema = resumenDeProblemas(leerProblemas(p.problemas))
                  const motivo = MOTIVO[p.motivo]
                  const revision = REVISION[p.estado]
                  const clave = claveDe(p.almacen_id)
                  const aspecto = aspectoDeAlmacen(clave)
                  const ajeno = almacenPropio !== null && p.almacen_id !== almacenPropio

                  return (
                    <TableRow key={p.id} hover sx={{ height: ALTO_FILA }}>
                      <TableCell>
                        {/* El control enfocable va en la celda y no en el <tr>: a
                            un <tr> no se llega con Tab, y sin esto la pantalla no
                            se puede usar sin ratón. */}
                        <ButtonBase
                          onClick={() => onAbrir(p)}
                          aria-label={`Revisar ${origenDePendiente(p)}`}
                          sx={{
                            display: 'block',
                            textAlign: 'left',
                            borderRadius: 1,
                            px: 0.5,
                          }}
                        >
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ fontWeight: 600, color: 'primary.main' }}
                          >
                            {p.hoja}
                          </Typography>
                          <Typography
                            variant="caption"
                            component="p"
                            noWrap
                            sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
                          >
                            fila {p.fila}
                          </Typography>
                        </ButtonBase>
                      </TableCell>

                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: 500 }}
                          title={nombreDeRenglon(renglon)}
                        >
                          {cabeza}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Box
                            sx={{
                              px: 0.75,
                              borderRadius: 0.75,
                              bgcolor: aspecto.color,
                              color: 'common.white',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {clave}
                          </Box>
                          {ajeno ? (
                            <Box
                              component="span"
                              title="De otro almacén: solo consulta"
                              sx={{ display: 'inline-flex', color: 'text.secondary' }}
                            >
                              <Icon icon="mdi:eye-outline" width={14} aria-hidden />
                            </Box>
                          ) : null}
                          {resto === '' ? null : (
                            <Typography
                              variant="caption"
                              noWrap
                              component="span"
                              title={resto}
                              sx={{ color: 'text.secondary', minWidth: 0 }}
                            >
                              {resto}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {cantidadDeRenglon(renglon)}
                      </TableCell>

                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          title={problema}
                          sx={{ color: 'text.secondary' }}
                        >
                          {problema}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Punto color={motivo.color} etiqueta={motivo.etiqueta} />
                      </TableCell>

                      <TableCell>
                        <Punto color={revision.color} etiqueta={revision.etiqueta} />
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
