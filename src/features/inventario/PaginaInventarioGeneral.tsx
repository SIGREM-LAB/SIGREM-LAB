import { useLocation } from 'react-router-dom'

import { AccionPendiente } from '@/app/AccionPendiente'
import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { ListadoExistencias } from './ListadoExistencias'
import { almacenDesdeNavegacion } from './menu'

/**
 * El inventario de toda la Unidad: los cuatro almacenes a la vez, con la columna
 * que dice de cuál es cada renglón.
 *
 * La ven admin y consulta, cuyo ámbito es la Unidad. El responsable no: su
 * inventario es el de su bodega, y la guardia `SinAlmacenPropio` lo manda ahí.
 *
 * No lleva franja de cifras bajo el título: el desglose por estado de la Unidad
 * ya lo pinta el menú principal, y la tira de almacenes de aquí abajo contesta la
 * pregunta propia de esta pantalla, que es cómo está repartido.
 */
export function PaginaInventarioGeneral() {
  const { data: perfil } = usePerfil()

  // El almacén que manda el menú principal al pulsar uno de sus renglones.
  // Llega como `unknown` y se valida en `almacenDesdeNavegacion`.
  const almacenPedido = almacenDesdeNavegacion(useLocation().state)

  return (
    <>
      <EncabezadoPagina
        padre={{ etiqueta: 'Menú principal', ruta: '/' }}
        titulo="Inventario general"
        descripcion="Las existencias de los cuatro almacenes de la Unidad"
        acciones={
          <AccionPendiente etiqueta="Exportar" icono="mdi:download-outline" variante="outlined" />
        }
      />

      <CuerpoPagina>
        {/* Registrar movimientos es de quien escribe. Un usuario de consulta ve
            estas mismas cuatro bodegas y no tiene ninguna propia, así que sin
            esta condición le saldría un botón que la RLS va a rechazar. Sobre
            qué renglones se ofrece —los del almacén propio, o todos si eres
            admin— lo decide el panel con `almacenPropio`. */}
        <ListadoExistencias
          almacenFijo={null}
          almacenPropio={perfil?.almacen?.id ?? null}
          almacenSemilla={almacenPedido}
          permiteMovimiento={perfil !== undefined && perfil.rol !== 'consulta'}
        />
      </CuerpoPagina>
    </>
  )
}
