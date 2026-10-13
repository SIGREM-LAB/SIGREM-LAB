/**
 * El código de una existencia: la clave del almacén, un guion y cinco dígitos.
 * Lo arma el trigger `existencia_asigna_codigo` (`clave || '-' || lpad(n, 5)`).
 * La clave puede llevar guiones (`UCL-N3`), por eso el grupo se repite.
 *
 * Es lo único que lleva el QR: nunca caduca, aunque cambie el dominio de la app.
 */
const PATRON_CODIGO = /^[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{5}$/

/** Mayúsculas y sin espacios: la pistola o quien teclea pueden mandar cualquiera de los dos. */
export function normalizarCodigo(texto: string): string {
  return texto.trim().toUpperCase()
}

export function esCodigo(texto: string): boolean {
  return PATRON_CODIGO.test(normalizarCodigo(texto))
}

/**
 * A dónde lleva un código. Es la misma división que usan las guardias de
 * `App.tsx`: quien tiene almacén propio trabaja en /inventario, y quien no
 * (admin y consulta) en /inventario-general.
 */
export function rutaDeCodigo(codigo: string, tieneAlmacenPropio: boolean): string {
  const base = tieneAlmacenPropio ? '/inventario' : '/inventario-general'
  return `${base}?codigo=${encodeURIComponent(normalizarCodigo(codigo))}`
}

/**
 * Lo que la escucha global lleva acumulado.
 *
 * Una pistola lectora «teclea» el código entero en unos pocos milisegundos y
 * remata con Enter. Una persona no baja de ~80 ms entre tecla y tecla. Por eso
 * se toma como escaneo solo una ráfaga cuyas teclas llegan a menos de
 * `PAUSA_MAXIMA_MS` una de otra.
 */
export type Rafaga = { texto: string; ultima: number }

export const RAFAGA_VACIA: Rafaga = { texto: '', ultima: 0 }

export const PAUSA_MAXIMA_MS = 50

/**
 * Función pura: recibe la ráfaga, la tecla y el instante, y devuelve la ráfaga
 * nueva y, si con esa tecla se completó un código, el código.
 */
export function interpretarTecla(
  rafaga: Rafaga,
  tecla: string,
  ahora: number,
): { rafaga: Rafaga; codigo: string | null } {
  // Una pausa larga corta la ráfaga: lo anterior era alguien tecleando.
  const vigente = ahora - rafaga.ultima <= PAUSA_MAXIMA_MS ? rafaga.texto : ''

  if (tecla === 'Enter') {
    return {
      rafaga: RAFAGA_VACIA,
      codigo: vigente !== '' && esCodigo(vigente) ? normalizarCodigo(vigente) : null,
    }
  }

  // Shift, Alt y compañía llegan como teclas con nombre largo: no son texto.
  if (tecla.length !== 1) return { rafaga: { texto: vigente, ultima: ahora }, codigo: null }

  return { rafaga: { texto: vigente + tecla, ultima: ahora }, codigo: null }
}

/**
 * Medida de la etiqueta: Brother QL con cinta continua de 62 mm. Si cambian de
 * cinta, sólo se toca aquí.
 */
export const ETIQUETA_MM = { ancho: 62, alto: 29 } as const

export type DatosEtiqueta = {
  codigo: string
  nombre: string
  ubicacion: string | null
}
