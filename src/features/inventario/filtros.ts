import type { Enums } from '@/types/database'

export type Filtros = {
  termino: string
  /**
   * Código exacto, el que llega de un escaneo (`?codigo=`). Es aparte de
   * `termino` porque aquel es un `ilike` parcial: `N3-00717` también casaría
   * con `UCL-N3-00717`.
   */
  codigo: string
  clasificacion: Enums<'clasificacion_articulo'> | 'todas'
  almacenId: number | 'todos'
  /**
   * Para el conteo físico: qué hay en un mueble y, dentro de él, en una
   * repisa. `''` es "todos"; `SIN_UBICACION` pide lo que no tiene ubicación,
   * que también hay que contar y encontrar. Solo tiene sentido con un almacén
   * elegido: las ubicaciones son de cada almacén.
   */
  mueble: string
  /** `''` es "todas". Solo se usa con un mueble concreto. */
  repisa: string
  estado: Enums<'estado_existencia'> | 'todos'
  incluirBaja: boolean
  orden: Orden
}

/**
 * Por qué columna se ordena el listado. El orden se resuelve en la base y no en
 * el cliente: la tabla está paginada, así que ordenar solo los 25 renglones que
 * ya llegaron daría 25 nombres en orden dentro de un listado que no lo está.
 */
export type Orden = 'codigo' | 'nombre_asc' | 'nombre_desc'

/**
 * `codigo` es el orden de siempre y sigue siendo el de arranque: es como está
 * numerado el inventario en papel. El alfabético es para cuando se busca algo
 * por su nombre y no se sabe su código.
 */
export const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: 'codigo', etiqueta: 'Código' },
  { valor: 'nombre_asc', etiqueta: 'Nombre (A–Z)' },
  { valor: 'nombre_desc', etiqueta: 'Nombre (Z–A)' },
]

/**
 * Las seis clasificaciones del enum. El prototipo lista cinco: se le olvida
 * `componente`, que es lo que son 15 de los artículos de Electrónica. Con cinco
 * opciones esos renglones no se pueden filtrar.
 */
export const CLASIFICACIONES: { valor: Enums<'clasificacion_articulo'>; etiqueta: string }[] = [
  { valor: 'reactivo', etiqueta: 'Reactivos' },
  { valor: 'material', etiqueta: 'Materiales' },
  { valor: 'equipo', etiqueta: 'Equipos' },
  { valor: 'insumo', etiqueta: 'Insumos' },
  { valor: 'componente', etiqueta: 'Componentes' },
  { valor: 'materia_biologica', etiqueta: 'Materia biológica' },
]

/**
 * Si lo vigente es lo de arranque no hay nada que limpiar, y el boton de
 * limpiar no tiene por que aparecer.
 */
export function hayFiltrosActivos(filtros: Filtros, iniciales: Filtros): boolean {
  const campos = Object.keys(iniciales) as (keyof Filtros)[]
  return campos.some((campo) => filtros[campo] !== iniciales[campo])
}

/**
 * Los valores de arranque, los mismos para todo el mundo.
 *
 * Ya no dependen del rol. Qué almacén se mira lo decide la pantalla —Inventario
 * queda anclado al del perfil, Inventario general arranca en los cuatro—, no los
 * filtros. Mientras esto miraba el rol, la pantalla tenía que reajustarse sola
 * cuando el perfil aterrizaba, con un `setState` durante el render y una bandera
 * para que ocurriera una sola vez.
 *
 * `baja` se esconde: algo dado de baja ya no es inventario. `agotado` NO se
 * esconde —el prototipo lo hace—, porque es justo lo que hay que reponer.
 */
export function filtrosIniciales(): Filtros {
  return {
    termino: '',
    codigo: '',
    clasificacion: 'todas',
    almacenId: 'todos',
    mueble: '',
    repisa: '',
    estado: 'todos',
    incluirBaja: false,
    orden: 'codigo',
  }
}

/**
 * El valor del selector de mueble que pide lo que no tiene ubicación. Ningún
 * mueble real se escribe así en el formato.
 */
export const SIN_UBICACION = '__sin_ubicacion__'

/**
 * Cambiar de almacén suelta el mueble y la repisa: el "Anaquel 4" de N3 no es
 * el de N4, y conservarlo dejaría la tabla vacía sin que se entienda por qué.
 * Es un solo camino para los tres sitios que cambian el almacén: el selector,
 * su chip y la tira de almacenes.
 */
export function conAlmacen(filtros: Filtros, almacenId: Filtros['almacenId']): Filtros {
  return { ...filtros, almacenId, mueble: '', repisa: '' }
}

export type Mueble = { nombre: string; repisas: string[] }

const COMPARAR = new Intl.Collator('es', { numeric: true, sensitivity: 'base' }).compare

/**
 * Los muebles de un almacén con sus repisas, a partir de los `componentes` de
 * sus ubicaciones.
 *
 * Los valores se comparan tal cual vienen, sin recortar ni pasar a minúsculas:
 * el filtro es un `contains` exacto sobre el jsonb, y una opción que no casa
 * con el dato guardado devolvería la tabla vacía. Si en el formato conviven
 * "Anaquel 4" y "anaquel 4", aquí salen las dos, y eso hay que corregirlo en
 * los datos, no esconderlo aquí.
 *
 * El orden es numérico ("Anaquel 2" antes que "Anaquel 10"), que es como se
 * recorre el almacén.
 */
export function mueblesDe(componentes: unknown[]): Mueble[] {
  const porMueble = new Map<string, Set<string>>()

  for (const c of componentes) {
    if (c === null || typeof c !== 'object' || Array.isArray(c)) continue
    const { mueble, repisa } = c as Record<string, unknown>
    if (typeof mueble !== 'string' || mueble === '') continue

    const repisas = porMueble.get(mueble) ?? new Set<string>()
    if (typeof repisa === 'string' && repisa !== '') repisas.add(repisa)
    porMueble.set(mueble, repisas)
  }

  return [...porMueble]
    .map(([nombre, repisas]) => ({ nombre, repisas: [...repisas].sort(COMPARAR) }))
    .sort((a, b) => COMPARAR(a.nombre, b.nombre))
}
