import type { Enums } from '@/types/database'

export type Filtros = {
  termino: string
  clasificacion: Enums<'clasificacion_articulo'> | 'todas'
  almacenId: number | 'todos'
  estado: Enums<'estado_existencia'> | 'todos'
  incluirBaja: boolean
}

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
 * Un responsable arranca en su propio almacén, que es donde trabaja. Admin y
 * consulta arrancan viendo los cuatro, porque su trabajo es el conjunto —y eso
 * vale también para un usuario de consulta con almacén asignado, que sigue
 * siendo de solo lectura.
 *
 * `baja` se esconde: algo dado de baja ya no es inventario. `agotado` NO se
 * esconde —el prototipo lo hace—, porque es justo lo que hay que reponer.
 *
 * `perfil` llega en `undefined` mientras su consulta está en vuelo, y para
 * entonces la pantalla ya se está pintando.
 */
/**
 * Si lo vigente es lo de arranque no hay nada que limpiar, y el boton de
 * limpiar no tiene por que aparecer.
 */
export function hayFiltrosActivos(filtros: Filtros, iniciales: Filtros): boolean {
  const campos = Object.keys(iniciales) as (keyof Filtros)[]
  return campos.some((campo) => filtros[campo] !== iniciales[campo])
}

export function filtrosIniciales(
  perfil: { rol: Enums<'rol_usuario'>; almacenId: number | null } | undefined,
): Filtros {
  const propio = perfil?.rol === 'responsable' && perfil.almacenId !== null

  return {
    termino: '',
    clasificacion: 'todas',
    almacenId: propio ? (perfil.almacenId as number) : 'todos',
    estado: 'todos',
    incluirBaja: false,
  }
}
