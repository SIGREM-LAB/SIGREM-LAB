import { z } from 'zod'

/**
 * Los requisitos de la contraseña, una sola vez. La Edge Function los repite en
 * el servidor a propósito —el cliente puede saltarse su propia validación—,
 * pero dentro del navegador esta es la única copia.
 */
export const contrasena = z
  .string()
  .min(8, 'Debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula')
  .regex(/[a-z]/, 'Debe incluir una minúscula')
  .regex(/[0-9]/, 'Debe incluir un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir un carácter especial')

/**
 * Un responsable sin almacén no podría escribir en ningún lado. Es la misma
 * regla que el `check` de la tabla `perfil`; aquí sólo se adelanta el aviso
 * para no gastar un viaje a la base en descubrirlo.
 */
function exigirAlmacenAResponsable(
  valores: { rol: string; almacenId: string },
  contexto: z.RefinementCtx,
) {
  if (valores.rol === 'responsable' && !valores.almacenId) {
    contexto.addIssue({
      code: 'custom',
      path: ['almacenId'],
      message: 'Un responsable debe tener un almacén asignado',
    })
  }
}

function exigirConfirmacion(
  valores: { contrasena: string; confirmacion: string },
  contexto: z.RefinementCtx,
) {
  if (valores.contrasena !== valores.confirmacion) {
    contexto.addIssue({ code: 'custom', path: ['confirmacion'], message: 'Las contraseñas no coinciden' })
  }
}

export const esquemaEdicion = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe el nombre completo'),
    rol: z.enum(['admin', 'responsable', 'consulta']),
    almacenId: z.string(),
  })
  .superRefine(exigirAlmacenAResponsable)

export type ValoresEdicion = z.infer<typeof esquemaEdicion>

export const esquemaNuevo = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe el nombre completo'),
    correo: z.string().trim().email('Escribe un correo válido'),
    rol: z.enum(['admin', 'responsable', 'consulta']),
    almacenId: z.string(),
    contrasena,
    confirmacion: z.string(),
  })
  .superRefine((valores, contexto) => {
    exigirAlmacenAResponsable(valores, contexto)
    exigirConfirmacion(valores, contexto)
  })

export type ValoresNuevo = z.infer<typeof esquemaNuevo>

export const esquemaContrasena = z
  .object({ contrasena, confirmacion: z.string() })
  .superRefine(exigirConfirmacion)

export type ValoresContrasena = z.infer<typeof esquemaContrasena>
