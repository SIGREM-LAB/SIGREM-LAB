import { useState } from 'react'
import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'

import type { DatosEtiqueta } from '@/features/etiquetas/codigo'
import { HojaEtiquetas } from '@/features/etiquetas/HojaEtiquetas'

import { DialogoEditarExistencia } from './DialogoEditarExistencia'
import { DialogoMovimiento } from './DialogoMovimiento'
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
  useLeerEtiquetas,
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

  /**
   * Si el detalle ofrece corregir la existencia. Hoy solo Inventario, que está
   * anclado a tu bodega y donde todo lo que ves es tuyo. Inventario general
   * cruza los cuatro almacenes y tendrá su propia acción.
   *
   * Aunque estuviera encendido de más, la RLS es la que manda: un responsable
   * solo puede escribir en su almacén. Esto evita ofrecer un botón que iba a
   * terminar en un error.
   */
  permiteEditar?: boolean

  /**
   * Si el detalle ofrece registrar un movimiento. Hoy lo enciende Inventario
   * general, y solo para quien puede escribir: `lectura@` no tiene almacén
   * propio, así que sin esta condición vería un botón que la RLS le rechaza.
   * El almacén ajeno ya lo filtra el propio panel.
   */
  permiteMovimiento?: boolean

  /**
   * El código que llega de un escaneo (`?codigo=`). Como la semilla del
   * almacén, se lee al montar: la página monta de nuevo el listado en cada
   * escaneo. Si encuentra una sola existencia, abre su panel.
   */
  codigoInicial?: string
}

/** Arriba de esto, imprimir en lote pide confirmación: es mucha cinta. */
const LOTE_SIN_CONFIRMAR = 50

/**
 * La tabla de existencias con sus filtros: todo lo que comparten Inventario e
 * Inventario general.
 *
 * Lo que NO vive aquí son las consultas que no deben moverse con los filtros
 * —las cifras de la cabecera y el conteo de pendientes—. Ésas viven en cada
 * página, que es de donde sale el dato del que dependen; metidas aquí tendrían
 * que salir a empujones cada vez que alguien tecleara en el buscador.
 */
