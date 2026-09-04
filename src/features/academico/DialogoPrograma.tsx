import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { esquemaPrograma, type ValoresPrograma } from './esquemas'

type Props = {
  abierto: boolean
  /** Si viene, el diálogo renombra; si no, da de alta. */
  inicial?: { nombre: string }
  guardando: boolean
  onGuardar: (valores: ValoresPrograma) => void
  onCerrar: () => void
}

export function DialogoPrograma({ abierto, inicial, guardando, onGuardar, onCerrar }: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresPrograma>({
    resolver: zodResolver(esquemaPrograma),
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
        <DialogTitle>{inicial ? 'Renombrar programa' : 'Nuevo programa educativo'}</DialogTitle>
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
                label="Nombre del programa"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
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
