import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import { aExcel, descargar, type Columna, type HojaLista } from './aExcel'
import { traerTodo } from './paginacion'
import { nombreDeArchivo, type Reporte } from './registro'

type Fila = Record<string, unknown>

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
 * Genera y descarga.
 *
 * Va como mutacion y no como query: no es un dato que se cachea, es una accion
 * con efecto -un archivo en Descargas- que se dispara cuando alguien pulsa el
 * boton.
 */
export function useGenerarReporte() {
  return useMutation({
    mutationFn: async (v: {
      reporte: Reporte
      parametros: Record<string, unknown>
      almacenClave: string
      etiquetas: { etiqueta: string; valor: string }[]
    }) => {
      const hojas: HojaLista[] =
        v.reporte.id === 'inventario'
          ? await hojasDelFormato(v.parametros.p_almacen as number)
          : await Promise.all(
              v.reporte.hojas.map(async (h) => ({
                nombre: h.nombre,
                columnas: h.columnas,
                filas: await traerTodo<Fila>((desde, hasta) =>
                  // @ts-expect-error El nombre de la RPC vive en el registro,
                  // que es datos: supabase-js quiere un literal de su union.
                  supabase.rpc(h.rpc, v.parametros).range(desde, hasta),
                ),
              })),
            )

      // Un libro con TODAS las hojas vacias no se descarga. Hoy le pasa al de
      // caducidades: 0 de 2,526 existencias tienen fecha, porque el formato
      // unificado no trae columna de caducidad en ninguna hoja. Un Excel en
      // blanco parece un inventario sano; el aviso dice que no hay datos.
      if (hojas.every((h) => h.filas.length === 0)) {
        throw new Error(
          `No hay datos para «${v.reporte.titulo}» con estos parámetros. ` +
            'No se generó ningún archivo.',
        )
      }

      const buffer = await aExcel({
        titulo: v.reporte.titulo,
        parametros: v.etiquetas,
        hojas,
      })

      descargar(buffer, nombreDeArchivo(v.reporte, v.almacenClave))
    },
  })
}

/**
 * El formato unificado: las hojas y sus columnas salen de la base, no del
 * registro.
 *
 * Un libro por almacen con una hoja por clasificacion, que es como los
 * almacenes entregan de verdad -lo dice el docstring de `leer_libro` en el ETL,
 * tras haberse tropezado con el archivo real de N3-.
 */
async function hojasDelFormato(almacenId: number): Promise<HojaLista[]> {
  const { data: definicion, error } = await supabase
    .from('hoja_formato')
    .select('hoja, orden')
    .order('orden')
  if (error) throw error

  // Secuencial y no en paralelo: son seis consultas y el orden de las hojas en
  // el libro tiene que ser el de `orden`, que es el mismo de HOJAS_DE_DATOS.
  const hojas: HojaLista[] = []

  for (const { hoja } of definicion ?? []) {
    const { data: columnas, error: errorColumnas } = await supabase.rpc('formato_hoja', {
      p_hoja: hoja,
    })
    if (errorColumnas) throw errorColumnas

    const renglones = await traerTodo<{ renglon: Json }>((desde, hasta) =>
      supabase
        .rpc('inventario_formato', { p_almacen: almacenId, p_hoja: hoja })
        .range(desde, hasta),
    )

    hojas.push({
      nombre: hoja,
      // El tipo viene de la base. Mapearlo todo a texto haria que `cantidad` y
      // `peso_vacio` salieran como cadena, que es exactamente el defecto que el
      // ETL limpio al entrar.
      columnas: (columnas ?? []).map((c) => ({
        clave: c.campo,
        titulo: c.titulo,
        tipo: c.tipo as Columna['tipo'],
      })),
      // `inventario_formato` promete un objeto por renglon -lo arma con
      // jsonb_object_agg-, pero el tipo generado es `Json`, que abarca tambien
      // numeros y arreglos. Se estrecha aqui, y lo que no sea objeto se
      // descarta en vez de colarse como una fila rara en el Excel.
      filas: renglones.flatMap((r) =>
        typeof r.renglon === 'object' && r.renglon !== null && !Array.isArray(r.renglon)
          ? [r.renglon as Fila]
          : [],
      ),
    })
  }

  return hojas
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
