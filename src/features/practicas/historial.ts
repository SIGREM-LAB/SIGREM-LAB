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
  /** Sólo en "En curso": es a dónde navega Continuar y qué borra Descartar. */
  borradorId: number | null
  folio: string | null
  fecha: string | null
  asignatura: string | null
  laboratorio: string | null
  productos: number
}

/** Lo mínimo que trae una fila de `practica_borrador` para armar el renglón. */
export type BorradorCrudo = {
  id: number
  contenido: unknown
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
export function filaDeBorrador(borrador: BorradorCrudo): FilaHistorial | null {
  const contenido = restaurarBorrador(borrador.contenido)
  if (contenido === null) return null

  return {
    clave: `borrador-${borrador.id}`,
    estado: 'en_curso',
    practicaId: null,
    borradorId: borrador.id,
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
    borradorId: null,
    folio: fila.folio,
    fecha: fila.fecha,
    asignatura: fila.asignatura?.nombre ?? null,
    laboratorio: fila.laboratorio.nombre,
    productos: fila.practica_elemento[0]?.count ?? 0,
  }
}

/**
 * El listado completo: los borradores que se entienden, y luego lo registrado.
 *
 * Los borradores van primero aunque su fecha sea más vieja. No es un criterio
 * de orden sino de importancia: son los únicos renglones accionables de la
 * pantalla y lo único que se puede perder. Intercalados por fecha acabarían en
 * la página tres. Cada uno conserva el orden en que llegó —más reciente
 * primero—, que es el de `actualizado_en`.
 */
export function componerHistorial(
  borradores: BorradorCrudo[],
  practicas: FilaHistorial[],
): FilaHistorial[] {
  const enCurso = borradores
    .map(filaDeBorrador)
    .filter((fila): fila is FilaHistorial => fila !== null)
  return [...enCurso, ...practicas]
}
