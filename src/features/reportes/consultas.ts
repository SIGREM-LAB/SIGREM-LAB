import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { traerTodo } from './paginacion'

/*
 * Aqui NO se importa `aExcel`, y no es casualidad.
 *
 * Esa pieza arrastra exceljs, 920 kB. Con las dos pantallas del modulo
 * importando un mismo `consultas.ts`, el empaquetador lo saco a un chunk
 * compartido y entrar solo a capturar minimos -que no genera ni un archivo- lo
 * descargaba igual. Generar vive en `generarReporte.ts` por eso.
 */

/**
 * Un articulo del almacen con su minimo, si lo tiene.
 *
 * Vive aqui y no en `TablaMinimos` porque es la forma que produce la consulta;
 * la tabla la recibe por props, que es lo que la deja probarse sin red.
 */
export type ArticuloConMinimo = {
  articulo_id: number
  nombre: string
  clasificacion: string
  unidad: string
  minimo: number | null
}

/**
 * Los articulos presentes en el almacen, con su minimo si ya lo tiene.
 *
 * `minimo_articulo` entra por la izquierda y no es el origen: la pantalla
 * existe para capturar los que NO lo tienen, asi que partir de esa tabla
 * mostraria solo lo ya hecho.
 */
export function useArticulosDelAlmacen(almacenId: number | null) {
  return useQuery({
    queryKey: ['articulos-con-minimo', almacenId],
    enabled: almacenId !== null,
    queryFn: async () => {
      // Las columnas van nulables porque `existencia_listado` es una vista y
      // Postgres no puede probar que no lo sean; en los datos nunca lo son.
      const filas = await traerTodo<{
        articulo_id: number | null
        nombre_canonico: string | null
        clasificacion: string | null
        unidad_base: string | null
      }>((desde, hasta) =>
        supabase
          .from('existencia_listado')
          .select('articulo_id, nombre_canonico, clasificacion, unidad_base')
          .eq('almacen_id', almacenId as number)
          .range(desde, hasta),
      )

      const { data: minimos, error } = await supabase
        .from('minimo_articulo')
        .select('articulo_id, minimo')
        .eq('almacen_id', almacenId as number)
      if (error) throw error

      const porArticulo = new Map(minimos?.map((m) => [m.articulo_id, Number(m.minimo)]))

      // `existencia_listado` trae un renglon por envase y la pantalla es por
      // articulo. Se colapsa aqui y no en la base porque la vista ya existe y
      // sirve tal cual a la pantalla de inventario.
      const unicos = new Map<number, ArticuloConMinimo>()
      for (const e of filas) {
        if (e.articulo_id === null || unicos.has(e.articulo_id)) continue
        unicos.set(e.articulo_id, {
          articulo_id: e.articulo_id,
          nombre: e.nombre_canonico ?? '(sin nombre)',
          clasificacion: e.clasificacion ?? '',
          unidad: e.unidad_base ?? '',
          minimo: porArticulo.get(e.articulo_id) ?? null,
        })
      }

      return [...unicos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    },
  })
}

/**
 * Alta y edicion en una: la llave es el par (articulo, almacen), asi que un
 * upsert ES la operacion. Vaciar el campo borra el renglon; nunca lo pone en
 * cero, porque `minimo_articulo_positivo` lo rechaza y porque «no repongo
 * esto» se dice quitando la fila.
 */
export function useGuardarMinimo() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (v: {
      articuloId: number
      almacenId: number
      minimo: number | null
    }) => {
      if (v.minimo === null) {
        const { error } = await supabase
          .from('minimo_articulo')
          .delete()
          .eq('articulo_id', v.articuloId)
          .eq('almacen_id', v.almacenId)
        if (error) throw error
        return
      }

      const { error } = await supabase.from('minimo_articulo').upsert({
        articulo_id: v.articuloId,
        almacen_id: v.almacenId,
        minimo: v.minimo,
      })
      if (error) throw error
    },

    onSuccess: (_, v) => {
      cliente.invalidateQueries({ queryKey: ['articulos-con-minimo', v.almacenId] })
    },
  })
}
