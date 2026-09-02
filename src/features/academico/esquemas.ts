import { z } from 'zod'

/**
 * Los mensajes de error se escriben aquí, en el esquema, y no en el JSX: así el
 * mismo campo dice lo mismo en el diálogo de alta y en el de edición.
 */
export const esquemaPrograma = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del programa'),
})

export const esquemaAsignatura = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la asignatura'),
  // `null` es una optativa, no un campo vacío: es un valor válido del plan de
  // estudios, y por eso es nullable y no optional.
  semestre: z.number().int().min(1).max(12).nullable(),
})

export const esquemaPractica = z.object({
  numero: z.number().int().min(1, 'El número va del 1 en adelante'),
  nombre: z.string().trim().min(1, 'Escribe el nombre de la práctica'),
})

export type ValoresPrograma = z.infer<typeof esquemaPrograma>
export type ValoresAsignatura = z.infer<typeof esquemaAsignatura>
export type ValoresPractica = z.infer<typeof esquemaPractica>
