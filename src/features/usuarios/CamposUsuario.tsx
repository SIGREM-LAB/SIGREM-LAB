import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'

import { roles } from './administracion'
import { useAlmacenesActivos } from './consultas'

/**
 * Los dos selects que el alta y la edición comparten. Viven aquí porque eran el
 * mismo bloque de treinta líneas copiado en los dos diálogos, incluida la
 * consulta de almacenes.
 */

export function CampoRol<T extends FieldValues>({
  control,
  nombre,
  id,
  bloqueado = false,
  ayuda,
}: {
  control: Control<T>
  nombre: Path<T>
  id: string
  /** Bloqueado y con su motivo a la vista: nunca lo uno sin lo otro. */
  bloqueado?: boolean
  ayuda?: string
}) {
  return (
    <Controller
      name={nombre}
      control={control}
      render={({ field, fieldState }) => (
        <FormControl fullWidth size="small" error={!!fieldState.error} disabled={bloqueado}>
          <InputLabel id={`${id}-label`}>Rol</InputLabel>
          <Select {...field} labelId={`${id}-label`} label="Rol">
            {roles.map((rol) => (
              <MenuItem key={rol.valor} value={rol.valor}>
                {rol.etiqueta}
              </MenuItem>
            ))}
          </Select>
          {fieldState.error?.message ?? ayuda ? (
            <FormHelperText>{fieldState.error?.message ?? ayuda}</FormHelperText>
          ) : null}
        </FormControl>
      )}
    />
  )
}

export function CampoAlmacen<T extends FieldValues>({
  control,
  nombre,
  id,
}: {
  control: Control<T>
  nombre: Path<T>
  id: string
}) {
  const almacenes = useAlmacenesActivos()

  return (
    <Controller
      name={nombre}
      control={control}
      render={({ field, fieldState }) => (
        <FormControl fullWidth size="small" error={!!fieldState.error}>
          <InputLabel id={`${id}-label`}>Laboratorio / Área asignada</InputLabel>
          <Select {...field} labelId={`${id}-label`} label="Laboratorio / Área asignada">
            <MenuItem value="">Sin asignar</MenuItem>
            {almacenes.data?.map((almacen) => (
              <MenuItem key={almacen.id} value={almacen.id.toString()}>
                {almacen.clave} · {almacen.nombre}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {fieldState.error?.message ??
              (almacenes.error ? 'No se pudo leer la lista de almacenes' : ' ')}
          </FormHelperText>
        </FormControl>
      )}
    />
  )
}
