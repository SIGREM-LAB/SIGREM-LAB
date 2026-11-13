import { createContext, useContext, useEffect, useRef } from 'react'

type Manejador = (codigo: string) => void

/**
 * Quién atiende la pistola en este momento. Por omisión nadie, y `Layout` lleva
 * el código al inventario; una pantalla que tiene mejor uso para él —agregarlo a
 * la práctica que se está capturando— lo toma mientras está montada.
 *
 * Es un objeto con una variable cerrada y no estado de React: cambiar de dueño
 * no tiene nada que pintar.
 */
export type Captura = {
  /** Toma la pistola. Devuelve cómo soltarla. */
  tomar: (manejador: Manejador) => () => void
  /** Si alguien tomó la pistola, le pasa el código y devuelve `true`. */
  atender: (codigo: string) => boolean
}

export function crearCaptura(): Captura {
  let actual: Manejador | null = null
  return {
    tomar(manejador) {
      actual = manejador
      return () => {
        // Sólo suelta si sigue siendo suya: si otra pantalla ya la tomó, no se
        // la quita al desmontarse.
        if (actual === manejador) actual = null
      }
    },
    atender(codigo) {
      if (actual === null) return false
      actual(codigo)
      return true
    },
  }
}

export const CapturaCodigoContexto = createContext<Captura>(crearCaptura())

/**
 * Mientras la pantalla esté montada, cada escaneo llega a `manejador` en vez de
 * llevar al inventario.
 */
export function useCapturarCodigo(manejador: Manejador) {
  const captura = useContext(CapturaCodigoContexto)
  // En un ref para no soltar y volver a tomar la pistola en cada render.
  const ultimo = useRef(manejador)
  useEffect(() => {
    ultimo.current = manejador
  }, [manejador])

  useEffect(() => captura.tomar((codigo) => ultimo.current(codigo)), [captura])
}
