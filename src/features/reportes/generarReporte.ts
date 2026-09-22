import { useMutation } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import { aExcel, descargar, type Columna, type HojaLista } from './aExcel'
import { traerTodo } from './paginacion'
import { nombreDeArchivo, type Reporte } from './registro'

type Fila = Record<string, unknown>

export type Peticion = {
  reporte: Reporte
  parametros: Record<string, unknown>
  almacenClave: string
  etiquetas: { etiqueta: string; valor: string }[]
}

/**
 * Genera y descarga.
 *
 * Funcion suelta y no solo un hook, a proposito: las dos pantallas de
 * inventario NO son diferidas, asi que un `import` estatico desde su boton de
 * Exportar volveria a meter exceljs -920 kB- en el bundle principal y tiraria
 * por tierra la carga diferida de /reportes. Siendo una funcion, el boton la
 * pide con `import()` en el momento de pulsar.
 */
export async function generarLibro(v: Peticion) {
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
}

/** El mismo trabajo, envuelto para las pantallas que ya cargan el modulo. */
export function useGenerarReporte() {
  return useMutation({ mutationFn: generarLibro })
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
