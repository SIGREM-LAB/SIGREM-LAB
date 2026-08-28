import type { Enums } from '@/types/database'

/**
 * Los nombres de reactivo llegan como la cadena completa del formato:
 * "Acetona, líquido, grado A.C.S., pureza 99.5%, presentación 4 L, CAS: 67-64-1".
 * Son unos 90 caracteres y no caben en una celda.
 *
 * El corte es de PRESENTACIÓN: `nombre_canonico` se guarda íntegro, porque la
 * pureza es lo que distingue dos artículos. Aquí sólo se decide qué se lee
 * primero.
 *
 * La coma que separa NO es la primera: los nombres químicos traen las suyas
 * ("1,10-Fenantrolina", "2,4-D"). Se busca la primera coma que no venga seguida
 * de un dígito. Cortar en la primera a secas deja la cabeza en "1".
 */
export function cortarNombre(nombre: string): { cabeza: string; resto: string } {
  const corte = nombre.search(/,(?!\d)/)
  if (corte === -1) return { cabeza: nombre.trim(), resto: '' }

  const resto = nombre
    .slice(corte + 1)
    .split(',')
    .map((parte) => parte.trim())
    // El CAS se repite en el panel de detalle, y aquí gasta el ancho que
    // necesita la pureza, que es lo que de verdad distingue dos renglones.
    .filter((parte) => parte !== '' && !/^CAS\b/i.test(parte))
    .join(' · ')

  return { cabeza: nombre.slice(0, corte).trim(), resto }
}

/**
 * La misma normalización que `public.norm_texto()` en la base: minúsculas y sin
 * acentos. Tiene que coincidir, porque el término se compara contra las columnas
 * `nombre_norm` y `marca_norm` de la vista, que ya vienen normalizadas.
 *
 * Además quita los caracteres que romperían el filtro `or()` de PostgREST, que
 * separa sus argumentos por comas y agrupa con paréntesis. Quien teclea
 * "acido, 99%" no está pidiendo nada raro; sin esta limpieza la consulta sale
 * malformada.
 */
export function normalizarTermino(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[,()*\\]/g, '')
    .trim()
}

type AspectoEstado = { etiqueta: string; color: string }

/**
 * Los seis estados con su color. Viven aquí y no en el tema por la misma razón
 * que los colores de almacén en `almacenes.ts`: no son la paleta de la interfaz,
 * son un atributo del dato — lo que en una gráfica sería la serie.
 *
 * El color se pinta como un punto junto a la etiqueta, no como fondo del chip.
 * Así el texto conserva el contraste del tema en modo claro y en oscuro, sin
 * tener que calcular un par de colores por estado y por modo.
 *
 * `agotado` no usa el `error.main` del tema (`#A21A19`): ese es casi el guinda
 * institucional, que está por toda la interfaz, y el estado más importante de la
 * pantalla no puede confundirse con el color de la marca.
 */
export const ESTADO: Record<Enums<'estado_existencia'>, AspectoEstado> = {
  disponible: { etiqueta: 'Disponible', color: '#2E7D32' },
  stock_bajo: { etiqueta: 'Stock bajo', color: '#B26A00' },
  agotado: { etiqueta: 'Agotado', color: '#D32F2F' },
  contaminado: { etiqueta: 'Contaminado', color: '#7C3AED' },
  mantenimiento: { etiqueta: 'Mantenimiento', color: '#ED5E17' },
  baja: { etiqueta: 'Baja', color: '#6F6F6E' },
}

const SIN_ESTADO: AspectoEstado = { etiqueta: '—', color: '#6F6F6E' }

/**
 * En la tabla `estado` es `not null`, pero la vista lo expone anulable —a través
 * de una vista Postgres no promete la no-nulidad— y el tipo generado lo refleja.
 * El caso no ocurre en la práctica; se resuelve aquí, en un solo sitio, en vez
 * de con un `?.` repetido por cada componente que pinta un estado.
 */
export function aspectoDeEstado(estado: Enums<'estado_existencia'> | null): AspectoEstado {
  if (estado === null) return SIN_ESTADO
  return ESTADO[estado] ?? SIN_ESTADO
}

/**
 * Por qué el cargador apartó un renglón. Viven aquí, y no en `pendientes.ts`,
 * por la misma razón que `ESTADO`: son un atributo del dato —lo que en una
 * gráfica sería la serie— y la regla del proyecto es que ningún componente
 * escriba un hex. Se reusan los mismos tonos que ya están razonados arriba.
 *
 * `regla` en ámbar y `posible_duplicado` en violeta porque son dos trabajos
 * distintos: uno se arregla corrigiendo el dato, el otro decidiendo si son dos
 * cosas o una. Quien revisa agrupa por eso, no por gravedad.
 */
export const MOTIVO: Record<Enums<'motivo_pendiente'>, AspectoEstado> = {
  regla: { etiqueta: 'Regla de captura', color: '#B26A00' },
  posible_duplicado: { etiqueta: 'Posible duplicado', color: '#7C3AED' },
}

/**
 * En qué punto de la revisión está el renglón. `resuelto` se rotula «Cargado» y
 * no «Resuelto»: desde la migración del 26 de agosto ese estado significa que
 * la existencia ya está en el inventario, y decirlo así evita la lectura de
 * «lo miré y ya» que es justo la que dejaba el inventario sin crecer.
 */
export const REVISION: Record<Enums<'estado_pendiente'>, AspectoEstado> = {
  pendiente: { etiqueta: 'Sin revisar', color: '#B26A00' },
  resuelto: { etiqueta: 'Cargado', color: '#2E7D32' },
  descartado: { etiqueta: 'Descartado', color: '#6F6F6E' },
}
