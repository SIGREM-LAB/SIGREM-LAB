import { Grid } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { tarjetasDeAdministracion } from '@/app/navegacion'
import { usePerfil } from '@/features/auth/usePerfil'
import { TarjetaSeccion } from './TarjetaSeccion'

/**
 * El índice de Administración.
 *
 * Una pantalla y no seis entradas en la barra lateral: con los catálogos que
 * faltan —ubicaciones, curación del catálogo, el formulario de alta— el menú
 * llegaría a nueve entradas y dejaría de servir para navegar. Aquí crecen sin
 * volver a tocarlo.
 *
 * Qué tarjetas salen lo decide `tarjetasDeAdministracion`, la misma lista que
 * conoce el menú. Esconder una es comodidad, no seguridad: lo que de verdad
 * impide escribir es la RLS de cada tabla.
 */
export function PaginaAdministracion() {
  const { data: perfil } = usePerfil()
  const tarjetas = tarjetasDeAdministracion(perfil?.rol)

  return (
    <>
      <EncabezadoPagina
        titulo="Administración"
        descripcion="Almacenes, laboratorios y catálogos del sistema"
      />

      <CuerpoPagina>
        <Grid container spacing={2}>
          {tarjetas.map((item) => (
            <Grid key={item.ruta} size={{ xs: 12, sm: 6, md: 4 }}>
              <TarjetaSeccion item={item} />
            </Grid>
          ))}
        </Grid>
      </CuerpoPagina>
    </>
  )
}
