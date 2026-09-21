/**
 * `max_rows = 1000` en supabase/config.toml, y aplica tambien a las RPC. Un
 * reporte de reactivos de N3 son ~2,600 renglones: volveria con 1,000 SIN
 * AVISAR, en un Excel perfectamente formado con autofiltro y todo, al que le
 * faltan dos tercios del inventario.
 *
 * Es el mismo modo de fallo que la vista sin `security_invoker` que «funciona
 * igual de bien hasta el dia malo». De ahi la regla:
 *
 *   Un archivo truncado en silencio es peor que un error.
 */
const POR_PAGINA = 1000

/** Por encima de esto algo esta mal en los parametros, no en el inventario. */
export const TOPE = 50_000

export async function traerTodo<T>(
  pagina: (
    desde: number,
    hasta: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = []

  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await pagina(desde, desde + POR_PAGINA - 1)
    if (error) throw error

    const lote = data ?? []
    filas.push(...lote)

    // Una pagina incompleta es el final. Parar en `length === 0` costaria una
    // consulta de mas en cada reporte; parar antes de tiempo devolveria datos
    // incompletos, que es justo lo que esto existe para evitar.
    if (lote.length < POR_PAGINA) return filas

    if (filas.length >= TOPE) {
      throw new Error(
        `El reporte es demasiado grande: supera ${TOPE.toLocaleString('es-MX')} renglones. ` +
          'Acota el almacén o el periodo y vuelve a intentarlo.',
      )
    }
  }
}
