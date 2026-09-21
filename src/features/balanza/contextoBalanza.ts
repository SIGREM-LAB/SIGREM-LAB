import { createContext, useContext } from 'react'

import type { FalloBalanza, LecturaBalanza } from './balanza'

export type EstadoBalanza = 'desconectada' | 'conectando' | 'conectada' | 'error'

export type ValorBalanza = {
  estado: EstadoBalanza
  /** Si el navegador puede leer un puerto serie. Firefox, Safari y jsdom: no. */
  soportado: boolean
  /** La ultima trama recibida, o `null` si todavia no llega ninguna. */
  lectura: LecturaBalanza | null
  error: string | null
  /**
   * Por que fallo el ultimo intento, o `null` si no ha fallado ninguno.
   *
   * La pantalla lo necesita para decidir si ensenar el dialogo de preparacion o
   * un aviso, sin tener que leer el texto de `error`.
   */
  fallo: FalloBalanza | null
  /** `sinFiltro` ofrece todos los puertos, no solo los del adaptador FTDI. */
  conectar: (sinFiltro?: boolean) => Promise<void>
  desconectar: () => Promise<void>
  /** Espera una lectura estable y la devuelve; `null` si no llega a tiempo. */
  capturar: () => Promise<LecturaBalanza | null>
}

/**
 * Sin proveedor la balanza esta apagada y no rompe nada. Es el mismo trato que
 * `ContextoSesion`, que sin proveedor arranca en "cargando": asi las pantallas
 * de peso se montan y se prueban sin un puerto serie de verdad.
 */
const INACTIVA: ValorBalanza = {
  estado: 'desconectada',
  soportado: false,
  lectura: null,
  error: null,
  fallo: null,
  conectar: async () => {},
  desconectar: async () => {},
  capturar: async () => null,
}

export const ContextoBalanza = createContext<ValorBalanza>(INACTIVA)

export function useBalanza(): ValorBalanza {
  return useContext(ContextoBalanza)
}
