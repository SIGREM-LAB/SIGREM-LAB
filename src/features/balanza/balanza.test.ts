import { afterEach, describe, expect, test } from 'vitest'

import { crearTransporteWebSerial, parsearTramaOptika } from './balanza'

/**
 * Tramas reales, capturadas de la balanza del laboratorio por COM4 a 9600 8N1.
 * No son ejemplos inventados: son los bytes que salieron, y son la razon por la
 * que el indicador de estabilidad se lee como `S`.
 */
const ESTABLE_CERO = '     0.00 g S\r\n'
const INESTABLE_CERO = '     0.00 g  \r\n'
const ESTABLE_483 = '   483.96 g S\r\n'
const INESTABLE_483 = '   483.96 g  \r\n'
const NEGATIVA = '-    2.50 g S\r\n'

describe('parsearTramaOptika', () => {
  test('lee el peso, la unidad y la estabilidad de una trama real', () => {
    expect(parsearTramaOptika(ESTABLE_483)).toEqual({
      valor: 483.96,
      unidad: 'g',
      estable: true,
    })
  })

  test('un espacio en la posicion de estabilidad es "no estable"', () => {
    expect(parsearTramaOptika(INESTABLE_483)).toEqual({
      valor: 483.96,
      unidad: 'g',
      estable: false,
    })
  })

  test('el cero tambien se lee', () => {
    expect(parsearTramaOptika(ESTABLE_CERO)).toEqual({ valor: 0, unidad: 'g', estable: true })
    expect(parsearTramaOptika(INESTABLE_CERO)).toEqual({ valor: 0, unidad: 'g', estable: false })
  })

  test('el signo menos del primer caracter vuelve negativo el peso', () => {
    expect(parsearTramaOptika(NEGATIVA)?.valor).toBe(-2.5)
  })

  test('acepta otra unidad y la recorta', () => {
    // El campo de unidad son tres caracteres: aqui `ct` viene con relleno.
    expect(parsearTramaOptika('     1.50ct S\r\n')?.unidad).toBe('ct')
  })

  // El manual ingles marca la estabilidad como propia del modo continuo; una
  // trama sin ella no puede darse por estable.
  test('sin indicador de estabilidad no esta estable', () => {
    expect(parsearTramaOptika('     0.00 g \r\n')?.estable).toBe(false)
  })

  test.each([
    ['vacia', ''],
    ['sin terminador', '     0.00 g S'],
    ['basura', 'hola\r\n'],
    ['corta', '0.00\r\n'],
    ['peso no numerico', '      abc g S\r\n'],
  ])('devuelve null con una trama %s', (_caso, trama) => {
    expect(parsearTramaOptika(trama)).toBeNull()
  })
})

/**
 * Un puerto serie de mentira que se comporta como el de verdad en lo unico que
 * importa aqui: `close()` se RECHAZA mientras `readable` siga tomado por un
 * lector. Esa es la regla de Web Serial que hacia que el puerto se quedara
 * abierto en silencio, asi que la prueba no sirve de nada si el doble no la
 * respeta.
 */
function crearPuertoFalso() {
  const estado = { abierto: 0, cerrado: 0, rechazadoPorCandado: 0 }
  let controlador: ReadableStreamDefaultController<Uint8Array> | null = null

  const puerto = {
    readable: new ReadableStream<Uint8Array>({
      start(c) {
        controlador = c
      },
    }),
    writable: null,
    async open() {
      estado.abierto += 1
    },
    async close() {
      if (puerto.readable.locked) {
        estado.rechazadoPorCandado += 1
        throw new TypeError('port.readable esta tomado')
      }
      estado.cerrado += 1
    },
  }

  return {
    puerto: puerto as unknown as SerialPort,
    estado,
    emitir(texto: string) {
      controlador?.enqueue(new TextEncoder().encode(texto))
    },
    tomado: () => puerto.readable.locked,
  }
}

function instalarSerial(puerto: SerialPort) {
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: {
      getPorts: async () => [puerto],
      requestPort: async () => puerto,
    },
  })
}

/** Espera a que se cumpla algo, sondeando el bucle de eventos. */
async function hasta(condicion: () => boolean) {
  for (let i = 0; i < 200 && !condicion(); i += 1) {
    await new Promise((listo) => setTimeout(listo, 5))
  }
  expect(condicion()).toBe(true)
}

describe('crearTransporteWebSerial', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serial')
  })

  test('las tramas salen enteras aunque lleguen partidas en dos lecturas', async () => {
    const falso = crearPuertoFalso()
    instalarSerial(falso.puerto)
    const transporte = crearTransporteWebSerial()
    await transporte.conectar()

    const control = new AbortController()
    const recibidas: string[] = []
    const bucle = (async () => {
      for await (const trama of transporte.tramas(control.signal)) {
        recibidas.push(trama)
        if (recibidas.length === 2) break
      }
    })()

    await hasta(() => falso.tomado())
    falso.emitir('   483.96 g S\r')
    falso.emitir('\n   500.00 g S\r\n')
    await bucle

    expect(recibidas).toEqual(['   483.96 g S\r\n', '   500.00 g S\r\n'])
    await transporte.desconectar()
  })

  // Esta es la que importa. `cancel()` hace que la lectura en curso resuelva
  // pero NO devuelve el candado; sin `releaseLock()`, `close()` se rechaza, el
  // `catch` se traga el rechazo y el COM se queda abierto mientras la pantalla
  // dice que esta cerrado.
  test('desconectar suelta el candado y cierra el puerto de verdad', async () => {
    const falso = crearPuertoFalso()
    instalarSerial(falso.puerto)
    const transporte = crearTransporteWebSerial()
    await transporte.conectar()

    const control = new AbortController()
    // Nadie emite: el lector se queda esperando bytes que no llegan, que es
    // justo el estado en el que alguien le da a «Desconectar».
    const recibidas: string[] = []
    const bucle = (async () => {
      for await (const trama of transporte.tramas(control.signal)) recibidas.push(trama)
    })()

    await hasta(() => falso.tomado())
    await transporte.desconectar()

    expect(recibidas).toEqual([])

    expect(falso.estado.rechazadoPorCandado).toBe(0)
    expect(falso.estado.cerrado).toBe(1)
    expect(falso.tomado()).toBe(false)
    await bucle
  })

  // Abortar tiene que bastar para que el generador termine: `read()` no mira la
  // senal, asi que sin cancelar el lector el bucle se queda colgado para
  // siempre y el `finally` que suelta el puerto no llega a correr nunca.
  test('abortar termina el bucle aunque no lleguen mas bytes', async () => {
    const falso = crearPuertoFalso()
    instalarSerial(falso.puerto)
    const transporte = crearTransporteWebSerial()
    await transporte.conectar()

    const control = new AbortController()
    let termino = false
    const recibidas: string[] = []
    const bucle = (async () => {
      for await (const trama of transporte.tramas(control.signal)) recibidas.push(trama)
      termino = true
    })()

    await hasta(() => falso.tomado())
    control.abort()
    await bucle

    expect(termino).toBe(true)
    expect(falso.tomado()).toBe(false)
  })
})
