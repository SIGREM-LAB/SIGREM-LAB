import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Filtros } from './filtros'
import type { Movimiento } from './PanelExistencia'
import { normalizarTermino } from './presentacion'

/**
 * El listado. La `queryKey` lleva los filtros completos y la página: sin eso,
 * cambiar de almacén devuelve la caché del anterior.
 *
 * `keepPreviousData` evita que la tabla parpadee a esqueleto en cada tecla: se
 * queda con la página anterior mientras llega la nueva.
 */
export function useExistencias(filtros: Filtros, pagina: number, porPagina: number) {
  return useQuery({
    queryKey: ['existencias', filtros, pagina, porPagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let consulta = supabase
        .from('existencia_listado')
        .select('*', { count: 'exact' })
        .order('codigo')

      if (filtros.almacenId !== 'todos') consulta = consulta.eq('almacen_id', filtros.almacenId)
      if (filtros.clasificacion !== 'todas') {
        consulta = consulta.eq('clasificacion', filtros.clasificacion)
      }

      // Si se pide un estado concreto, ese manda: pedir "Baja" explícitamente y
      // que la casilla lo esconda sería absurdo.
      if (filtros.estado !== 'todos') consulta = consulta.eq('estado', filtros.estado)
      else if (!filtros.incluirBaja) consulta = consulta.neq('estado', 'baja')

      const termino = normalizarTermino(filtros.termino)
      if (termino !== '') {
        // `nombre_norm` y `marca_norm` ya vienen en minúsculas y sin acentos, así
        // que aquí va `like` y no `ilike`: es lo que deja que el predicado use el
        // índice trigram. `codigo` no está normalizado, y ahí sí `ilike`.
        consulta = consulta.or(
          `nombre_norm.like.*${termino}*,marca_norm.like.*${termino}*,codigo.ilike.*${termino}*`,
        )
      }

      const desde = pagina * porPagina
      const { data, error, count } = await consulta.range(desde, desde + porPagina - 1)
      if (error) throw error

      return { filas: data, total: count ?? 0 }
    },
  })
}

/** El historial del panel de detalle. No se pide hasta que hay panel abierto. */
export function useMovimientos(existenciaId: number | null) {
  return useQuery({
    queryKey: ['movimientos', existenciaId],
    enabled: existenciaId !== null,
    queryFn: async (): Promise<Movimiento[]> => {
      const { data, error } = await supabase
        .from('movimiento')
        .select('id, tipo, cantidad, cantidad_despues, ocurrido_en, motivo')
        .eq('existencia_id', existenciaId as number)
        .order('ocurrido_en', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
  })
}

/**
 * Los campos que no caben en el listado y sólo importan cuando abres una fila:
 * los de reactivo (CAS y rombo NFPA), los de equipo y los de materia biológica.
 * Van en su propia consulta porque traerlos en el listado sería pedir tres
 * tablas más por cada uno de los 25 renglones de la página.
 */
export function useDetalleExistencia(existenciaId: number | null) {
  return useQuery({
    queryKey: ['detalle-existencia', existenciaId],
    enabled: existenciaId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('existencia')
        .select(
          `modelo, presentacion, numero_serie, numero_inventario_uaeh, funcionamiento,
           mantenimiento, fecha_chequeo, metodo_conservacion, temperatura,
           fecha_recoleccion, fecha_preparacion, responsable_muestra,
           peso_frasco_vacio, peso_total, fecha_adquisicion, fecha_caducidad, observaciones,
           articulo:articulo_id (
             familia,
             articulo_reactivo ( cas, estado_fisico, color_almacenaje, tiene_hoja_seguridad,
                                 riesgo_salud, riesgo_inflamabilidad, riesgo_reactividad,
                                 peligro_especial ),
             articulo_biologico ( origen_especie )
           )`,
        )
        .eq('id', existenciaId as number)
        .single()
      if (error) throw error
      return data
    },
  })
}

/** Los cuatro almacenes, para el select del filtro. Cambian casi nunca. */
export function useAlmacenes() {
  return useQuery({
    queryKey: ['almacenes'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('almacen')
        .select('id, clave')
        .eq('activo', true)
        .order('clave')
      if (error) throw error
      return data
    },
  })
}
