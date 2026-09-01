/**
 * El semestre de una asignatura dentro de un programa. Vive en
 * `programa_asignatura` y no en `asignatura` porque depende de la pareja:
 * "Bioquímica" es 3° en un programa y 6° en otro.
 *
 * `null` no es un hueco ni un dato que falte: es una **optativa**, que es algo
 * que el plan de estudios sí contempla. El catálogo del prototipo trae dos.
 */
export function etiquetaSemestre(semestre: number | null): string {
  return semestre === null ? 'Optativa' : `${semestre}°`
}

/** Las opciones del selector, en el orden en que se ofrecen. */
export const SEMESTRES: { valor: number | null; etiqueta: string }[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ valor: i + 1, etiqueta: `${i + 1}°` })),
  { valor: null, etiqueta: 'Optativa' },
]

/**
 * Agrupa las asignaturas de un programa por semestre, **con la optativa al
 * final**. Un `order by semestre` ingenuo pone los nulos primero, y entonces lo
 * primero que se ve del plan de estudios son las optativas en lugar del primer
 * semestre. Por eso el orden se decide aquí y no en la consulta.
 *
 * Dentro de cada grupo se conserva el orden en que vinieron las filas, que es
 * el que impuso la consulta.
 */
export function agruparPorSemestre<T extends { semestre: number | null }>(
  filas: T[],
): { semestre: number | null; etiqueta: string; filas: T[] }[] {
  const grupos = new Map<number | null, T[]>()

  for (const fila of filas) {
    const grupo = grupos.get(fila.semestre)
    if (grupo === undefined) grupos.set(fila.semestre, [fila])
    else grupo.push(fila)
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => {
      // Number.MAX_SAFE_INTEGER y no un `a === null ? 1 : ...` encadenado:
      // así el criterio es uno solo y no hay que razonar tres ramas.
      const izq = a ?? Number.MAX_SAFE_INTEGER
      const der = b ?? Number.MAX_SAFE_INTEGER
      return izq - der
    })
    .map(([semestre, filasDelGrupo]) => ({
      semestre,
      etiqueta: etiquetaSemestre(semestre),
      filas: filasDelGrupo,
    }))
}
