import { z } from 'zod'

import type { Enums } from '@/types/database'

/**
 * Los tres paneles de Prácticas, en el orden en que se ofrecen.
 *
 * Se listan aquí porque zod necesita un tuple literal, no un `string[]`. El
 * `satisfies` es lo que hace tronar la compilación si el enum de la base crece:
 * sin él, un cuarto método entraría en la base y esta pantalla seguiría
 * ofreciendo tres sin que nadie se enterara.
 *
 * Las etiquetas NO se repiten aquí: salen de `ASPECTO_METODO`
 * (`src/features/practicas/metodos.ts`), para que no diga «Préstamo» de una
 * forma en Prácticas y de otra en Administración.
 */
export const METODOS = ['peso', 'cantidad', 'prestamo'] as const satisfies readonly Enums<'metodo_control'>[]

/**
 * Los mensajes de error se escriben aquí, en el esquema, y no en el JSX: así el
 * mismo campo dice lo mismo en el diálogo de alta y en el de edición.
 */
export const esquemaFichaAlmacen = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del almacén'),
  // Los tres de la NOM son nullable y no optional: un almacén sin confirmar
  // —ICSA hoy— es un estado válido del dato, no un campo que falte por
  // descuido.
  usoPrincipal: z.string().trim().min(1).nullable(),
  zonaRiesgo: z.string().trim().min(1).nullable(),
  personasExpuestas: z
    .number({ message: 'Las personas expuestas son un número entero' })
    .int('Las personas expuestas son un número entero')
    .min(0, 'No puede ser negativo')
    .nullable(),
})

export const esquemaLaboratorio = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del laboratorio'),
})

export const esquemaMotivo = z.object({
  clave: z
    .string()
    .trim()
    .min(1, 'Escribe la clave')
    .regex(/^[a-z_]+$/, 'La clave va en minúsculas y guiones bajos'),
  etiqueta: z.string().trim().min(1, 'Escribe lo que va a leer el usuario'),
  orden: z.number().int().min(1, 'El orden va del 1 en adelante'),
  // Espeja el check `motivo_observacion_metodos_no_vacio` de la base: un motivo
  // que no se ofrece en ningún panel es un motivo que nadie puede elegir nunca.
  metodos: z.array(z.enum(METODOS)).min(1, 'Elige al menos un panel donde ofrecerlo'),
})

export type ValoresFichaAlmacen = z.infer<typeof esquemaFichaAlmacen>
export type ValoresLaboratorio = z.infer<typeof esquemaLaboratorio>
export type ValoresMotivo = z.infer<typeof esquemaMotivo>
