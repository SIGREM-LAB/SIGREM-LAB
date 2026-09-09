import { Icon } from '@iconify/react'
import { Box, ButtonBase, Grid, Skeleton, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

import { aspectoDeAlmacen } from '@/app/almacenes'
import { ESTADO } from './presentacion'
import { necesitanAtencion, type ResumenAlmacen } from './menu'

/**
 * Alto fijo, por lo mismo que el renglón de la tabla: un almacén con aviso de
 * atención trae una línea más que uno sin él, y sin la medida clavada la tarjeta
 * de filtros brinca hacia abajo según qué bodega tenga trabajo pendiente.
 */
const ALTO = 84

type Props = {
  almacenes: ResumenAlmacen[]
  /** El filtro vigente. Con `'todos'` no hay ninguna marcada. */
  seleccionado: number | 'todos'
  /** El almacén de quien mira, para rotularlo. `null` en admin y consulta. */
  almacenPropio: number | null
  onSeleccionar: (almacenId: number | 'todos') => void
  /** Primera carga: se dibujan cuatro huecos con la medida final. */
  cargando?: boolean
}

/**
 * Los cuatro almacenes como filtro.
 *
 * Es un control, no una franja de cifras, y por eso vive en el cuerpo de la
 * pantalla y no bajo el título: la franja de `ResumenEstados` es un `<dl>` de
 * números que a propósito no se mueven con los filtros, y esto sí los cambia.
 *
 * Botones de alternancia y no enlaces: no llevan a ningún sitio, encienden y
 * apagan un filtro de la pantalla en la que ya estás. De ahí `aria-pressed`, que
 * es lo que hace que un lector de pantalla diga cuál está puesto.
 */
export function TiraAlmacenes({
  almacenes,
  seleccionado,
  almacenPropio,
  onSeleccionar,
  cargando = false,
}: Props) {
  if (cargando) {
    return (
      <Grid container spacing={1.5}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 6, md: 3 }}>
            <Skeleton variant="rounded" height={ALTO} />
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <Grid container spacing={1.5} role="group" aria-label="Filtrar por almacén">
      {almacenes.map((almacen) => {
        const aspecto = aspectoDeAlmacen(almacen.clave)
        const activo = seleccionado === almacen.id
        const propio = almacenPropio !== null && almacen.id === almacenPropio
        const atencion = necesitanAtencion(almacen)

        return (
          <Grid key={almacen.id} size={{ xs: 6, md: 3 }}>
            <ButtonBase
              // Pulsar la que ya está puesta la quita: sin esto, para volver a
              // ver los cuatro habría que bajar al selector, y la tira dejaría
              // de ser reversible por donde se usó.
              onClick={() => onSeleccionar(activo ? 'todos' : almacen.id)}
              aria-pressed={activo}
              aria-label={`${almacen.clave}, ${almacen.nombre}. ${almacen.total} existencias${
                atencion === 0 ? '' : `, ${atencion} por atender`
              }`}
              sx={{
                width: '100%',
                height: ALTO,
                px: 1.5,
                justifyContent: 'flex-start',
                borderRadius: 1,
                border: '1px solid',
                // El borde de la activa toma el color del almacén; el relleno va
                // en alfa para que el texto de encima siga cumpliendo contraste
                // en los dos modos del tema.
                borderColor: activo ? aspecto.color : 'divider',
                bgcolor: activo ? alpha(aspecto.color, 0.08) : 'background.paper',
                '&:hover': { bgcolor: alpha(aspecto.color, activo ? 0.12 : 0.04) },
              }}
            >
              <Stack spacing={0.5} sx={{ width: '100%', alignItems: 'flex-start' }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: 'center', width: '100%' }}
                >
                  <Box
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: aspecto.color,
                      color: 'common.white',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {almacen.clave}
                  </Box>

                  {/* Con palabra y no solo con un borde de color, por lo mismo
                      que el estado de la tabla no se fía del color: quien no lo
                      distingue se queda sin el dato. */}
                  {propio ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Tuyo
                    </Typography>
                  ) : null}

                  <Typography
                    sx={{
                      ml: 'auto',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {almacen.total.toLocaleString('es-MX')}
                  </Typography>
                </Stack>

                {atencion === 0 ? (
                  // El hueco se conserva para que las cuatro midan igual.
                  <Box sx={{ height: 18 }} />
                ) : (
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Box sx={{ display: 'inline-flex', color: ESTADO.stock_bajo.color }}>
                      <Icon icon="mdi:alert-outline" width={16} aria-hidden />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {atencion.toLocaleString('es-MX')} por atender
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </ButtonBase>
          </Grid>
        )
      })}
    </Grid>
  )
}
