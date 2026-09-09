import { useState } from 'react'
import { Alert, Box, Card, LinearProgress, Stack, Typography } from '@mui/material'

import { FiltrosActivos } from './FiltrosActivos'
import { FiltrosInventario } from './FiltrosInventario'
import { PanelExistencia } from './PanelExistencia'
import { TablaExistencias, type Fila } from './TablaExistencias'
import { TiraAlmacenes } from './TiraAlmacenes'
import type { DatosTipo } from './DetalleTipo'
import {
  useAlmacenes,
  useDetalleExistencia,
  useExistencias,
  useMovimientos,
  useResumenAlmacenes,
} from './consultas'
import { filtrosIniciales, hayFiltrosActivos, type Filtros } from './filtros'

type Props = {
  /**
   * Fija el almacén y esconde lo que sobra cuando solo hay uno: su columna, su
   * selector, su chip y la tira. `null` = los cuatro, filtrables.
   *
   * Es la ÚNICA rama de este componente. Entra por aquí, decide esas cuatro
   * cosas, y no vuelve a aparecer más adentro. Si algún día hay que ramificar en
   * el interior, es la señal de que el reparto entre las dos pantallas se eligió
   * mal.
   */
  almacenFijo: number | null

  /**
   * El almacén de quien mira, para marcar lo ajeno con el ojito. `null` en admin
   * y consulta, que no tienen uno contra el que contrastar.
   *
   * En Inventario vale lo mismo que `almacenFijo` —tu bodega, anclada—; en
   * Inventario general aquél es `null` y éste sigue siendo el tuyo.
   */
  almacenPropio: number | null

  /**
   * El almacén con el que llega quien viene pulsando una bodega en el menú
   * principal. Se lee UNA vez, al montar: es una semilla, no un filtro impuesto,
   * y en cuanto la persona toca otra cosa manda lo que eligió.
   */
  almacenSemilla?: number | null
}

/**
 * La tabla de existencias con sus filtros: todo lo que comparten Inventario e
 * Inventario general.
 *
 * Lo que NO vive aquí son las consultas que no deben moverse con los filtros
 * —las cifras de la cabecera y el conteo de pendientes—. Ésas viven en cada
 * página, que es de donde sale el dato del que dependen; metidas aquí tendrían
 * que salir a empujones cada vez que alguien tecleara en el buscador.
 */
