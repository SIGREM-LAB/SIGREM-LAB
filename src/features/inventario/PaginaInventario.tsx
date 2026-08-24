import { useState } from 'react'
import { Alert, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material'

import { usePerfil } from '@/features/auth/usePerfil'
import { FiltrosInventario } from './FiltrosInventario'
import { PanelExistencia } from './PanelExistencia'
import { TablaExistencias, type Fila } from './TablaExistencias'
import type { DatosTipo } from './DetalleTipo'
import { useAlmacenes, useDetalleExistencia, useExistencias, useMovimientos } from './consultas'
import { filtrosIniciales, type Filtros } from './filtros'

export function PaginaInventario() {
  const { data: perfil } = usePerfil()
  const almacenPropio = perfil?.almacen?.id ?? null

  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciales(undefined))
  const [ajustado, setAjustado] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  const [abierta, setAbierta] = useState<Fila | null>(null)

  // El perfil llega después de la primera pintura y el filtro inicial depende
  // del rol, así que hay que reajustarlo cuando aterriza. Se hace UNA vez: en
  // cuanto la persona toca un filtro manda lo que eligió, no lo que su rol
  // sugería, y un reajuste posterior le movería la pantalla debajo de las manos.
  if (!ajustado && perfil !== undefined) {
    setAjustado(true)
    setFiltros(filtrosIniciales({ rol: perfil.rol, almacenId: perfil.almacen?.id ?? null }))
  }

  const almacenes = useAlmacenes()
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
    setAjustado(true)
    setFiltros(nuevos)
    // Cambiar un filtro y quedarse en la página 7 deja la tabla vacía sin que
    // se entienda por qué.
    setPagina(0)
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h1">Inventario</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Ves los cuatro almacenes; solo puedes editar el tuyo
        </Typography>
      </Stack>

      <Card>
        <CardContent>
          <FiltrosInventario
            filtros={filtros}
            almacenes={almacenes.data ?? []}
            onCambio={cambiarFiltros}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {/* role="status" hace que un lector de pantalla anuncie cuántos
              resultados quedaron después de filtrar. Sin esto, quien no ve la
              tabla no se entera de que la búsqueda hizo algo. */}
          <Typography role="status" variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            {listado.isPending
              ? 'Buscando…'
              : `${listado.data?.total ?? 0} ${listado.data?.total === 1 ? 'existencia' : 'existencias'}`}
          </Typography>

          {listado.error !== null && (
            <Alert severity="error">No se pudo leer el inventario: {listado.error.message}</Alert>
          )}

          {listado.isPending && <Skeleton variant="rounded" height={320} />}

          {listado.data !== undefined && (
            <TablaExistencias
              filas={listado.data.filas}
              total={listado.data.total}
              pagina={pagina}
              porPagina={porPagina}
              almacenPropio={almacenPropio}
              onPagina={setPagina}
              onPorPagina={(n) => {
                setPorPagina(n)
                setPagina(0)
              }}
              onAbrir={setAbierta}
            />
          )}
        </CardContent>
      </Card>

      <PanelExistencia
        fila={abierta}
        almacenPropio={almacenPropio}
        movimientos={movimientos.data ?? []}
        cargandoMovimientos={movimientos.isPending && abierta !== null}
        datosTipo={datosTipo}
        onCerrar={() => setAbierta(null)}
      />
    </Stack>
  )
}