export function ListadoExistencias({
  almacenFijo,
  almacenPropio,
  almacenSemilla,
  permiteEditar = false,
  permiteMovimiento = false,
  codigoInicial = '',
}: Props) {
  const cruzaAlmacenes = almacenFijo === null

  // A dónde vuelve "Limpiar". La semilla del menú NO cuenta: llegar filtrado por
  // N4 y querer ver los cuatro es exactamente para lo que se pulsa ese botón.
  const iniciales: Filtros = { ...filtrosIniciales(), almacenId: almacenFijo ?? 'todos' }

  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...iniciales,
    almacenId: almacenFijo ?? almacenSemilla ?? 'todos',
    codigo: codigoInicial,
  }))
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  // El panel guarda el ID, no la fila. La fila se busca en el listado cada vez
  // que se pinta: así, cuando una corrección invalida la tabla, el detalle que
  // está abierto detrás se entera. Con una copia guardada aquí seguiría
  // enseñando la marca y el saldo de antes de guardar.
  const [abiertaId, setAbiertaId] = useState<number | null>(null)

  // Tras un escaneo el panel se abre solo, una vez. Al cerrarlo ya no vuelve.
  const [abrirEscaneada, setAbrirEscaneada] = useState(codigoInicial !== '')

  // Impresión en lote: lo que se va a imprimir, y la confirmación si es mucho.
  const [porConfirmar, setPorConfirmar] = useState<DatosEtiqueta[] | null>(null)
  const [imprimiendo, setImprimiendo] = useState<DatosEtiqueta[] | null>(null)
  const leerEtiquetas = useLeerEtiquetas()

  // Se edita la fila que se abrió, en su propio estado: el panel se queda
  // detrás y al cerrar el diálogo se vuelve a él con el dato ya corregido.
  const [editando, setEditando] = useState<Fila | null>(null)

  // Lo mismo para el movimiento: se registra sobre la fila que está abierta.
  const [moviendo, setMoviendo] = useState<Fila | null>(null)

  // Lo último que se guardó, ya escrito como frase. Es el mismo aviso que da el
  // alta, y por la misma razón: quien guarda tiene que saber que se guardó sin
  // ir a buscarlo en la tabla.
  const [aviso, setAviso] = useState<string | null>(null)

  const almacenes = useAlmacenes()
  const resumenAlmacenes = useResumenAlmacenes(cruzaAlmacenes)
  const listado = useExistencias(filtros, pagina, porPagina)

  const filas = listado.data?.filas ?? []
  const escaneada =
    abrirEscaneada && filtros.codigo !== '' && filas.length === 1 ? filas[0].id : null
  const idAbierta = abiertaId ?? escaneada

  const abierta: Fila | null =
    idAbierta === null ? null : (filas.find((f) => f.id === idAbierta) ?? null)

  const movimientos = useMovimientos(idAbierta)
  const detalle = useDetalleExistencia(idAbierta)

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
  const noEncontrada = filtros.codigo !== '' && listado.isSuccess && total === 0

  // Estable entre renders: `HojaEtiquetas` lo usa en la dependencia de su
  // efecto, y uno nuevo en cada render volvería a abrir el diálogo de impresión.
  const [terminarImpresion] = useState(() => () => setImprimiendo(null))

  function imprimirLote() {
    leerEtiquetas.mutate(filtros, {
      onSuccess: (etiquetas) => {
        if (etiquetas.length > LOTE_SIN_CONFIRMAR) setPorConfirmar(etiquetas)
        else if (etiquetas.length > 0) setImprimiendo(etiquetas)
      },
    })
  }

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
            <Button
              size="small"
              sx={{ ml: 'auto' }}
              startIcon={<Icon icon="mdi:qrcode" width={18} />}
              disabled={total === 0}
              loading={leerEtiquetas.isPending}
              onClick={imprimirLote}
            >
              Imprimir etiquetas
            </Button>

            <Typography
              role="status"
              variant="body2"
              sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {listado.isPending
                ? 'Buscando…'
                : `${total} ${total === 1 ? 'existencia' : 'existencias'}`}
            </Typography>
          </Stack>

          {noEncontrada ? (
            <Box sx={{ px: { xs: 1.5, md: 2.5 }, pb: 2 }}>
              <Alert severity="warning">
                No se encontró {filtros.codigo} en tu inventario. Puede ser de otro almacén, o
                el código está mal escrito.
              </Alert>
            </Box>
          ) : null}

          {leerEtiquetas.error === null ? null : (
            <Box sx={{ px: { xs: 1.5, md: 2.5 }, pb: 2 }}>
              <Alert severity="error">
                No se pudieron leer las etiquetas: {leerEtiquetas.error.message}
              </Alert>
            </Box>
          )}

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
                onAbrir={(fila) => setAbiertaId(fila.id)}
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
        onCerrar={() => {
          setAbiertaId(null)
          setAbrirEscaneada(false)
        }}
        onEditar={permiteEditar ? () => setEditando(abierta) : undefined}
        onMovimiento={permiteMovimiento ? () => setMoviendo(abierta) : undefined}
      />

      <DialogoEditarExistencia
        fila={editando}
        onCerrar={() => setEditando(null)}
        onGuardada={(codigo) => setAviso(`Cambios guardados en ${codigo}`)}
      />

      <DialogoMovimiento
        fila={moviendo}
        onCerrar={() => setMoviendo(null)}
        onRegistrado={(resumen) => setAviso(`Movimiento registrado: ${resumen}`)}
      />

      <Dialog open={porConfirmar !== null} onClose={() => setPorConfirmar(null)}>
        <DialogTitle>¿Imprimir {porConfirmar?.length} etiquetas?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Son todas las existencias que deja el filtro actual, no sólo las de esta página.
            Revisa que la Brother tenga cinta suficiente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPorConfirmar(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              setImprimiendo(porConfirmar)
              setPorConfirmar(null)
            }}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>

      {imprimiendo === null ? null : (
        <HojaEtiquetas etiquetas={imprimiendo} onTerminar={terminarImpresion} />
      )}

      <Snackbar
        open={aviso !== null}
        autoHideDuration={6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      </Snackbar>
    </>
  )
}