export function ListadoExistencias({ almacenFijo, almacenPropio, almacenSemilla }: Props) {
  const cruzaAlmacenes = almacenFijo === null

  // A dónde vuelve "Limpiar". La semilla del menú NO cuenta: llegar filtrado por
  // N4 y querer ver los cuatro es exactamente para lo que se pulsa ese botón.
  const iniciales: Filtros = { ...filtrosIniciales(), almacenId: almacenFijo ?? 'todos' }

  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...iniciales,
    almacenId: almacenFijo ?? almacenSemilla ?? 'todos',
  }))
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  const [abierta, setAbierta] = useState<Fila | null>(null)

  const almacenes = useAlmacenes()
  const resumenAlmacenes = useResumenAlmacenes(cruzaAlmacenes)
  const listado = useExistencias(filtros, pagina, porPagina)
  const movimientos = useMovimientos(abierta?.id ?? null)
  const detalle = useDetalleExistencia(abierta?.id ?? null)

  // Se aplana aqui, en un solo sitio, y no dentro del panel: la forma anidada
  // que devuelve PostgREST es un detalle de la consulta, y si el componente la
  // conociera, cambiar el `select` lo romperia.
  const datosTipo: DatosTipo | null = detalle.data
    ? {
        cas: detalle.data.articulo?.articulo_reactivo?.cas ?? null,
        estadoFisico: detalle.data.articulo?.articulo_reactivo?.estado_fisico ?? null,
        colorAlmacenaje: detalle.data.articulo?.articulo_reactivo?.color_almacenaje ?? null,
        tieneHojaSeguridad: detalle.data.articulo?.articulo_reactivo?.tiene_hoja_seguridad ?? null,
        riesgoSalud: detalle.data.articulo?.articulo_reactivo?.riesgo_salud ?? null,
        riesgoInflamabilidad:
          detalle.data.articulo?.articulo_reactivo?.riesgo_inflamabilidad ?? null,
        riesgoReactividad: detalle.data.articulo?.articulo_reactivo?.riesgo_reactividad ?? null,
        numeroSerie: detalle.data.numero_serie,
        numeroInventario: detalle.data.numero_inventario_uaeh,
        funcionamiento: detalle.data.funcionamiento,
        fechaChequeo: detalle.data.fecha_chequeo,
        metodoConservacion: detalle.data.metodo_conservacion,
        temperatura: detalle.data.temperatura,
        origenEspecie: detalle.data.articulo?.articulo_biologico?.origen_especie ?? null,
      }
    : null

  const cambiarFiltros = (nuevos: Filtros) => {
    setFiltros(nuevos)
    // Cambiar un filtro y quedarse en la página 7 deja la tabla vacía sin que
    // se entienda por qué.
    setPagina(0)
  }

  const total = listado.data?.total ?? 0

  return (
    <>
      <Stack spacing={2}>
        {cruzaAlmacenes ? (
          <TiraAlmacenes
            almacenes={resumenAlmacenes.data ?? []}
            seleccionado={filtros.almacenId}
            almacenPropio={almacenPropio}
            cargando={resumenAlmacenes.isPending}
            onSeleccionar={(almacenId) => cambiarFiltros({ ...filtros, almacenId })}
          />
        ) : null}

        {/* Una sola tarjeta: filtros, lo que está filtrado, la tabla y el pie
            de paginación. Antes eran tres cajas apiladas y el conteo quedaba
            suelto entre dos de ellas. */}
        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 1.5, md: 2.5 }, pt: { xs: 2, md: 2.5 } }}>
            <FiltrosInventario
              filtros={filtros}
              almacenes={almacenes.data ?? []}
              mostrarAlmacen={cruzaAlmacenes}
              onCambio={cambiarFiltros}
            />
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              rowGap: 1,
              px: { xs: 1.5, md: 2.5 },
              py: 1.5,
              // Fija para que la fila no cambie de alto entre tener chips y no
              // tenerlos.
              minHeight: 60,
            }}
          >
            <FiltrosActivos
              filtros={filtros}
              almacenes={almacenes.data ?? []}
              mostrarAlmacen={cruzaAlmacenes}
              onCambio={cambiarFiltros}
              onLimpiar={
                hayFiltrosActivos(filtros, iniciales) ? () => cambiarFiltros(iniciales) : undefined
              }
            />

            {/* role="status" hace que un lector de pantalla anuncie cuántos
                resultados quedaron después de filtrar. Sin esto, quien no ve la
                tabla no se entera de que la búsqueda hizo algo. */}
            <Typography
              role="status"
              variant="body2"
              sx={{ ml: 'auto', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {listado.isPending
                ? 'Buscando…'
                : `${total} ${total === 1 ? 'existencia' : 'existencias'}`}
            </Typography>
          </Stack>

          {listado.error === null ? null : (
            <Box sx={{ px: { xs: 1.5, md: 2.5 }, pb: 2 }}>
              <Alert severity="error">No se pudo leer el inventario: {listado.error.message}</Alert>
            </Box>
          )}

          <Box sx={{ position: 'relative' }}>
            {/* La barra va encima, no en el hueco de la tabla: mientras llega
                la página nueva se sigue viendo la anterior y nada se mueve. */}
            {listado.isFetching ? (
              <LinearProgress
                aria-hidden
                sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1 }}
              />
            ) : null}

            <Box
              sx={{
                opacity: listado.isPlaceholderData ? 0.6 : 1,
                transition: 'opacity 120ms',
              }}
            >
              <TablaExistencias
                filas={listado.data?.filas ?? []}
                total={total}
                pagina={pagina}
                porPagina={porPagina}
                almacenPropio={almacenPropio}
                mostrarAlmacen={cruzaAlmacenes}
                cargando={listado.isPending}
                onPagina={setPagina}
                onPorPagina={(n) => {
                  setPorPagina(n)
                  setPagina(0)
                }}
                onAbrir={setAbierta}
              />
            </Box>
          </Box>
        </Card>
      </Stack>

      <PanelExistencia
        fila={abierta}
        almacenPropio={almacenPropio}
        movimientos={movimientos.data ?? []}
        cargandoMovimientos={movimientos.isPending && abierta !== null}
        datosTipo={datosTipo}
        onCerrar={() => setAbierta(null)}
      />
    </>
  )
}
