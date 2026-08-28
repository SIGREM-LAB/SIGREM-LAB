import { useState } from 'react'
import { Alert, Box, Card, LinearProgress, Snackbar, Stack, Typography } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { FiltrosDepuracion } from './FiltrosDepuracion'
import { PanelPendiente, type Guardado, type Resolucion } from './PanelPendiente'
import { ResumenDepuracion } from './ResumenDepuracion'
import { TablaPendientes } from './TablaPendientes'
import {
  useActualizarPendiente,
  useAlmacenes,
  useExistenciaResumen,
  usePendientes,
  useResolverPendiente,
  useResumenPendientes,
} from './consultas'
import { filtrosPendientesIniciales, type FiltrosPendientes, type Pendiente } from './pendientes'

export function PaginaDepuracion() {
  const { data: perfil } = usePerfil()
  const almacenPropio = perfil?.almacen?.id ?? null

  const [filtros, setFiltros] = useState<FiltrosPendientes>(() =>
    filtrosPendientesIniciales(undefined),
  )
  const [ajustado, setAjustado] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  const [abierto, setAbierto] = useState<Pendiente | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // El perfil llega después de la primera pintura y el filtro inicial depende
  // del rol, así que hay que reajustarlo cuando aterriza. Se hace UNA vez: en
  // cuanto la persona toca un filtro manda lo que eligió.
  if (!ajustado && perfil !== undefined) {
    setAjustado(true)
    setFiltros(
      filtrosPendientesIniciales({ rol: perfil.rol, almacenId: perfil.almacen?.id ?? null }),
    )
  }

  const almacenes = useAlmacenes()
  const listado = usePendientes(filtros, pagina, porPagina)
  const resumen = useResumenPendientes(filtros.almacenId)

  // Las dos existencias que el panel puede necesitar: con la que chocó y en la
  // que se convirtió. Cada una en su propia consulta porque cada una tiene su
  // llave, y ninguna se pide hasta que hay panel abierto que la use.
  const choque = useExistenciaResumen(abierto?.existencia_id ?? null)
  const resuelta = useExistenciaResumen(abierto?.existencia_resuelta_id ?? null)

  const resolver = useResolverPendiente()
  const actualizar = useActualizarPendiente()

  const cambiarFiltros = (nuevos: FiltrosPendientes) => {
    setAjustado(true)
    setFiltros(nuevos)
    // Cambiar un filtro y quedarse en la página 7 deja la tabla vacía sin que
    // se entienda por qué.
    setPagina(0)
  }

  // Al cerrar un renglón se cierra el panel y se pasa al siguiente: con el
  // filtro en «sin revisar» el renglón ya no está en la lista, y dejar abierto
  // un panel de algo que ya salió de la cola confunde más de lo que ayuda.
  const cerrarYAvisar = (mensaje: string) => () => {
    setAbierto(null)
    setAviso(mensaje)
  }

  const alResolver = (resolucion: Resolucion) => {
    if (abierto === null) return
    resolver.mutate(
      { pendiente: abierto.id, ...resolucion },
      {
        onSuccess: cerrarYAvisar(
          resolucion.veredicto === 'nueva'
            ? 'El renglón entró al inventario'
            : 'La cantidad se sumó a la existencia con la que chocaba',
        ),
      },
    )
  }

  const alGuardar = (guardado: Guardado) => {
    if (abierto === null) return
    actualizar.mutate(
      { pendiente: abierto.id, ...guardado },
      {
        onSuccess:
          guardado.estado === 'descartado'
            ? cerrarYAvisar('El renglón queda descartado: no se carga')
            : () => setAviso('Corrección guardada; el renglón sigue por revisar'),
      },
    )
  }

  const total = listado.data?.total ?? 0

  return (
    <>
      <EncabezadoPagina
        padre={{ etiqueta: 'Inventario', ruta: '/inventario' }}
        titulo="Depuración"
        descripcion="Los renglones que el cargador no pudo resolver solo. Corrígelos y dales el visto bueno"
      >
        <ResumenDepuracion resumen={resumen.data} />
      </EncabezadoPagina>

      <CuerpoPagina>
        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 1.5, md: 2.5 }, pt: { xs: 2, md: 2.5 } }}>
            <FiltrosDepuracion
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
              minHeight: 52,
            }}
          >
            {/* role="status" hace que un lector de pantalla anuncie cuántos
                quedaron después de filtrar. Sin esto, quien no ve la tabla no se
                entera de que el filtro hizo algo. */}
            <Typography
              role="status"
              variant="body2"
              sx={{ ml: 'auto', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {listado.isPending
                ? 'Buscando…'
                : `${total} ${total === 1 ? 'renglón' : 'renglones'}`}
            </Typography>
          </Stack>

          {listado.error === null ? null : (
            <Box sx={{ px: { xs: 1.5, md: 2.5 }, pb: 2 }}>
              <Alert severity="error">
                No se pudieron leer los pendientes: {listado.error.message}
              </Alert>
            </Box>
          )}

          <Box sx={{ position: 'relative' }}>
            {/* La barra va encima y no en el hueco de la tabla: mientras llega
                la página nueva se sigue viendo la anterior y nada se mueve. */}
            {listado.isFetching ? (
              <LinearProgress
                aria-hidden
                sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1 }}
              />
            ) : null}

            <Box
              sx={{ opacity: listado.isPlaceholderData ? 0.6 : 1, transition: 'opacity 120ms' }}
            >
              <TablaPendientes
                filas={listado.data?.filas ?? []}
                total={total}
                pagina={pagina}
                porPagina={porPagina}
                almacenPropio={almacenPropio}
                almacenes={almacenes.data ?? []}
                cargando={listado.isPending}
                onPagina={setPagina}
                onPorPagina={(n) => {
                  setPorPagina(n)
                  setPagina(0)
                }}
                onAbrir={setAbierto}
              />
            </Box>
          </Box>
        </Card>
      </CuerpoPagina>

      <PanelPendiente
        pendiente={abierto}
        almacenPropio={almacenPropio}
        choque={choque.data}
        resuelta={resuelta.data}
        trabajando={resolver.isPending || actualizar.isPending}
        error={resolver.error ?? actualizar.error}
        onResolver={alResolver}
        onGuardar={alGuardar}
        onCerrar={() => setAbierto(null)}
      />

      <Snackbar
        open={aviso !== null}
        autoHideDuration={4000}
        onClose={() => setAviso(null)}
        message={aviso ?? ''}
      />
    </>
  )
}
