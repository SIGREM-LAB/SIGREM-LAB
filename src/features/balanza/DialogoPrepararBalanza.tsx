import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'

/**
 * El instalador del driver de FTDI, servido por la propia app.
 *
 * Vive en `public/drivers/`, que es lo único que Vite publica. No se enlaza al
 * sitio de FTDI porque ahí hay que elegir entre varias descargas en una tabla
 * en inglés, y quien va a hacer esto es el responsable de un almacén, solo.
 */
export const RUTA_INSTALADOR = '/drivers/CDM2123620_Setup.exe'

type Props = {
  abierto: boolean
  onCerrar: () => void
  /**
   * Vuelve a intentar la conexión. `sinFiltro` ofrece todos los puertos y no
   * solo los del adaptador FTDI.
   */
  onReintentar: (sinFiltro?: boolean) => Promise<void>
}

/** Un paso numerado. El número va en un círculo para que se lea como una lista. */
function Paso({ numero, titulo, children }: { numero: number; titulo: string; children?: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Box
        sx={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {numero}
      </Box>
      <Box sx={{ pt: 0.25 }}>
        <Typography variant="subtitle2">{titulo}</Typography>
        {children}
      </Box>
    </Stack>
  )
}

/**
 * Qué hacer cuando no aparece ninguna balanza.
 *
 * Sale cuando conectar termina en `sin-puerto`, que significa que no apareció
 * ningún puerto serie. Eso lo causan dos cosas —el cable desenchufado o el
 * driver sin instalar— y la app no puede distinguirlas: un dispositivo sin
 * driver no es un puerto, así que Web Serial ni lo ve. Por eso esto no
 * diagnostica, guía, y lo hace en orden de probabilidad.
 *
 * Los cuadros de diálogo de Windows se nombran tal cual salen. Anticiparlos por
 * su nombre es la diferencia entre seguir y abandonar a medias.
 */
export function DialogoPrepararBalanza({ abierto, onCerrar, onReintentar }: Props) {
  const [reintentando, setReintentando] = useState(false)

  async function reintentar(sinFiltro?: boolean) {
    setReintentando(true)
    try {
      await onReintentar(sinFiltro)
    } finally {
      setReintentando(false)
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle>No aparece ninguna balanza</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Alert severity="info" icon={<Icon icon="mdi:scale-balance" />}>
            Casi siempre es una de estas dos cosas. Pruébalas en orden.
          </Alert>

          <Paso numero={1} titulo="Revisa el cable">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              El adaptador tiene que estar enchufado a un puerto USB de esta computadora y su otro
              extremo, al conector de la balanza. La balanza, encendida.
            </Typography>
          </Paso>

          <Paso numero={2} titulo="Instala el driver: una sola vez por computadora">
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Si es la primera vez que usas la balanza en esta computadora, Windows todavía no sabe
              qué es el adaptador. Este programa se lo enseña.
            </Typography>

            <Button
              component="a"
              href={RUTA_INSTALADOR}
              download
              variant="contained"
              startIcon={<Icon icon="mdi:download" />}
            >
              Descargar el instalador
            </Button>

            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
              Te va a preguntar tres cosas, en este orden:
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 3 }}>
              <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
                Chrome puede avisar de que es un programa: elige <strong>Conservar</strong>.
              </Typography>
              <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
                Windows pregunta «¿Quieres permitir que esta aplicación haga cambios en el
                dispositivo?»: <strong>Sí</strong>.
              </Typography>
              <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
                El asistente de FTDI: <strong>Siguiente</strong>, acepta la licencia y{' '}
                <strong>Finalizar</strong>.
              </Typography>
            </Box>
          </Paso>

          <Paso numero={3} titulo="Desenchufa el adaptador y vuelve a enchufarlo">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Este paso hace falta de verdad: Windows no vuelve a mirar un aparato que ya estaba
              conectado antes de instalar el driver.
            </Typography>
          </Paso>

          <Paso numero={4} titulo="Vuelve a intentarlo">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Con el botón de abajo. No hace falta recargar la página ni volver a capturar nada.
            </Typography>
          </Paso>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        {/* La salida para el almacén que acabe con otro adaptador. Va en letra
            pequeña porque es el caso raro: hoy los cuatro usan el mismo. */}
        <Link
          component="button"
          type="button"
          variant="body2"
          underline="hover"
          color="text.secondary"
          disabled={reintentando}
          onClick={() => void reintentar(true)}
        >
          Mi adaptador no es FTDI
        </Link>

        <Stack direction="row" spacing={1}>
          <Button onClick={onCerrar} color="inherit">
            Cerrar
          </Button>
          <Button variant="contained" disabled={reintentando} onClick={() => void reintentar()}>
            {reintentando ? 'Buscando…' : 'Reintentar'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
