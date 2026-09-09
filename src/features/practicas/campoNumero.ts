/**
 * Lo que teclea la persona, como número o como nulo.
 *
 * `Number('')` es `0`, y ese cero silencioso es lo que haría que un campo en
 * blanco pasara por capturado. Vacío es `null`, y `estaCompleto()` lo ve.
 */
export function aNumero(texto: string): number | null {
  const limpio = texto.trim()
  if (limpio === '') return null
  const valor = Number(limpio)
  return Number.isNaN(valor) ? null : valor
}

/** El valor de un `<input>` controlado: nunca `null`, que React no admite. */
export function aTexto(valor: number | null): string {
  return valor === null ? '' : String(valor)
}
