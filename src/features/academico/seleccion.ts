/**
 * Qué está elegido en cada una de las tres columnas.
 *
 * Vive aparte de la pantalla y sin React porque es la regla que más fácil se
 * rompe al tocar el componente: elegir otro programa TIENE que limpiar lo de
 * abajo. Si no, la columna de prácticas sigue mostrando las de la selección
 * anterior, que ya no cuelgan de nada visible. El prototipo tuvo que parchearlo
 * a mano en cada `onValueChange`, y por eso aquí es una función con prueba.
 */
export type Seleccion = {
  programaId: number | null
  asignaturaId: number | null
  practicaId: number | null
}

export const SELECCION_VACIA: Seleccion = {
  programaId: null,
  asignaturaId: null,
  practicaId: null,
}

/**
 * Reelegir lo mismo devuelve el objeto tal cual, no uno nuevo equivalente: así
 * un clic en lo que ya estaba elegido no vacía las columnas de la derecha, y de
 * paso no dispara un renderizado de más.
 */
export function elegirPrograma(actual: Seleccion, programaId: number): Seleccion {
  if (actual.programaId === programaId) return actual
  return { programaId, asignaturaId: null, practicaId: null }
}

export function elegirAsignatura(actual: Seleccion, asignaturaId: number): Seleccion {
  if (actual.asignaturaId === asignaturaId) return actual
  return { ...actual, asignaturaId, practicaId: null }
}

export function elegirPractica(actual: Seleccion, practicaId: number): Seleccion {
  if (actual.practicaId === practicaId) return actual
  return { ...actual, practicaId }
}
