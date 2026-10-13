import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Stack,
  TextField,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { ASPECTO_METODO } from '@/features/practicas/metodos'
import { esquemaMotivo, METODOS, type ValoresMotivo } from './esquemas'

type Props = {
  abierto: boolean
  /** Si viene, el diálogo edita; si no, da de alta. */
  inicial?: ValoresMotivo
  guardando: boolean
  onGuardar: (valores: ValoresMotivo) => void
  onCerrar: () => void
}

export function DialogoMotivo({ abierto, inicial, guardando, onGuardar, onCerrar }: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresMotivo>({
    resolver: zodResolver(esquemaMotivo),
    values: {
      clave: inicial?.clave ?? '',
      etiqueta: inicial?.etiqueta ?? '',
      orden: inicial?.orden ?? 1,
      metodos: inicial?.metodos ?? [...METODOS],
    },
  })

  function cerrar() {
    reset()
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit(onGuardar)} noValidate>
        <DialogTitle>{inicial ? 'Editar motivo' : 'Nuevo motivo de observación'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Controller
              name="clave"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus={!inicial}
                  fullWidth
                  margin="dense"
                  label="Clave"
                  // La clave es la PK y `practica_observacion` apunta por ella:
                  // cambiarla no es renombrar, es romper el vínculo de todas las
                  // prácticas que ya la usan.
                  disabled={!!inicial}
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    (inicial ? 'La clave no se cambia: hay prácticas que la usan' : undefined)
                  }
                />
              )}
            />

            <Controller
              name="etiqueta"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus={!!inicial}
                  fullWidth
                  margin="dense"
                  label="Etiqueta"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Lo que lee quien registra la práctica'}
                />
              )}
            />

            <Controller
              name="orden"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  type="number"
                  fullWidth
                  margin="dense"
                  label="Orden"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'En qué posición aparece en la lista'}
                />
              )}
            />

            <Controller
              name="metodos"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error} component="fieldset" variant="standard">
                  <FormLabel component="legend" sx={{ fontSize: '0.85rem' }}>
                    Se ofrece en los paneles
                  </FormLabel>
                  <FormGroup row>
                    {METODOS.map((metodo) => (
                      <FormControlLabel
                        key={metodo}
                        label={ASPECTO_METODO[metodo].etiqueta}
                        control={
                          <Checkbox
                            size="small"
                            checked={field.value.includes(metodo)}
                            onChange={(e) =>
                              field.onChange(
                                e.target.checked
                                  ? METODOS.filter((m) => m === metodo || field.value.includes(m))
                                  : field.value.filter((m) => m !== metodo),
                              )
                            }
                          />
                        }
                      />
                    ))}
                  </FormGroup>
                  {fieldState.error ? (
                    <FormHelperText>{fieldState.error.message}</FormHelperText>
                  ) : null}
                </FormControl>
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
