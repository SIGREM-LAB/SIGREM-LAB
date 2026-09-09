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
 * La ven los tres roles, y no es una concesión: la RLS abre la lectura de las
 * cuatro bodegas a propósito, para que N4 pueda consultar el stock de N3 antes
 * de ir a pedirlo prestado. Ésta es la pantalla de ese caso de uso. Para quien
 * no tiene almacén propio —admin y consulta— es además su único inventario.
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
        <ListadoExistencias
          almacenFijo={null}
          almacenPropio={perfil?.almacen?.id ?? null}
          almacenSemilla={almacenPedido}
        />
      </CuerpoPagina>
    </>
  )
}
