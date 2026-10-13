import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import type { Almacen } from './consultas'
import { esquemaFichaAlmacen, type ValoresFichaAlmacen } from './esquemas'

type Props = {
  almacen: Almacen
  /** Es su propio almacén, o es admin. Falso = sólo mirar. */
  puedeEditar: boolean
  guardando: boolean
  onGuardar: (valores: ValoresFichaAlmacen) => void
}

/**
 * La ficha NOM del almacén.
 *
 * Los tres campos de abajo no son decorativos: el exportador los reinyecta en
 * CADA renglón del formato unificado. ICSA entró el 17 de septiembre con los
 * tres en nulo, «hasta que el responsable las confirme», y hasta ahora esa
 * confirmación no cabía en ningún lado.
 *
 * `almacen` es `Almacen` y no `Almacen | null`: mientras no haya ninguno
 * elegido, la página no monta este componente. Un formulario que sabe dibujarse
 * sin datos acaba lleno de `?.` y de estados imposibles.
 */
export function FichaAlmacen({ almacen, puedeEditar, guardando, onGuardar }: Props) {
  const { control, handleSubmit } = useForm<ValoresFichaAlmacen>({
    resolver: zodResolver(esquemaFichaAlmacen),
    // `values` y no `defaultValues`: al cambiar de almacén en la lista el
    // formulario tiene que recargarse con el nuevo. Con `defaultValues` se
    // quedaría enseñando el anterior.
    values: {
      nombre: almacen.nombre,
      usoPrincipal: almacen.usoPrincipal,
      zonaRiesgo: almacen.zonaRiesgo,
      personasExpuestas: almacen.personasExpuestas,
    },
  })

  return (
    <Card sx={{ p: 2.25 }}>
      <Typography variant="h2" sx={{ fontSize: '0.95rem', mb: 2 }}>
        Ficha del almacén
      </Typography>

      <form onSubmit={handleSubmit(onGuardar)}>
        <Stack spacing={2}>
          {/* Fuera del formulario a propósito: el privilegio de update sobre
              `almacen` no incluye `clave`, así que mandarla devolvería 42501.
              Se enseña porque es como la nombra todo el mundo. */}
          <TextField
            label="Clave"
            value={almacen.clave}
            disabled
            fullWidth
            size="small"
            helperText="La casan el cargador de Excel, el exportador y la semilla. No se cambia desde aquí."
          />

          <Controller
            name="nombre"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nombre"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="usoPrincipal"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                label="Uso principal"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="zonaRiesgo"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                label="Zona de riesgo"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="personasExpuestas"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                // Sin esta conversión zod recibe una cadena, el esquema falla y
                // el mensaje que sale no le dice nada a nadie.
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? null : Number(e.target.value))
                }
                type="number"
                label="Personas expuestas"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          {puedeEditar ? (
            <Box>
              <Button type="submit" variant="contained" loading={guardando}>
                Guardar ficha
              </Button>
            </Box>
          ) : null}
        </Stack>
      </form>
    </Card>
  )
}
