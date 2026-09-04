/**
 * La forma normalizada del resumen por almacén.
 *
 * La vista `almacen_resumen` expone todas sus columnas anulables —a través de
 * una vista Postgres no promete la no-nulidad— y ninguna lo es en la práctica.
 * Se normaliza en `useResumenAlmacenes`, en un solo sitio, y de ahí para
 * adentro estos números existen siempre.
 */
export type ResumenAlmacen = {
  id: number
  clave: string
  nombre: string
  total: number
  disponible: number
  stockBajo: number
  agotado: number
  contaminado: number
  mantenimiento: number
}

/** El bloque grande del menú: un almacén concreto o la suma de los cuatro. */
export type Portada = {
  /** `null` cuando es la suma: no hay una clave que enseñar. */
  clave: string | null
  nombre: string
  /** Si es el almacén de quien mira, que es el único que puede editar. */
  propio: boolean
  total: number
  disponible: number
  stockBajo: number
  agotado: number
  contaminado: number
  mantenimiento: number
}

/**
 * Lo que pide una decisión: reponer, dar de alta de nuevo o mandar a servicio.
 *
 * `contaminado` NO entra aunque suene grave: es un estado estable —el frasco
 * está ahí y se sabe que no sirve—, no una tarea pendiente. Si entrara, el
 * aviso nunca bajaría a cero y dejaría de mirarse.
 */
export function necesitanAtencion(resumen: {
  stockBajo: number
  agotado: number
  mantenimiento: number
}): number {
  return resumen.stockBajo + resumen.agotado + resumen.mantenimiento
}

function sumar(resumenes: ResumenAlmacen[]): Portada | null {
  if (resumenes.length === 0) return null

  return resumenes.reduce<Portada>(
    (suma, r) => ({
      ...suma,
      total: suma.total + r.total,
      disponible: suma.disponible + r.disponible,
      stockBajo: suma.stockBajo + r.stockBajo,
      agotado: suma.agotado + r.agotado,
      contaminado: suma.contaminado + r.contaminado,
      mantenimiento: suma.mantenimiento + r.mantenimiento,
    }),
    {
      clave: null,
      nombre: 'Unidad Central de Laboratorios',
      propio: false,
      total: 0,
      disponible: 0,
      stockBajo: 0,
      agotado: 0,
      contaminado: 0,
      mantenimiento: 0,
    },
  )
}

/**
 * Parte los almacenes en el bloque grande y la lista de al lado.
 *
 * Un responsable ve el suyo arriba, con sus acciones, y los otros tres como
 * lista de consulta: es la forma del permiso, no una preferencia de diseño.
 *
 * Admin y consulta no tienen almacén propio. En vez de una pantalla distinta,
 * el bloque grande pasa a ser la suma de la Unidad y la lista los muestra los
 * cuatro: mismas piezas, mismos números, sin un segundo camino que mantener.
 */
export function repartirAlmacenes(
  resumenes: ResumenAlmacen[],
  almacenPropioId: number | null,
): { portada: Portada | null; otros: ResumenAlmacen[] } {
  const propio =
    almacenPropioId === null ? undefined : resumenes.find((r) => r.id === almacenPropioId)

  if (propio === undefined) {
    return { portada: sumar(resumenes), otros: resumenes }
  }

  return {
    portada: { ...propio, propio: true },
    otros: resumenes.filter((r) => r.id !== propio.id),
  }
}

/**
 * El almacén que el menú le pasa al inventario al navegar.
 *
 * Viaja en el `state` de la ruta y no en la URL a propósito: es una semilla que
 * se lee una vez, y un `?almacen=2` en la barra seguiría diciendo 2 después de
 * que la persona cambiara el filtro a otra cosa.
 *
 * Llega como `unknown` —lo pone quien navega, y a `history.state` le puede
 * quedar cualquier cosa de una sesión anterior—, así que se valida aquí.
 */
export function almacenDesdeNavegacion(state: unknown): number | null {
  if (typeof state !== 'object' || state === null) return null

  const valor = (state as { almacenId?: unknown }).almacenId
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : null
}
