/**
 * La Web Serial API, declarada a mano.
 *
 * `lib.dom.d.ts` de TypeScript todavia no la trae (el estandar sigue en el
 * WICG), asi que las cinco interfaces viven aqui en vez de agregar
 * `@types/w3c-web-serial`. Es la misma regla de "usa lo que ya esta
 * instalado": no vale una dependencia para declarar lo que no cambia.
 *
 * `navigator.serial` es opcional a proposito: en Firefox, en Safari y en las
 * pruebas (jsdom) no existe, y el codigo tiene que poder decir que no hay
 * balanza sin reventar.
 */
interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  flowControl?: 'none' | 'hardware'
  bufferSize?: number
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  open(opciones: SerialOptions): Promise<void>
  close(): Promise<void>
}

interface SerialPortRequestOptions {
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>
}

interface Serial {
  requestPort(opciones?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface Navigator {
  readonly serial?: Serial
}
