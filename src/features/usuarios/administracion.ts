import { FunctionsHttpError, type FunctionsError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Rol = Tables<'perfil'>['rol']

/** Lo que dice `auth.users` de la cuenta, no lo que dice `perfil`. */
export type EstadoUsuario = 'activo' | 'pendiente' | 'desactivado'

/** Un renglón de la lista: mitad `auth.users`, mitad `perfil`. */
export type Usuario = {
  id: string
  correo: string | null
  estado: EstadoUsuario
  nombre: string
  rol: Rol
  almacen_id: number | null
  almacen: Tables<'almacen'> | null
  creado_en: string
}

export const roles: { valor: Rol; etiqueta: string }[] = [
  { valor: 'admin', etiqueta: 'Administrador' },
  { valor: 'responsable', etiqueta: 'Responsable' },
  { valor: 'consulta', etiqueta: 'Usuario de consulta' },
]

export function etiquetaRol(rol: Rol): string {
  return roles.find((opcion) => opcion.valor === rol)?.etiqueta ?? rol
}

/**
 * Lo que la Edge Function contesta cuando algo sale mal: `{ error: "..." }`.
 *
 * Vale la pena sacarlo porque `functions.invoke` NO lo entrega. Ante un 4xx o
 * un 5xx devuelve `data: null` y un `FunctionsHttpError` cuyo `message` es
 * siempre el mismo, "Edge Function returned a non-2xx status code". El motivo
 * real —"Ya existe una cuenta con ese correo electrónico"— viene en
 * `error.context`, que es la `Response` sin leer.
 *
 * Sin esto la pantalla enseñaba esa frase en inglés para todo, y la rama del
 * límite de correos del diálogo de restablecimiento no se cumplía nunca:
 * buscaba la palabra "límite" en un texto que no la traía.
 */
export async function motivoDelError(error: FunctionsError): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) return error.message

  try {
    const cuerpo: unknown = await error.context.json()
    if (typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo) {
      const detalle = (cuerpo as { error: unknown }).error
      if (typeof detalle === 'string' && detalle !== '') return detalle
    }
  } catch {
    // Un 502 del relay no trae JSON. Queda el mensaje de la librería.
  }
  return error.message
}

/** Llama a `administrar-usuarios` y levanta el motivo real de cualquier fallo. */
export async function invocarAdministracion<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('administrar-usuarios', { body: cuerpo })
  if (error) throw new Error(await motivoDelError(error as FunctionsError))
  if (!data) throw new Error('La respuesta de la función está vacía')
  return data
}

/**
 * Los errores que devuelve la tabla `perfil` al guardar la edición.
 *
 * El candado del último admin vive en un trigger de la base y no en la
 * pantalla, así que su mensaje llega en el idioma del servidor. Aquí se cambia
 * por uno que dice qué hacer.
 */
export function motivoDelErrorDePerfil(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'No se pudieron guardar los cambios'

  const { code, message } = error as { code?: string; message?: string }

  if (code === 'P0001' && message?.includes('sin administradores')) {
    return 'Eres el último administrador. Nombra a otro antes de quitarte el rol.'
  }
  if (code === '23514' && message?.includes('perfil_responsable_con_almacen')) {
    return 'Un responsable necesita un almacén asignado.'
  }
  if (code === '42501') {
    return 'No tienes permiso para editar este perfil.'
  }
  return message ?? 'No se pudieron guardar los cambios'
}

/**
 * El envío de correos de recuperación tiene cuota —dos por hora con el correo
 * integrado de Supabase— y quien no lo ve llegar vuelve a pulsar. El freno vive
 * en `localStorage` y no en la base porque es una cortesía de la pantalla, no
 * una regla: el límite de verdad lo impone Supabase y contesta 429.
 */
const CLAVE_RESTABLECIMIENTOS = 'sigrem-restablecimientos'
const ESPERA_RESTABLECIMIENTO_MS = 60 * 60 * 1000

export function leerRestablecimientos(): Record<string, number> {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE_RESTABLECIMIENTOS) ?? '{}')
    return typeof guardado === 'object' && guardado !== null ? (guardado as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function minutosDeEspera(usuarioId: string, bloqueos: Record<string, number>): number {
  const restante = (bloqueos[usuarioId] ?? 0) - Date.now()
  return restante > 0 ? Math.ceil(restante / 60_000) : 0
}

export function marcarRestablecimiento(usuarioId: string): Record<string, number> {
  const actual = leerRestablecimientos()
  actual[usuarioId] = Date.now() + ESPERA_RESTABLECIMIENTO_MS
  try {
    localStorage.setItem(CLAVE_RESTABLECIMIENTOS, JSON.stringify(actual))
  } catch {
    // Navegador con el almacenamiento lleno o bloqueado: se pierde el freno,
    // la pantalla sigue funcionando.
  }
  return actual
}

/**
 * Los requisitos de la contraseña, en un solo lugar: los usan el alta y el
 * restablecimiento, y la Edge Function los repite del lado del servidor.
 */
export const REGLA_CONTRASENA = 'Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.'
