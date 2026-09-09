import { restaurarBorrador } from './borrador'

/**
 * Los dos estados de una práctica.
 *
 * No son una columna de la base y no deberían llegar a serlo: salen de en qué
 * tabla vive el renglón. `practica_borrador` es lo que se está capturando,
 * `practica` es lo que ya ocurrió. Eso es lo que deja intacta la invariante del
 * esquema —una fila en `practica` es un hecho ocurrido— y lo que hace que este
 * listado no haya costado migración.
 *
 * Si alguna vez hace falta un tercer estado, el lugar de la decisión es el spec
 * del 8 de septiembre, no esta línea.
 */
export type EstadoPractica = 'en_curso' | 'finalizada'

/**
 * Un renglón del historial. Los dos estados comparten forma para que la tabla
 * sea una sola, con una sola columna por concepto.
 *
 * Casi todo es anulable porque el borrador tiene derecho a estar a medias: se
 * puede guardar antes de elegir asignatura, y su folio no existe hasta que el
 * trigger lo asigna al finalizar.
 */
export type FilaHistorial = {
  /** Estable y única entre las dos fuentes: sirve de `key` de React. */
  clave: string
  estado: EstadoPractica
  practicaId: number | null
  folio: string | null
  fecha: string | null
  asignatura: string | null
  laboratorio: string | null
  productos: number
}

/** La forma que devuelve la consulta del historial, con sus recursos embebidos. */
export type FilaPractica = {
  id: number
  folio: string | null
  fecha: string
  asignatura: { nombre: string } | null
  laboratorio: { nombre: string }
  practica_elemento: { count: number }[]
}

/**
 * El renglón "En curso", armado desde el `jsonb` del borrador.
 *
 * Devuelve `null` —y no un renglón con huecos— cuando el contenido no se
 * entiende: un borrador de otra versión ya no se puede continuar, así que
 * ofrecerlo en la tabla sería ofrecer un botón que lleva a un aviso de error.
 */
export function filaDeBorrador(crudo: unknown): FilaHistorial | null {
  const contenido = restaurarBorrador(crudo)
  if (contenido === null) return null

  return {
    clave: 'borrador',
    estado: 'en_curso',
    practicaId: null,
    folio: null,
    fecha: contenido.cabecera.fecha ?? null,
    asignatura: contenido.nombres.asignatura,
    laboratorio: contenido.nombres.laboratorio,
    productos: contenido.elementos.length,
  }
}

/**
 * El renglón de una práctica ya registrada.
 *
 * El conteo llega como recurso embebido —`practica_elemento (count)`— así que
 * PostgREST lo resuelve en la misma consulta y no hay que traer los elementos
 * para saber cuántos son.
 */
export function filaDePractica(fila: FilaPractica): FilaHistorial {
  return {
    clave: `practica-${fila.id}`,
    estado: 'finalizada',
    practicaId: fila.id,
    folio: fila.folio,
    fecha: fila.fecha,
    asignatura: fila.asignatura?.nombre ?? null,
    laboratorio: fila.laboratorio.nombre,
    productos: fila.practica_elemento[0]?.count ?? 0,
  }
}

/**
 * El listado completo: el borrador, si hay y se entiende, y luego lo registrado.
 *
 * El borrador va primero aunque su fecha sea más vieja. No es un criterio de
 * orden sino de importancia: es el único renglón accionable de la pantalla y el
 * único que se puede perder. Intercalado por fecha acabaría en la página tres.
 */
export function componerHistorial(
  borradorCrudo: unknown,
  practicas: FilaHistorial[],
): FilaHistorial[] {
  const borrador = filaDeBorrador(borradorCrudo)
  return borrador === null ? practicas : [borrador, ...practicas]
}
