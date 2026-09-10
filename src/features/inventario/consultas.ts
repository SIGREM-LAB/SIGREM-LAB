import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Enums, Json } from '@/types/database'
import type { Campo } from './campos'
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
      let consulta = supabase.from('existencia_listado').select('*', { count: 'exact' })

      // El alfabético va sobre `nombre_norm` y no sobre `nombre_canonico`: es
      // la misma columna ya en minúsculas y sin acentos, así que «Zinc» no se
      // adelanta a «ácido acético», que es lo que hace la colación en crudo.
      // `codigo` desempata siempre: sin un criterio único, dos páginas
      // seguidas pueden repetir o saltarse un renglón con nombres iguales.
      consulta =
        filtros.orden === 'codigo'
          ? consulta.order('codigo')
          : consulta
              .order('nombre_norm', { ascending: filtros.orden === 'nombre_asc' })
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
 *
 * El almacen es obligatorio y no admite 'todos'. Su unico consumidor es
 * Inventario, que esta anclado a una bodega y siempre tiene una; admitir 'todos'
 * seria escribir hoy una rama que nadie recorre. Sin el, esta cabecera diria
 * "1278 existencias" encima de una tabla de 300.
 */
export function useResumenEstados(almacenId: number) {
  return useQuery({
    queryKey: ['resumen-estados', almacenId],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const contar = async (estado?: Enums<'estado_existencia'>) => {
        const base = supabase
          .from('existencia_listado')
          .select('id', { count: 'exact', head: true })
          .eq('almacen_id', almacenId)
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
 *
 * `habilitado` existe para la tira de almacenes, que solo se dibuja en Inventario
 * general: en Inventario, anclado a una bodega, estos veinte números no se
 * enseñan en ningún sitio y pedirlos sería un viaje por página vista.
 */
export function useResumenAlmacenes(habilitado = true) {
  return useQuery({
    queryKey: ['resumen-almacenes'],
    enabled: habilitado,
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
 * Las llaves de todo lo que deja de ser cierto cuando el inventario crece: el
 * listado y las dos cabeceras de cifras. Van juntas porque toda mutación que
 * mueva existencias tiene que invalidar lo mismo, y repartirlas fue siempre el
 * camino a que una de ellas se olvide de una.
 */
const INVENTARIO = [['existencias'], ['resumen-estados'], ['resumen-almacenes']]

/**
 * Lo anterior más la cola de depuración, que solo cambia cuando el renglón que
 * entró al inventario salía de ella. El alta desde la pantalla no toca esas dos
 * llaves y por eso no las invalida: pedirlas de nuevo serían dos viajes para
 * volver a recibir el mismo número.
 */
const AFECTADAS = [['pendientes'], ['resumen-pendientes'], ...INVENTARIO]

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

/**
 * Los campos del alta para un almacén y un tipo. La pantalla los pinta; no los
 * decide.
 *
 * La `queryKey` lleva las dos variables: sin la clasificación, cambiar de tipo
 * en el diálogo devolvería los campos del tipo anterior, que es justo el error
 * que el formulario dinámico no puede permitirse.
 *
 * `staleTime` largo porque un perfil de captura cambia cuando un admin lo
 * cambia, y eso ocurre casi nunca.
 */
export function useFormulario(
  almacenId: number,
  clasificacion: Enums<'clasificacion_articulo'> | null,
) {
  return useQuery({
    queryKey: ['formulario', almacenId, clasificacion],
    enabled: clasificacion !== null,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Campo[]> => {
      const { data, error } = await supabase.rpc('formulario', {
        p_almacen: almacenId,
        p_clasificacion: clasificacion as Enums<'clasificacion_articulo'>,
      })
      if (error) throw error
      return data
    },
  })
}

/**
 * Los laboratorios de un almacén, para el campo `laboratorio` del alta.
 *
 * Es el único `seleccion` cuyas opciones no vienen en `campo_capturable`: su
 * propia ayuda lo dice, «las opciones salen de la tabla laboratorio del
 * almacén». Se piden aparte y solo cuando el perfil incluye ese campo.
 */
export function useLaboratorios(almacenId: number, habilitado: boolean) {
  return useQuery({
    queryKey: ['laboratorios', almacenId],
    enabled: habilitado,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('laboratorio')
        .select('id, nombre')
        .eq('almacen_id', almacenId)
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data
    },
  })
}

/**
 * Buscar antes de crear. Alimenta el «¿te refieres a alguno de estos?» que va
 * bajo el nombre del artículo.
 *
 * No bloquea el alta: sugiere. Quien captura tiene el frasco en la mano y sabe
 * si su «Zinc en polvo 93%» es el «Zinc en polvo 95%» que ya está cargado —no
 * lo es, y el esquema dice que son dos artículos—. Lo que esta lista evita es
 * el duplicado por errata, que es el caso común.
 *
 * Menos de tres letras no se pregunta: con una o dos, la similitud por
 * trigramas devuelve medio catálogo.
 */
export function useBuscarArticulo(termino: string) {
  const limpio = termino.trim()

  return useQuery({
    queryKey: ['buscar-articulo', limpio],
    enabled: limpio.length >= 3,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_articulo', {
        termino: limpio,
        maximo: 5,
      })
      if (error) throw error
      return data
    },
  })
}

/**
 * El alta. Una sola llamada a `crear_existencia`, que en la base crea el
 * artículo si hace falta, su ficha normativa, la ubicación, la existencia y el
 * movimiento de `carga_inicial` —todo en una transacción—.
 *
 * No son cinco `insert` encadenados desde aquí a propósito: encadenados, una
 * caída de red entre el tercero y el cuarto deja un artículo creado sin
 * existencia, o una existencia en cero porque el movimiento no llegó. Una
 * función es una transacción; o pasa todo o no pasa nada.
 *
 * `almacen_id` se manda y la RLS lo comprueba: `crear_existencia` es SECURITY
 * INVOKER, así que mandar el de otro almacén falla como debe.
 */
export function useCrearExistencia() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: {
      almacenId: number
      clasificacion: Enums<'clasificacion_articulo'>
      valores: Record<string, string | boolean>
    }) => {
      const { data, error } = await supabase.rpc('crear_existencia', {
        p_almacen: v.almacenId,
        p_clasificacion: v.clasificacion,
        p_valores: v.valores,
      })
      if (error) throw error

      // `returns table` llega como arreglo aunque sea un solo renglón.
      return data[0] ?? null
    },
    onSuccess: () => {
      for (const queryKey of INVENTARIO) qc.invalidateQueries({ queryKey })
    },
  })
}
