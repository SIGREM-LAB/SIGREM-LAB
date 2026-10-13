import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { esquemaLaboratorio, type ValoresLaboratorio } from './esquemas'

type Props = {
  abierto: boolean
  /** La clave del almacén, para que el título diga en cuál se da de alta. */
  almacen: string
  /** Si viene, el diálogo renombra; si no, da de alta. */
  inicial?: { nombre: string }
  guardando: boolean
  onGuardar: (valores: ValoresLaboratorio) => void
  onCerrar: () => void
}

export function DialogoLaboratorio({
  abierto,
  almacen,
  inicial,
  guardando,
  onGuardar,
  onCerrar,
}: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresLaboratorio>({
    resolver: zodResolver(esquemaLaboratorio),
    values: { nombre: inicial?.nombre ?? '' },
  })

  function cerrar() {
    reset()
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      {/* Un <form> de verdad y no un onClick en el botón: así Enter envía, que
          es como se captura una lista larga sin soltar el teclado. */}
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>
          {inicial ? 'Renombrar laboratorio' : `Nuevo laboratorio de ${almacen}`}
        </DialogTitle>
        <DialogContent>
          <Controller
            name="nombre"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                autoFocus
                fullWidth
                margin="dense"
                label="Nombre del laboratorio"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          {/* Aviso y no bloqueo: quien renombra suele estar corrigiendo
              justamente un nombre que no hacía match. */}
          {inicial ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Las existencias y prácticas ya registradas no se mueven: apuntan a este
              laboratorio por su identificador. Lo que cambia es a qué renglón hacen match
              las cargas de Excel futuras, que lo resuelven por nombre.
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={guardando}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
