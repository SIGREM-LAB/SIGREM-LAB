import { ASPECTO_METODO } from './metodos'
import type { Cabecera, ElementoCaptura } from './esquemas'

/**
 * Sube cada vez que cambia la forma de `ContenidoBorrador`. Un borrador guardado
 * con otra versión se descarta entero, con aviso.
 *
 * Ése es el precio de guardar la captura como `jsonb` opaco, y es el precio
 * correcto: la alternativa era aflojar `practica_elemento_campos_por_metodo` y
 * condicionar los dos triggers de descuento para poder guardar productos a
 * medias en su tabla real. Perder un borrador es una molestia; un
 * `practica_elemento` incompleto que se cuela a Reportes es un dato malo.
 */
export const VERSION_BORRADOR = 1

/** La cabecera a medias: para eso es un borrador. */
export type CabeceraParcial = Partial<Cabecera>

export type ContenidoBorrador = {
  version: number
  cabecera: CabeceraParcial
  elementos: ElementoCaptura[]
}

export function serializarBorrador(
  cabecera: CabeceraParcial,
  elementos: ElementoCaptura[],
): ContenidoBorrador {
  return { version: VERSION_BORRADOR, cabecera, elementos }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Lo mínimo que un elemento tiene que traer para poder registrarse. No se
 * revalida la captura —un producto a medias es legítimo en un borrador— sólo la
 * identidad y el método, que son de lo que dependen la tabla y el panel.
 */
function elementoUtilizable(valor: unknown): valor is ElementoCaptura {
  if (!esObjeto(valor)) return false
  if (typeof valor.existenciaId !== 'number') return false
  if (typeof valor.metodo !== 'string') return false
  if (!(valor.metodo in ASPECTO_METODO)) return false
  return true
}

/**
 * Devuelve la captura guardada, o `null` si no se puede confiar en ella.
 *
 * `null` en vez de una restauración parcial, y a propósito: media captura
 * restaurada es peor que ninguna, porque quien la ve no sabe qué le falta y la
 * finaliza creyendo que está completa.
 */
export function restaurarBorrador(
  crudo: unknown,
): { cabecera: CabeceraParcial; elementos: ElementoCaptura[] } | null {
  if (!esObjeto(crudo)) return null
  if (crudo.version !== VERSION_BORRADOR) return null
  if (!esObjeto(crudo.cabecera)) return null
  if (!Array.isArray(crudo.elementos)) return null
  if (!crudo.elementos.every(elementoUtilizable)) return null

  return {
    cabecera: crudo.cabecera as CabeceraParcial,
    elementos: crudo.elementos,
  }
}
