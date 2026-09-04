import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Alert, Box, Button, Card, LinearProgress, Stack, Typography } from '@mui/material'
import { Link as EnlaceRuta, useLocation } from 'react-router-dom'

import { AccionPendiente } from '@/app/AccionPendiente'
import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { FiltrosActivos } from './FiltrosActivos'
import { FiltrosInventario } from './FiltrosInventario'
import { PanelExistencia } from './PanelExistencia'
import { ResumenEstados } from './ResumenEstados'
import { TablaExistencias, type Fila } from './TablaExistencias'
import type { DatosTipo } from './DetalleTipo'
import {
  useAlmacenes,
  useDetalleExistencia,
  useExistencias,
  useMovimientos,
  useResumenEstados,
  useResumenPendientes,
} from './consultas'
import { filtrosIniciales, hayFiltrosActivos, type Filtros } from './filtros'
import { almacenDesdeNavegacion } from './menu'

export function PaginaInventario() {
  const { data: perfil } = usePerfil()
  const almacenPropio = perfil?.almacen?.id ?? null

  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciales(undefined))
  const [ajustado, setAjustado] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  const [abierta, setAbierta] = useState<Fila | null>(null)

  // El almacén que manda el menú principal al pulsar uno de sus renglones.
  const estadoRuta = useLocation().state as unknown
  const almacenPedido = almacenDesdeNavegacion(estadoRuta)

  // El perfil llega después de la primera pintura y el filtro inicial depende
  // del rol, así que hay que reajustarlo cuando aterriza. Se hace UNA vez: en
  // cuanto la persona toca un filtro manda lo que eligió, no lo que su rol
  // sugería, y un reajuste posterior le movería la pantalla debajo de las manos.
  if (!ajustado && perfil !== undefined) {
    setAjustado(true)
    const base = filtrosIniciales({ rol: perfil.rol, almacenId: perfil.almacen?.id ?? null })
    // Si se llegó desde el menú pulsando un almacén concreto, ese manda sobre
    // el que sugeriría el rol: es lo que la persona acaba de pedir.
    setFiltros(almacenPedido === null ? base : { ...base, almacenId: almacenPedido })
  }

  const almacenes = useAlmacenes()
  const listado = useExistencias(filtros, pagina, porPagina)
  const resumen = useResumenEstados()
  // Lo que falta por cargar del almacén que se está mirando. Es el único aviso
  // de que este inventario no está completo: sin él, 1278 existencias parecen
  // el inventario entero y los 337 renglones apartados no existen para nadie.
  const porDepurar = useResumenPendientes(filtros.almacenId)
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
    setAjustado(true)
    setFiltros(nuevos)
    // Cambiar un filtro y quedarse en la página 7 deja la tabla vacía sin que
    // se entienda por qué.
    setPagina(0)
  }

  // Los filtros con los que arranca esta persona: es a donde vuelve "Limpiar",
  // y no a "todos los almacenes", que para un responsable no es su punto de
  // partida.
  const iniciales = filtrosIniciales(
    perfil === undefined ? undefined : { rol: perfil.rol, almacenId: perfil.almacen?.id ?? null },
  )

  const total = listado.data?.total ?? 0

  return (
    <>
      <EncabezadoPagina
        padre={{ etiqueta: 'Menú principal', ruta: '/' }}
        titulo="Inventario"
        descripcion="Ves los cuatro almacenes; solo puedes editar el tuyo"
        acciones={
          <>
            {porDepurar.data === undefined || porDepurar.data.pendiente === 0 ? null : (
              <Button
                component={EnlaceRuta}
                to="/inventario/depuracion"
                variant="outlined"
                color="warning"
                startIcon={<Icon icon="mdi:clipboard-alert-outline" width={20} />}
              >
                Depurar {porDepurar.data.pendiente}
              </Button>
            )}
            <AccionPendiente etiqueta="Exportar" icono="mdi:download-outline" variante="outlined" />
            <AccionPendiente etiqueta="Nueva existencia" icono="mdi:plus" variante="contained" />
          </>
        }
      >
        <ResumenEstados resumen={resumen.data} />
      </EncabezadoPagina>

      <CuerpoPagina>
        {/* Una sola tarjeta: filtros, lo que está filtrado, la tabla y el pie
            de paginación. Antes eran tres cajas apiladas y el conteo quedaba
            suelto entre dos de ellas. */}
        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 1.5, md: 2.5 }, pt: { xs: 2, md: 2.5 } }}>
            <FiltrosInventario
              filtros={filtros}
              almacenes={almacenes.data ?? []}
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
              <Alert severity="error">
                No se pudo leer el inventario: {listado.error.message}
              </Alert>
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
      </CuerpoPagina>

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
