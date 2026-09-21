/**
 * La balanza del laboratorio: una Optika serie B/C/CH/D/E/EH/F/G por puerto
 * serie RS232.
 *
 * Este modulo no sabe de React. El parser y el transporte se pueden probar
 * solos; el proveedor (`ProveedorBalanza`) es quien los junta con la pantalla.
 */

export type LecturaBalanza = {
  valor: number
  unidad: string
  estable: boolean
}

/**
 * Una trama de pesada, tal como sale de la balanza.
 *
 * Son 15 caracteres: signo, peso (8, justificado a la derecha con espacios),
 * unidad (3), indicador de estabilidad y CR LF. El manual no dice que caracter
 * es el indicador; en hardware resulto ser `S` cuando el peso esta fijo y un
 * espacio cuando no lo esta (ver las tramas reales en `balanza.test.ts`).
 *
 * El indicador se acepta opcional porque el manual ingles lo marca como propio
 * de la transmision continua; en el modo por comando la trama puede venir sin
 * el. Lo que no se adivina: si falta, no esta estable.
 */
export function parsearTramaOptika(trama: string): LecturaBalanza | null {
  const partes = /^([ -])(.{8})(.{3})(.)?\r?\n$/.exec(trama)
  if (partes === null) return null

  const valor = Number(partes[2].replace(/ /g, ''))
  if (!Number.isFinite(valor)) return null

  return {
    valor: partes[1] === '-' ? -valor : valor,
    unidad: partes[3].trim(),
    estable: partes[4] === 'S',
  }
}

/**
 * 8N1 sin paridad, a 9600. Es lo que quedo configurado en la balanza del
 * laboratorio (`BAUD RT`). Si otra balanza viniera a otro ritmo, es lo unico
 * que cambia.
 */
export const OPCIONES_SERIAL: SerialOptions = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}

/**
 * Lo que el proveedor necesita de un puerto serie, sin saber de Web Serial.
 *
 * Declararlo permite inyectar un doble en las pruebas sin tocar `navigator` ni
 * abrir un puerto de verdad, igual que `ClienteAuth` con la sesion.
 */
export type TransporteBalanza = {
  /** Si el navegador puede hablar con un puerto serie. Firefox y Safari, no. */
  soportado: boolean
  conectar(): Promise<void>
  desconectar(): Promise<void>
  /** Emite una trama por linea, con el terminador incluido. */
  tramas(senal: AbortSignal): AsyncIterable<string>
}

export function crearTransporteWebSerial(): TransporteBalanza {
  let puerto: SerialPort | null = null
  let lector: ReadableStreamDefaultReader<Uint8Array> | null = null

  /**
   * Devuelve el candado de `port.readable`.
   *
   * Hacen falta las dos llamadas y en este orden. `cancel()` cierra el flujo y
   * hace que la lectura en curso resuelva, pero NO suelta el candado; eso es
   * `releaseLock()`. Y mientras el candado siga puesto, `port.close()` se
   * rechaza: ese rechazo, tragado por el `catch`, es lo que dejaba el COM
   * abierto con la pantalla diciendo que estaba cerrado.
   *
   * Es seguro llamarla dos veces: sobre un lector ya suelto las dos tiran, y
   * las dos van atrapadas.
   */
  async function soltar(actual: ReadableStreamDefaultReader<Uint8Array>) {
    await actual.cancel().catch(() => {})
    try {
      actual.releaseLock()
    } catch {
      // Ya estaba suelto. Es el caso normal cuando el flujo se murio solo.
    }
  }

  return {
    soportado: typeof navigator !== 'undefined' && navigator.serial !== undefined,

    async conectar() {
      const serial = navigator.serial
      if (serial === undefined) throw new Error('Este navegador no puede leer el puerto serie')

      // Un puerto ya autorizado se reabre sin volver a pedir permiso; solo se
      // abre el selector la primera vez.
      const [autorizado] = await serial.getPorts()
      puerto = autorizado ?? (await serial.requestPort())
      await puerto.open(OPCIONES_SERIAL)
    },

    async desconectar() {
      const actual = puerto
      const suyo = lector
      puerto = null
      lector = null

      // Soltar ANTES de cerrar. Al reves no cierra nada.
      if (suyo !== null) await soltar(suyo)
      await actual?.close().catch(() => {})
    },

    async *tramas(senal) {
      const legible = puerto?.readable
      if (legible == null) return

      const propio = legible.getReader()
      lector = propio
      const decodificador = new TextDecoder()
      let buffer = ''

      // `read()` no mira la senal: se queda esperando bytes que pueden no
      // llegar nunca. Cancelar el lector es lo unico que la hace resolver, asi
      // que abortar tiene que cancelarlo aunque nadie llame a `desconectar`.
      const alAbortar = () => void soltar(propio)
      senal.addEventListener('abort', alAbortar, { once: true })

      try {
        while (!senal.aborted) {
          const { value, done } = await propio.read()
          if (done) break
          // `stream: true` es para que un acento partido entre dos lecturas no
          // se pierda; con ASCII puro no cambia nada, pero no cuesta.
          buffer += decodificador.decode(value, { stream: true })

          let corte = buffer.indexOf('\n')
          while (corte >= 0) {
            yield buffer.slice(0, corte + 1)
            buffer = buffer.slice(corte + 1)
            corte = buffer.indexOf('\n')
          }
        }
      } finally {
        senal.removeEventListener('abort', alAbortar)
        // Si `desconectar` llego primero ya solto este lector y puso otro —o
        // ninguno—; volver a tocarlo seria soltar algo que no es mio.
        if (lector === propio) {
          lector = null
          await soltar(propio)
        }
      }
    },
  }
}
