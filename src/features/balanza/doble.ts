import type { TransporteBalanza } from './balanza'

/**
 * Un puerto serie de mentira para las pruebas.
 *
 * Vive aquí y no dentro de cada archivo de prueba porque las tres pantallas que
 * usan la balanza lo necesitan igual, y porque la versión que había copiada en
 * cada una emitía todas las tramas de golpe al conectar. Con eso no se puede
 * distinguir «devolvió la lectura que ya tenía» de «esperó una nueva», que es
 * exactamente la diferencia entre pesar y adivinar: la prueba pasaba por el
 * orden en que caían las cosas, no porque el código hiciera lo correcto.
 *
 * Aquí las tramas salen cuando la prueba llama a `emitir`.
 */
export type BalanzaDoble = {
  transporte: TransporteBalanza
  /** Manda UNA trama, como si la balanza acabara de escupirla. */
  emitir: (trama: string) => void
  /**
   * Pone la balanza en continuo: repite esa trama mientras alguien lea.
   *
   * Es lo que hace la de verdad —unas diez por segundo— y es lo que hay que
   * usar cuando la prueba no controla el momento exacto en que el código pide
   * la lectura. Con `emitir` suelto habría que acertar el orden.
   */
  mantener: (trama: string) => void
  /** El cable que se afloja: el flujo termina sin que nadie lo haya abortado. */
  morir: () => void
  vecesCerrado: () => number
}

export function crearBalanzaDoble(soportado = true): BalanzaDoble {
  let cerrado = 0
  let fin = false
  let continuo: string | null = null
  const pendientes: string[] = []
  let despertar: (() => void) | null = null

  function empujar() {
    const seguir = despertar
    despertar = null
    seguir?.()
  }

  const transporte: TransporteBalanza = {
    soportado,
    async conectar() {},
    async desconectar() {
      cerrado += 1
    },
    async *tramas(senal) {
      for (;;) {
        while (pendientes.length > 0) yield pendientes.shift() as string
        if (fin || senal.aborted) return
        if (continuo !== null) {
          yield continuo
          // Un respiro entre trama y trama: sin él esto acapara el bucle de
          // eventos y la prueba no avanza nunca.
          await new Promise((listo) => setTimeout(listo, 5))
          continue
        }
        await new Promise<void>((listo) => {
          despertar = listo
          senal.addEventListener('abort', () => listo(), { once: true })
        })
      }
    },
  }

  return {
    transporte,
    vecesCerrado: () => cerrado,
    emitir(trama) {
      pendientes.push(trama)
      empujar()
    },
    mantener(trama) {
      continuo = trama
      empujar()
    },
    morir() {
      fin = true
      empujar()
    },
  }
}
