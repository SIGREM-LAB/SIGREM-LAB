import { Icon } from '@iconify/react'
import { Alert, Grid, Skeleton, Stack } from '@mui/material'

import { AccionPendiente } from '@/app/AccionPendiente'
import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { menuDeNavegacion } from '@/app/navegacion'
import { usePerfil } from '@/features/auth/usePerfil'
import { AtajosPendientes } from './AtajosPendientes'
import { OtrosAlmacenes } from './OtrosAlmacenes'
import { TarjetaAlmacen } from './TarjetaAlmacen'
import { useResumenAlmacenes } from './consultas'
import { repartirAlmacenes } from './menu'

/** Alto de cada hueco mientras carga, para que la pantalla no se recoloque. */
const ALTO_PORTADA = 252
const ALTO_ATAJO = 76

/**
 * El menú principal: tu almacén primero.
 *
 * La pantalla sigue la forma del permiso y no una preferencia de composición.
 * Se edita uno y se consultan cuatro, así que el propio ocupa el bloque grande
 * con sus acciones y los demás quedan en una lista de consulta al lado.
 */
export function PaginaInicio() {
  const { data: perfil } = usePerfil()
  const resumen = useResumenAlmacenes()

  const almacenPropio = perfil?.almacen?.id ?? null

  const encabezado = (
    <EncabezadoPagina
      titulo={perfil?.nombre === undefined ? 'Hola' : `Hola, ${perfil.nombre}`}
      // El lema largo es el mismo que la pantalla de acceso: nombra las cinco
      // clasificaciones. La versión corta que traía esta rama se dejaba fuera
      // insumos y materia biológica, y decía otra cosa que la puerta de entrada.
      descripcion="Sistema Integral de Gestión de Reactivos, Materiales, Insumos, Equipos y Materia Biológica"
      acciones={
        <AccionPendiente etiqueta="Nueva existencia" icono="mdi:plus" variante="contained" />
      }
    />
  )

  if (resumen.isPending) {
    return (
      <>
        {encabezado}
        <CuerpoPagina>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Skeleton variant="rounded" height={ALTO_PORTADA} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Skeleton variant="rounded" height={ALTO_PORTADA} />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              {[0, 1, 2].map((i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Skeleton variant="rounded" height={ALTO_ATAJO} />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </CuerpoPagina>
      </>
    )
  }

  if (resumen.error) {
    return (
      <>
        {encabezado}
        <CuerpoPagina>
          <Alert severity="error">No se pudo leer el inventario: {resumen.error.message}</Alert>
        </CuerpoPagina>
      </>
    )
  }

  const { portada, otros } = repartirAlmacenes(resumen.data, almacenPropio)
  const pendientes = menuDeNavegacion(perfil?.rol).filter((item) => !item.disponible)

  // El aviso mira los cuatro, no solo la portada: que el almacén de quien entra
  // esté vacío no significa que no se haya cargado nada.
  const vacio = resumen.data.every((almacen) => almacen.total === 0)

  return (
    <>
      {encabezado}

      <CuerpoPagina>
        <Stack spacing={2}>
          {portada === null ? null : (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TarjetaAlmacen
                  portada={portada}
                  // Sin almacén propio la portada es la suma de la Unidad, y
                  // entonces no hay uno concreto al que llevar el inventario.
                  almacenId={portada.propio ? almacenPropio : null}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <OtrosAlmacenes
                  almacenes={otros}
                  titulo={portada.propio ? 'Otros almacenes' : 'Almacenes'}
                  subtitulo={portada.propio ? 'Solo consulta' : 'Toda la Unidad'}
                />
              </Grid>
            </Grid>
          )}

          <AtajosPendientes items={pendientes} />

          {vacio ? (
            <Alert severity="info" icon={<Icon icon="mdi:database-import-outline" width={20} />}>
              Los almacenes están dados de alta, pero todavía no se cargan las existencias de los
              Excel: esa migración entra después de la reunión, cuando quede claro qué columnas se
              conservan.
            </Alert>
          ) : null}
        </Stack>
      </CuerpoPagina>
    </>
  )
}
