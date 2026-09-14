import { Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material'
import { Controller, type Control } from 'react-hook-form'

import { CAMPO_LABORATORIO, rotuloDeOpcion, type Campo, type Valores } from './campos'

type Props = {
  campo: Campo
  control: Control<Valores>
  /** Los laboratorios del almacén, para el único campo que no trae sus opciones. */
  laboratorios: { id: number; nombre: string }[]
}

/**
 * Un campo del alta, elegido por su `tipo_dato`.
 *
 * El control se decide por el dato que devolvió `formulario()`, nunca por el
 * nombre del campo ni por la clasificación. Es lo que permite que un admin
 * agregue un campo al perfil de un almacén y aparezca bien pintado sin
 * redesplegar nada.
 */
export function CampoCaptura({ campo, control, laboratorios }: Props) {
  return (
    <Controller
      name={campo.campo}
      control={control}
      render={({ field, fieldState }) => {
        if (campo.tipo_dato === 'booleano') {
          return (
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.value === true}
                  onChange={(e) => field.onChange(e.target.checked)}
                  onBlur={field.onBlur}
                  // MUI 9 quito `inputRef` de Checkbox. La referencia se sigue
                  // pasando porque es con la que react-hook-form enfoca el
                  // primer campo con error al enviar.
                  slotProps={{ input: { ref: field.ref } }}
                />
              }
              label={campo.etiqueta}
              // La ayuda del catálogo es lo que desambigua varias de estas
              // casillas —«si la tienes, no si hace falta»— y en una casilla no
              // hay `helperText` donde ponerla.
              title={campo.ayuda ?? undefined}
            />
          )
        }

        const comunes = {
          ...field,
          value: typeof field.value === 'boolean' ? '' : field.value,
          fullWidth: true,
          size: 'small' as const,
          label: campo.etiqueta,
          required: campo.obligatorio,
          error: !!fieldState.error,
          helperText: fieldState.error?.message ?? campo.ayuda ?? ' ',
        }

        if (campo.tipo_dato === 'seleccion') {
          return (
            <TextField {...comunes} select>
              {/* Sin esta opción no hay forma de deshacer una elección en un
                  campo que no es obligatorio. */}
              <MenuItem value="">
                <em>Sin especificar</em>
              </MenuItem>
              {opcionesDe(campo, laboratorios).map((opcion) => (
                <MenuItem key={opcion} value={opcion}>
                  {rotuloDeOpcion(opcion)}
                </MenuItem>
              ))}
            </TextField>
          )
        }

        if (campo.tipo_dato === 'fecha') {
          return <TextField {...comunes} type="date" slotProps={{ inputLabel: { shrink: true } }} />
        }

        if (campo.tipo_dato === 'numero') {
          // `type="number"` y no un TextField suelto: en las máquinas del
          // almacén se captura con el teclado numérico y las flechas.
          return <TextField {...comunes} type="number" slotProps={{ htmlInput: { min: 0 } }} />
        }

        const parrafo = ES_PARRAFO.has(campo.campo)
        return <TextField {...comunes} multiline={parrafo} minRows={parrafo ? 2 : undefined} />
      }}
    />
  )
}

/**
 * Los dos campos de texto que reciben frases y no palabras. Se listan aquí y no
 * en la base porque es una decisión de cómo se ve, no de qué se captura:
 * `campo_capturable` distingue `texto` de `numero` porque eso cambia lo que se
 * valida, mientras que alto de caja no cambia nada del dato.
 */
const ES_PARRAFO = new Set(['observaciones', 'especificacion'])

function opcionesDe(campo: Campo, laboratorios: { id: number; nombre: string }[]): string[] {
  // El laboratorio se guarda por NOMBRE, no por id: así lo resuelve
  // `crear_existencia`, igual que el cargador y que la pantalla de depuración.
  if (campo.campo === CAMPO_LABORATORIO) return laboratorios.map((l) => l.nombre)
  return campo.opciones ?? []
}
