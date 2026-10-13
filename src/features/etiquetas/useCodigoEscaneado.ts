import { useLocation, useSearchParams } from 'react-router-dom'

import { esCodigo, normalizarCodigo } from './codigo'

/**
 * El código que llegó en la dirección (`?codigo=`), ya validado, y una llave
 * que cambia en cada navegación. Las pantallas de inventario usan la llave como
 * `key` del listado: escanear dos veces el mismo código lo vuelve a abrir.
 */
export function useCodigoEscaneado(): { codigo: string; llave: string } {
  const [parametros] = useSearchParams()
  const { key } = useLocation()
  const crudo = parametros.get('codigo') ?? ''
  return { codigo: esCodigo(crudo) ? normalizarCodigo(crudo) : '', llave: key }
}
