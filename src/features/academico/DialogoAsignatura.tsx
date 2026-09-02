import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import type { Asignatura } from './consultas'
import { esquemaAsignatura, type ValoresAsignatura } from './esquemas'
import { SEMESTRES } from './semestres'

type Props = {
  abierto: boolean
  /** Las que este programa AÚN NO tiene: el filtrado lo hace quien llama. */
  disponibles: Asignatura[]
  /** Si viene, el diálogo sólo cambia el semestre de una ya vinculada. */
  inicial?: { nombre: string; semestre: number | null }
  guardando: boolean
  onGuardar: (valores: ValoresAsignatura) => void
  onCerrar: () => void
}

/**
 * Dos modos, y la diferencia entre ellos es exactamente lo que modela la tabla
 * puente: **crear** mete una fila nueva en `asignatura`; **vincular** reusa una
 * que ya existe y sólo añade el renglón de `programa_asignatura`. Que sean dos
 * pestañas y no un solo campo es lo que enseña ese modelo a quien captura.
 *
 * En los dos casos se llama a `vincular_asignatura`, que busca por nombre
 * normalizado: si alguien escribe en "Nueva" un nombre que ya existe, la
 * función reusa el que hay en vez de fallar.
 */
export function DialogoAsignatura({
  abierto,
  disponibles,
  inicial,
  guardando,
  onGuardar,
  onCerrar,
}: Props) {
  const editando = inicial !== undefined
  const [modo, setModo] = useState<'nueva' | 'vincular'>('nueva')

  const { control, handleSubmit, reset, setValue } = useForm<ValoresAsignatura>({
    resolver: zodResolver(esquemaAsignatura),
    values: { nombre: inicial?.nombre ?? '', semestre: inicial?.semestre ?? null },
  })

  function cerrar() {
    reset()
    setModo('nueva')
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>
          {editando ? `Semestre de ${inicial.nombre}` : 'Agregar asignatura al programa'}
        </DialogTitle>

        {editando ? null : (
          <Tabs
            value={modo}
            onChange={(_, v: 'nueva' | 'vincular') => {
              setModo(v)
              setValue('nombre', '')
            }}
            sx={{ px: 3 }}
          >
            <Tab value="nueva" label="Nueva" />
            <Tab value="vincular" label="Ya existe" />
          </Tabs>
        )}

        <DialogContent>
          {editando ? null : (
            <Controller
              name="nombre"
              control={control}
              render={({ field, fieldState }) =>
                modo === 'nueva' ? (
                  <TextField
                    {...field}
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Nombre de la asignatura"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                ) : (
                  <Autocomplete
                    options={disponibles.map((a) => a.nombre)}
                    value={field.value === '' ? null : field.value}
                    onChange={(_, v) => field.onChange(v ?? '')}
                    noOptionsText="No quedan asignaturas por vincular"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        autoFocus
                        margin="dense"
                        label="Asignatura existente"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                )
              }
            />
          )}

          <Controller
            name="semestre"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                select
                fullWidth
                margin="dense"
                label="Semestre"
                // El valor de un Select es texto; null viaja como '' y se
                // reconvierte al salir. Sin esto "Optativa" no se puede elegir.
                value={field.value === null ? '' : String(field.value)}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? null : Number(e.target.value))
                }
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              >
                {SEMESTRES.map((s) => (
                  <MenuItem key={s.etiqueta} value={s.valor === null ? '' : String(s.valor)}>
                    {s.etiqueta}
                  </MenuItem>
                ))}
              </TextField>
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
