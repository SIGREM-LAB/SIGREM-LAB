import { Icon } from '@iconify/react'
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as EnlaceRuta } from 'react-router-dom'

import { AccionPendiente } from '@/app/AccionPendiente'
import { aspectoDeAlmacen } from '@/app/almacenes'
import { ESTADO } from './presentacion'
import { necesitanAtencion, type Portada } from './menu'

type Props = {
  portada: Portada
  /** `null` cuando la portada es la suma de la Unidad: no hay uno al que ir. */
  almacenId: number | null
}

/** Un tramo de la barra. Los de cero no se dibujan: con `gap` dejan una raya. */
function Tramo({ cuantas, color }: { cuantas: number; color: string }) {
  if (cuantas === 0) return null
  return <Box sx={{ flexGrow: cuantas, flexBasis: 0, bgcolor: color }} />
}

function Leyenda({ cuantas, etiqueta, color }: { cuantas: number; etiqueta: string; color: string }) {
  return (
    <Stack direction="row" spacing={0.875} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography variant="body2">
        <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {cuantas.toLocaleString('es-MX')}
        </Box>{' '}
        {etiqueta}
      </Typography>
    </Stack>
  )
}

/**
 * El bloque grande del menú: el almacén de quien mira, con su desglose y sus
 * acciones. Para admin y consulta, que no tienen almacén propio, es la suma de
 * la Unidad; el reparto lo decide `repartirAlmacenes`, no este componente.
 */
export function TarjetaAlmacen({ portada, almacenId }: Props) {
  const aspecto = aspectoDeAlmacen(portada.clave)
  const atencion = necesitanAtencion(portada)

  // `total` no cuenta las bajas, y el desglose nombrado son tres de los cinco
  // estados vivos: lo que sobra es lo contaminado y lo que está en servicio.
  const otros = Math.max(0, portada.total - portada.disponible - portada.stockBajo - portada.agotado)

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          {portada.clave === null ? (
            <Box sx={{ display: 'inline-flex', color: 'text.secondary' }}>
              <Icon icon={aspecto.icono} width={22} aria-hidden />
            </Box>
          ) : (
            <Box
              sx={{
                px: 1.125,
                py: 0.375,
                borderRadius: 1,
                bgcolor: aspecto.color,
                color: 'common.white',
                fontSize: '0.8125rem',
                fontWeight: 700,
              }}
            >
              {portada.clave}
            </Box>
          )}

          <Typography variant="h2">{portada.nombre}</Typography>

          {/* Tintada y no en guinda sólido: la placa de la clave, que está
              justo al lado, ya es un bloque de color. Dos seguidos compiten
              entre sí y ninguno de los dos se lee primero.

              El token es `primary` y no `institucional` porque aquí el guinda
              trabaja como TINTA sobre la superficie, no como relleno: en
              oscuro, `institucional` daría 2.55:1 sobre el papel. Está
              razonado en tema.ts. */}
          {portada.propio ? (
            <Box
              component="span"
              sx={{
                px: 1,
                py: 0.375,
                borderRadius: 1,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                color: 'primary.main',
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              TU ALMACÉN
            </Box>
          ) : null}
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 4 }}
          sx={{ alignItems: { sm: 'flex-end' }, mt: 2.5 }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.25rem' },
                fontWeight: 700,
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {portada.total.toLocaleString('es-MX')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
              existencias registradas
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            {/* La barra repite lo que dice la leyenda de abajo, así que para un
                lector de pantalla es ruido: los números están ahí al lado. */}
            <Box
              aria-hidden
              sx={{
                display: 'flex',
                gap: '3px',
                height: 10,
                borderRadius: 5,
                overflow: 'hidden',
                bgcolor: 'divider',
              }}
            >
              <Tramo cuantas={portada.disponible} color={ESTADO.disponible.color} />
              <Tramo cuantas={portada.stockBajo} color={ESTADO.stock_bajo.color} />
              <Tramo cuantas={portada.agotado} color={ESTADO.agotado.color} />
              <Tramo cuantas={otros} color={ESTADO.baja.color} />
            </Box>

            <Stack
              direction="row"
              spacing={2.5}
              sx={{ flexWrap: 'wrap', rowGap: 1, mt: 1.5 }}
            >
              <Leyenda cuantas={portada.disponible} etiqueta="disponibles" color={ESTADO.disponible.color} />
              <Leyenda cuantas={portada.stockBajo} etiqueta="stock bajo" color={ESTADO.stock_bajo.color} />
              <Leyenda cuantas={portada.agotado} etiqueta="agotadas" color={ESTADO.agotado.color} />
              {otros === 0 ? null : (
                <Leyenda cuantas={otros} etiqueta="en otro estado" color={ESTADO.baja.color} />
              )}
            </Stack>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 1.25,
            mt: 3,
            pt: 2.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <AccionPendiente
            etiqueta="Registrar movimiento"
            icono="mdi:swap-horizontal"
            variante="contained"
          />

          <Button
            variant="outlined"
            component={EnlaceRuta}
            to="/inventario"
            // El almacén viaja en el state y no en la URL: es una semilla que
            // el inventario lee una vez al montar.
            state={almacenId === null ? undefined : { almacenId }}
            startIcon={<Icon icon="mdi:magnify" width={18} />}
          >
            {portada.clave === null ? 'Ver todo el inventario' : `Ver inventario de ${portada.clave}`}
          </Button>

          {atencion === 0 ? null : (
            <Stack direction="row" spacing={0.875} sx={{ alignItems: 'center', ml: { sm: 'auto' } }}>
              <Box sx={{ display: 'inline-flex', color: ESTADO.stock_bajo.color }}>
                <Icon icon="mdi:alert-outline" width={20} aria-hidden />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {atencion.toLocaleString('es-MX')}
                </Box>{' '}
                {atencion === 1 ? 'existencia necesita' : 'existencias necesitan'} atención
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
