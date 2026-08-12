import { createContext, useContext } from 'react'

/**
 * Supabase tarda un instante en resolver si hay una sesion guardada. Ese
 * instante es un estado propio, no "sin sesion": tratarlo como ausencia de
 * sesion echa al login a quien si tiene una valida cada vez que recarga.
 */
export type EstadoSesion =
  | { estado: 'cargando' }
  | { estado: 'sin-sesion' }
  | { estado: 'con-sesion'; usuarioId: string }

export const ContextoSesion = createContext<EstadoSesion>({ estado: 'cargando' })

export function useSesion(): EstadoSesion {
  return useContext(ContextoSesion)
}
