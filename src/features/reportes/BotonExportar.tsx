import { Icon } from '@iconify/react'
import { Button, Snackbar, Tooltip } from '@mui/material'
import { useState } from 'react'

import { usePerfil } from '@/features/auth/usePerfil'
import { REPORTES } from './registro'

const INVENTARIO = REPORTES.find((r) => r.id === 'inventario')!

/**
 * El boton «Exportar» de las dos pantallas de inventario, pendiente desde el
 * spec del 9 de septiembre.
 *
 * Exporta el formato unificado: un libro por almacen con una hoja por
 * clasificacion, que es como los almacenes entregan de verdad.
 *
 * `almacenId` en null significa «todos los almacenes» en el filtro de
 * Inventario general. No hay archivo que sirva para eso -el formato unificado
 * es UN LIBRO POR ALMACEN, y uno solo no puede representar siete-, asi que el
 * boton se deshabilita y dice por que, en vez de exportar algo que el ETL no
 * podria releer.
 */
export function BotonExportar({
  almacenId,
  almacenClave,
}: {
  almacenId: number | null
  almacenClave: string | null
}) {
  const perfil = usePerfil()
  const [generando, setGenerando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  // Un usuario de consulta no exporta: `private.puede_reportar()` le responde
  // con excepcion. Ensenarle el boton seria ofrecerle un error.
  if (perfil.data?.rol !== 'admin' && perfil.data?.rol !== 'responsable') {
    return null
  }

  if (almacenId === null || almacenClave === null) {
    return (
      // Tooltip necesita un elemento que reciba eventos; un boton deshabilitado
      // no los emite, de ahi el span.
      <Tooltip title="Elige un almacén: el formato unificado es un libro por almacén">
        <span>
          <Button disabled variant="outlined" startIcon={<Icon icon="mdi:download-outline" width={18} />}>
            Exportar
          </Button>
        </span>
      </Tooltip>
    )
  }

  const exportar = async () => {
    setGenerando(true)
    setFallo(null)

    try {
      // `import()` y no un import estatico arriba: esa pieza arrastra exceljs,
      // 920 kB, y estas dos pantallas NO son diferidas. Estatico, la libreria
      // entraria en el bundle principal y la pagaria hasta quien nunca exporta.
      const { generarLibro } = await import('./generarReporte')

      await generarLibro({
        reporte: INVENTARIO,
        parametros: { p_almacen: almacenId },
        almacenClave,
        etiquetas: [
          { etiqueta: 'Almacén', valor: almacenClave },
          { etiqueta: 'Generado', valor: new Date().toLocaleString('es-MX') },
          { etiqueta: 'Por', valor: perfil.data?.nombre ?? '' },
        ],
      })
    } catch (e) {
      // Se muestra y no se descarga nada. Nunca un .xlsx a medias, y nunca uno
      // en blanco que parezca un inventario sano.
      setFallo(e instanceof Error ? e.message : 'No se pudo generar el archivo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        loading={generando}
        onClick={exportar}
        startIcon={<Icon icon="mdi:download-outline" width={18} />}
      >
        Exportar
      </Button>

      <Snackbar
        open={fallo !== null}
        autoHideDuration={8000}
        onClose={() => setFallo(null)}
        message={fallo}
      />
    </>
  )
}
