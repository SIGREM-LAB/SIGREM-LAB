import { Icon } from '@iconify/react'
import { Button } from '@mui/material'
import { Link as EnlaceRuta } from 'react-router-dom'

import { AccionPendiente } from '@/app/AccionPendiente'
import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { ListadoExistencias } from './ListadoExistencias'
import { ResumenEstados } from './ResumenEstados'
import { useResumenEstados, useResumenPendientes } from './consultas'

type Almacen = { id: number; clave: string; nombre: string }

/**
 * El inventario de tu bodega.
 *
 * Anclada al almacén del perfil: sin columna de almacén, sin su selector y sin
 * la opción de ver los cuatro. Para eso está Inventario general, que es otra
 * pantalla porque contesta otra pregunta —ésta dice qué tienes; aquélla, dónde
 * está—.
 */
export function PaginaInventario() {
  const { data: perfil } = usePerfil()
  const almacen = perfil?.almacen ?? null

  // La guardia `ConAlmacenPropio` no monta esta pantalla sin almacén, y para
  // cuando llega aquí el perfil ya está en la caché de Query, así que este
  // camino no se recorre. Existe para que el tipo diga la verdad y para que el
  // día que alguien registre la ruta sin su guardia, la pantalla no reviente.
  if (almacen === null) return null

  return <Inventario almacen={almacen} />
}

/**
 * Separado para poder pedir las cifras con el almacén ya resuelto: los hooks no
 * se pueden llamar después de un `return` temprano, y `useResumenEstados` exige
 * una bodega concreta.
 */
function Inventario({ almacen }: { almacen: Almacen }) {
  const resumen = useResumenEstados(almacen.id)

  // Lo que falta por cargar de esta bodega. Es el único aviso de que este
  // inventario no está completo: sin él, las existencias cargadas parecen el
  // inventario entero y los renglones apartados no existen para nadie.
  const porDepurar = useResumenPendientes(almacen.id)

  return (
    <>
      <EncabezadoPagina
        padre={{ etiqueta: 'Menú principal', ruta: '/' }}
        titulo="Inventario"
        descripcion={`${almacen.clave} · ${almacen.nombre}`}
        acciones={
          <>
            {porDepurar.data === undefined || porDepurar.data.pendiente === 0 ? null : (
              <Button
                component={EnlaceRuta}
                to="/inventario/depuracion"
                variant="outlined"
                color="warning"
                startIcon={<Icon icon="mdi:clipboard-alert-outline" width={20} />}
              >
                Depurar {porDepurar.data.pendiente}
              </Button>
            )}
            <AccionPendiente etiqueta="Exportar" icono="mdi:download-outline" variante="outlined" />
            <AccionPendiente etiqueta="Nueva existencia" icono="mdi:plus" variante="contained" />
          </>
        }
      >
        <ResumenEstados resumen={resumen.data} />
      </EncabezadoPagina>

      <CuerpoPagina>
        <ListadoExistencias almacenFijo={almacen.id} almacenPropio={almacen.id} />
      </CuerpoPagina>
    </>
  )
}
