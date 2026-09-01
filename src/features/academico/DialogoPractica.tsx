import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { esquemaPractica, type ValoresPractica } from './esquemas'

type Props = {
  abierto: boolean
  /** Bajo qué asignatura se está capturando, para que se vea en el título. */
  asignatura: string
  inicial?: { numero: number; nombre: string }
  /** El siguiente número libre, para no obligar a contar la lista a mano. */
  siguienteNumero: number
  guardando: boolean
  onGuardar: (valores: ValoresPractica) => void
  onCerrar: () => void
}

export function DialogoPractica({
  abierto,
  asignatura,
  inicial,
  siguienteNumero,
  guardando,
  onGuardar,
  onCerrar,
}: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresPractica>({
    resolver: zodResolver(esquemaPractica),
    values: {
      numero: inicial?.numero ?? siguienteNumero,
      nombre: inicial?.nombre ?? '',
    },
  })

  function cerrar() {
    reset()
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>
          {inicial ? 'Editar práctica' : 'Nueva práctica'} · {asignatura}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
            <Controller
              name="numero"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="number"
                  label="N°"
                  sx={{ width: 92 }}
                  // `valueAsNumber` no existe en Controller: sin este onChange
                  // el campo entrega texto y zod lo rechaza por no ser number.
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                  }
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="nombre"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus
                  fullWidth
                  label="Nombre de la práctica"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>
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
