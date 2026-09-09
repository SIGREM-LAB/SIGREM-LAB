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
import { useBorrador, useBorrarBorrador, useDetallePractica, useHistorialPracticas } from './consultas'
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
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  // El folio de la práctica recién registrada llega en el estado de la
  // navegación: es lo único que el formulario sabía y esta pantalla no.
  const folioRecien = (ubicacion.state as { folio?: string } | null)?.folio ?? null
  const [avisoCerrado, setAvisoCerrado] = useState(false)

  const historial = useHistorialPracticas(pagina, POR_PAGINA)
  const borrador = useBorrador()
  const detalle = useDetallePractica(viendo)
  const borrar = useBorrarBorrador()

  const filas = componerHistorial(borrador.data?.contenido, historial.data?.filas ?? [])
  const hayBorrador = filaDeBorrador(borrador.data?.contenido) !== null

  // Hay un borrador guardado, pero de una forma que esta versión ya no sabe
  // leer. No pinta renglón —`filaDeBorrador` devuelve null— así que sin este
  // aviso desaparecería sin dejar rastro: el botón diría "Registrar" y el
  // trabajo viejo seguiría ocupando la única ranura de borrador que hay.
  const borradorIlegible =
    borrador.data !== null && borrador.data !== undefined && !hayBorrador

  function descartar() {
    setConfirmandoDescarte(false)
    borrar.mutate()
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Prácticas"
        descripcion="Lo registrado en tu almacén, y la captura en curso"
        acciones={
          // El botón nombra lo que hay. Con un borrador vivo no se ofrece
          // empezar otra: el borrador es uno por persona, así que "Registrar"
          // sería ofrecer pisarlo en silencio. Para empezar otra hay que
          // descartar la de en curso, desde su renglón y a propósito.
          <Button
            variant="contained"
            startIcon={<Icon icon={hayBorrador ? 'mdi:pencil' : 'mdi:plus'} />}
            onClick={() => navegar('/practicas/nueva')}
          >
            {hayBorrador ? 'Continuar práctica' : 'Registrar práctica'}
          </Button>
        }
      />

      <CuerpoPagina>
        {borradorIlegible ? (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => borrar.mutate()}>
                Descartarlo
              </Button>
            }
          >
            Tienes un borrador de una versión anterior y ya no se puede recuperar.
          </Alert>
        ) : null}

        <Card>
          <CardContent>
            <TablaPracticas
              filas={filas}
              cargando={historial.isFetching}
              error={historial.error}
              onVer={setViendo}
              onContinuar={() => navegar('/practicas/nueva')}
              onDescartar={() => setConfirmandoDescarte(true)}
            />

            <TablePagination
              component="div"
              // El renglón en curso no entra en la cuenta: no es una de las
              // filas que la consulta trajo, y sumarlo desalinearía el total.
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

      <Dialog open={confirmandoDescarte} onClose={() => setConfirmandoDescarte(false)}>
        <DialogTitle>¿Descartar la práctica en curso?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se pierde lo capturado hasta ahora y no se puede recuperar. Lo ya registrado no se
            toca.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmandoDescarte(false)}>Conservar</Button>
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
