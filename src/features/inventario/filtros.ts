import type { Enums } from '@/types/database'

export type Filtros = {
  termino: string
  clasificacion: Enums<'clasificacion_articulo'> | 'todas'
  almacenId: number | 'todos'
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
    clasificacion: 'todas',
    almacenId: 'todos',
    estado: 'todos',
    incluirBaja: false,
    orden: 'codigo',
  }
}
