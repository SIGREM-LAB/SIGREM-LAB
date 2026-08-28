import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Enums, Json } from '@/types/database'
import type { Filtros } from './filtros'
import type { ResumenAlmacen } from './menu'
import type { Movimiento } from './PanelExistencia'
import type { FiltrosPendientes } from './pendientes'
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

/**
 * Las cifras de la cabecera. No dependen de los filtros a proposito: son el
 * tamano del inventario, y si se movieran con cada filtro dejarian de servir
 * como referencia —y volverian a mover la pantalla, que es lo que se quiere
 * evitar—.
 *
 * Cinco conteos con `head: true`: PostgREST devuelve el total en la cabecera
 * `Content-Range` y ni un renglon de datos. Van en paralelo porque ninguno
 * depende del anterior; en serie serian cinco viajes encadenados.
 *
 * Se cuenta sobre `existencia_listado` y no sobre `existencia` para que el
 * numero de la cabecera y el de la tabla salgan de la misma fuente.
 */
export function useResumenEstados() {
  return useQuery({
    queryKey: ['resumen-estados'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const contar = async (estado?: Enums<'estado_existencia'>) => {
        const base = supabase.from('existencia_listado').select('id', { count: 'exact', head: true })
        // Sin estado se cuenta el inventario vivo: lo dado de baja ya no lo es.
        const { count, error } = await (estado === undefined
          ? base.neq('estado', 'baja')
          : base.eq('estado', estado))
        if (error) throw error
        return count ?? 0
      }

      const [total, disponible, stockBajo, agotado, mantenimiento] = await Promise.all([
        contar(),
        contar('disponible'),
        contar('stock_bajo'),
        contar('agotado'),
        contar('mantenimiento'),
      ])

      return { total, disponible, stockBajo, agotado, mantenimiento }
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

/**
 * El resumen que pinta el menú principal: por almacén, cuánto hay y cómo está
 * repartido entre los estados.
 *
 * Sale de la vista `almacen_resumen`, que agrega en la base. Antes esto se
 * resolvía con `almacen(..., existencia(id))`, que traía un renglón por
 * existencia solo para medir el largo del arreglo: con el inventario completo
 * cargado son miles de renglones por cada visita al menú para pintar veinte
 * números.
 *
 * `activo` se filtra aquí y no dentro de la vista, igual que en
 * `useAlmacenes`: una vista que esconde renglones descuadra las cuentas sin
 * que se vea por qué.
 */
export function useResumenAlmacenes() {
  return useQuery({
    queryKey: ['resumen-almacenes'],
    queryFn: async (): Promise<ResumenAlmacen[]> => {
      const { data, error } = await supabase
        .from('almacen_resumen')
        .select('*')
        .eq('activo', true)
        .order('clave')
      if (error) throw error

      // La vista expone todas sus columnas anulables —a través de una vista
      // Postgres no promete la no-nulidad— y ninguna lo es en la práctica. Se
      // resuelve aquí, en un solo sitio, en vez de con un `?? 0` repetido por
      // cada número de la pantalla.
      return data.map((a) => ({
        id: a.id ?? 0,
        clave: a.clave ?? '',
        nombre: a.nombre ?? '',
        total: a.total ?? 0,
        disponible: a.disponible ?? 0,
        stockBajo: a.stock_bajo ?? 0,
        agotado: a.agotado ?? 0,
        contaminado: a.contaminado ?? 0,
        mantenimiento: a.mantenimiento ?? 0,
      }))
    },
  })
}

/**
 * La cola de depuración: los renglones que el cargador no pudo resolver solo.
 *
 * El filtro es `(almacen_id, estado)`, que es exactamente el índice
 * `carga_pendiente_almacen_estado_idx`. El orden —archivo, hoja, fila— es el
 * del Excel, porque quien revisa trabaja con el archivo abierto al lado, y
 * `id` al final lo hace determinista también con «todos los almacenes»
 * seleccionado: sin desempate, dos páginas consecutivas pueden repetir o
 * saltarse un renglón.
 */
export function usePendientes(filtros: FiltrosPendientes, pagina: number, porPagina: number) {
  return useQuery({
    queryKey: ['pendientes', filtros, pagina, porPagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let consulta = supabase
        .from('carga_pendiente')
        .select('*', { count: 'exact' })
        .order('archivo')
        .order('hoja')
        .order('fila')
        .order('id')

      if (filtros.almacenId !== 'todos') consulta = consulta.eq('almacen_id', filtros.almacenId)
      if (filtros.estado !== 'todos') consulta = consulta.eq('estado', filtros.estado)
      if (filtros.motivo !== 'todos') consulta = consulta.eq('motivo', filtros.motivo)

      const desde = pagina * porPagina
      const { data, error, count } = await consulta.range(desde, desde + porPagina - 1)
      if (error) throw error

      return { filas: data, total: count ?? 0 }
    },
  })
}

/**
 * Cuánto queda por revisar, cuánto se cargó y cuánto se descartó. Tres conteos
 * con `head: true`: PostgREST devuelve el total en `Content-Range` y ni un
 * renglón de datos.
 *
 * Depende del almacén y no de los demás filtros a propósito: es el tamaño del
 * trabajo, y si se moviera al filtrar por motivo dejaría de servir de
 * referencia.
 */
export function useResumenPendientes(almacenId: number | 'todos') {
  return useQuery({
    queryKey: ['resumen-pendientes', almacenId],
    queryFn: async () => {
      const contar = async (estado: Enums<'estado_pendiente'>) => {
        let consulta = supabase
          .from('carga_pendiente')
          .select('id', { count: 'exact', head: true })
          .eq('estado', estado)
        if (almacenId !== 'todos') consulta = consulta.eq('almacen_id', almacenId)

        const { count, error } = await consulta
        if (error) throw error
        return count ?? 0
      }

      const [pendiente, resuelto, descartado] = await Promise.all([
        contar('pendiente'),
        contar('resuelto'),
        contar('descartado'),
      ])

      return { pendiente, resuelto, descartado }
    },
  })
}

/**
 * La existencia que hay que pintar al lado del renglón: con la que chocó
 * (`existencia_id`) o en la que se convirtió (`existencia_resuelta_id`).
 *
 * Sale de `existencia_listado` y no de `existencia` porque ahí el nombre del
 * artículo y la ubicación ya vienen aplanados, que es justo lo que se compara.
 */
export function useExistenciaResumen(existenciaId: number | null) {
  return useQuery({
    queryKey: ['existencia-resumen', existenciaId],
    enabled: existenciaId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('existencia_listado')
        .select('*')
        .eq('id', existenciaId as number)
        .single()
      if (error) throw error
      return data
    },
  })
}

/**
 * Las llaves de todo lo que deja de ser cierto cuando un renglón entra al
 * inventario. Van juntas porque las dos mutaciones de abajo tienen que
 * invalidar lo mismo, y repartirlas fue siempre el camino a que una de ellas se
 * olvide de una.
 */
const AFECTADAS = [
  ['pendientes'],
  ['resumen-pendientes'],
  ['existencias'],
  ['resumen-estados'],
  ['resumen-almacenes'],
]

/**
 * El visto bueno que sí carga. Llama a `public.resolver_pendiente`, que crea la
 * existencia con el renglón ya corregido —o le suma a la que chocó— y cierra el
 * pendiente, todo en una transacción.
 *
 * `revisado_por` NO se manda: lo pone un trigger. Mandarlo no serviría de nada
 * porque lo sobrescribe, y poder mandarlo sería poder firmar en nombre de otro.
 */
export function useResolverPendiente() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: {
      pendiente: number
      renglon: Json
      veredicto: Enums<'veredicto_pendiente'>
      nota: string | null
    }) => {
      const { data, error } = await supabase.rpc('resolver_pendiente', {
        p_pendiente: v.pendiente,
        p_renglon: v.renglon,
        p_veredicto: v.veredicto,
        // `undefined` y no `null`: el argumento es opcional en la firma, y
        // omitirlo deja el `default null` de la funcion, que es lo mismo.
        p_nota: v.nota ?? undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      for (const queryKey of AFECTADAS) qc.invalidateQueries({ queryKey })
    },
  })
}

/**
 * Guardar la corrección a medias, o descartar el renglón.
 *
 * Solo toca `renglon`, `estado` y `nota`: es lo único que el `grant update` por
 * columnas permite desde el cliente. `archivo`, `hoja`, `fila`, `motivo` y
 * `problemas` son el hallazgo del cargador y no se editan desde aquí.
 *
 * `estado` solo puede valer `pendiente` o `descartado` por este camino: llegar
 * a `resuelto` exige la existencia, y eso únicamente lo puede hacer
 * `resolver_pendiente`.
 */
export function useActualizarPendiente() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: {
      pendiente: number
      renglon: Json
      nota: string | null
      estado?: Extract<Enums<'estado_pendiente'>, 'pendiente' | 'descartado'>
    }) => {
      const { error } = await supabase
        .from('carga_pendiente')
        .update(v.estado === undefined
          ? { renglon: v.renglon, nota: v.nota }
          : { renglon: v.renglon, nota: v.nota, estado: v.estado })
        .eq('id', v.pendiente)
      if (error) throw error
    },
    onSuccess: () => {
      for (const queryKey of AFECTADAS) qc.invalidateQueries({ queryKey })
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
