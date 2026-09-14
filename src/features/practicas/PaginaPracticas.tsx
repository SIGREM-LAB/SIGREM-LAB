import { Icon } from '@iconify/react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  TablePagination,
} from '@mui/material'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import {
  useBorradores,
  useBorrarBorrador,
  useDetallePractica,
  useHistorialPracticas,
} from './consultas'
import { componerHistorial, filaDeBorrador } from './historial'
import { PanelPractica } from './PanelPractica'
import { TablaPracticas } from './TablaPracticas'

/** El mismo tamaño de página que Inventario: una pantalla llena, sin desbordar. */
const POR_PAGINA = 25

export function PaginaPracticas() {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [pagina, setPagina] = useState(0)
  const [viendo, setViendo] = useState<number | null>(null)
  // Los ids a descartar, en singular o plural: un renglón en curso o todas las
  // capturas ilegibles de una vez. `null` es "no hay confirmación abierta".
  const [descartando, setDescartando] = useState<number[] | null>(null)

  // El folio de la práctica recién registrada llega en el estado de la
  // navegación: es lo único que el formulario sabía y esta pantalla no.
  const folioRecien = (ubicacion.state as { folio?: string } | null)?.folio ?? null
  const [avisoCerrado, setAvisoCerrado] = useState(false)

  const historial = useHistorialPracticas(pagina, POR_PAGINA)
  const borradores = useBorradores()
  const detalle = useDetallePractica(viendo)
  const borrar = useBorrarBorrador()

  const lista = borradores.data ?? []
  const filas = componerHistorial(lista, historial.data?.filas ?? [])

  // Borradores guardados con una forma que esta versión ya no sabe leer. No
  // pintan renglón —`filaDeBorrador` devuelve null— así que sin este aviso
  // desaparecerían sin dejar rastro. Antes había uno solo; ahora puede haber
  // varios, y por eso el aviso cuenta y descarta en bloque.
  const ilegibles = lista.filter((b) => filaDeBorrador(b) === null)

  function descartar() {
    if (descartando !== null) borrar.mutate(descartando)
    setDescartando(null)
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Prácticas"
        descripcion="Lo registrado en tu almacén, y las capturas en curso"
        acciones={
          // Siempre empezar una nueva: hay varias capturas a la vez, así que este
          // botón no pisa ninguna. Continuar una existente se hace desde su
          // renglón en la tabla.
          <Button
            variant="contained"
            startIcon={<Icon icon="mdi:plus" />}
            onClick={() => navegar('/practicas/nueva')}
          >
            Registrar práctica
          </Button>
        }
      />

      <CuerpoPagina>
        {ilegibles.length === 0 ? null : (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => setDescartando(ilegibles.map((b) => b.id))}>
                {ilegibles.length === 1 ? 'Descartarlo' : 'Descartarlas'}
              </Button>
            }
          >
            {ilegibles.length === 1
              ? 'Tienes una captura de una versión anterior y ya no se puede recuperar.'
              : `Tienes ${ilegibles.length} capturas de una versión anterior y ya no se pueden recuperar.`}
          </Alert>
        )}

        <Card>
          <CardContent>
            <TablaPracticas
              filas={filas}
              cargando={historial.isFetching}
              error={historial.error}
              onVer={setViendo}
              onContinuar={(borradorId) => navegar(`/practicas/nueva/${borradorId}`)}
              onDescartar={(borradorId) => setDescartando([borradorId])}
            />

            <TablePagination
              component="div"
              // Los renglones en curso no entran en la cuenta: no son filas que
              // la consulta trajo, y sumarlos desalinearía el total.
              count={historial.data?.total ?? 0}
              page={pagina}
              onPageChange={(_e, n) => setPagina(n)}
              rowsPerPage={POR_PAGINA}
              rowsPerPageOptions={[POR_PAGINA]}
              labelRowsPerPage="Por página"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </CardContent>
        </Card>
      </CuerpoPagina>

      {viendo === null ? null : (
        <PanelPractica
          detalle={detalle.data}
          cargando={detalle.isFetching}
          error={detalle.error}
          onCerrar={() => setViendo(null)}
        />
      )}

      <Dialog open={descartando !== null} onClose={() => setDescartando(null)}>
        <DialogTitle>
          {(descartando?.length ?? 0) > 1
            ? '¿Descartar las capturas en curso?'
            : '¿Descartar la práctica en curso?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se pierde lo capturado hasta ahora y no se puede recuperar. Lo ya registrado no se
            toca.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDescartando(null)}>Conservar</Button>
          <Button onClick={descartar} color="error">
            Descartar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={folioRecien !== null && !avisoCerrado}
        autoHideDuration={6000}
        onClose={() => setAvisoCerrado(true)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setAvisoCerrado(true)}>
          {`Práctica ${folioRecien} registrada`}
        </Alert>
      </Snackbar>
    </>
  )
}
