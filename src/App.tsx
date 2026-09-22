import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Layout } from '@/app/Layout'
import { PaginaAcademico } from '@/features/academico/PaginaAcademico'
import { PantallaAcceso } from '@/features/auth/PantallaAcceso'
import { PantallaNuevaContrasena } from '@/features/auth/PantallaNuevaContrasena'
import { PantallaRecuperarContrasena } from '@/features/auth/PantallaRecuperarContrasena'
import { capturarEnlaceFallido } from '@/features/auth/enlaceDeCorreo'
import { ProveedorSesion } from '@/features/auth/ProveedorSesion'
import { PaginaInicio } from '@/features/inventario/PaginaInicio'
import { PaginaInventarioGeneral } from '@/features/inventario/PaginaInventarioGeneral'
import { PaginaUsuarios } from '@/features/usuarios/PaginaUsuarios'
import {
  ConAlmacenPropio,
  RutaProtegida,
  SinAlmacenPropio,
  SoloAdmin,
  SoloInvitados,
  SoloOperacion,
} from '@/features/auth/RutaProtegida'

// Diferidas a proposito: son las unicas pantallas que arrastran exceljs, que es
// la dependencia mas pesada del proyecto. Quien no entra al modulo no la paga.
const PaginaReportes = lazy(() =>
  import('@/features/reportes/PaginaReportes').then((m) => ({ default: m.PaginaReportes })),
)
const PaginaMinimos = lazy(() =>
  import('@/features/reportes/PaginaMinimos').then((m) => ({ default: m.PaginaMinimos })),
)
import { PaginaDepuracion } from '@/features/inventario/PaginaDepuracion'
import { PaginaInventario } from '@/features/inventario/PaginaInventario'
import { ProveedorBalanza } from '@/features/balanza/ProveedorBalanza'
import { PaginaNuevaPractica } from '@/features/practicas/PaginaNuevaPractica'
import { PaginaPracticas } from '@/features/practicas/PaginaPracticas'
import { tema } from '@/tema'

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      // Los inventarios no cambian cada segundo; refrescar al volver a la
      // pestana solo genera parpadeo.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

// A la carga del módulo y no dentro de un componente: es el único momento
// garantizado antes de que react-router reescriba la URL y se lleve por delante
// el motivo por el que falló el enlace del correo.
capturarEnlaceFallido()

export default function App() {
  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <QueryClientProvider client={cliente}>
        {/* La balanza va arriba del enrutador: la conexion sobrevive a cambiar
            de producto y de pantalla, y solo se abre cuando alguien la pide. */}
        <ProveedorBalanza>
          <ProveedorSesion>
            <BrowserRouter>
              <Routes>
                <Route element={<SoloInvitados />}>
                  <Route path="/entrar" element={<PantallaAcceso />} />
                </Route>
                <Route path="/solicitar-recuperacion" element={<PantallaRecuperarContrasena />} />
                <Route path="/recuperar-contrasena" element={<PantallaNuevaContrasena />} />

                <Route element={<RutaProtegida />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<PaginaInicio />} />

                    {/* Inventario es la bodega de quien entra, así que exige
                        tenerla. Sin almacén propio la guardia manda a
                        /inventario-general, que para admin y consulta ES su
                        inventario. */}
                    <Route element={<ConAlmacenPropio />}>
                      <Route path="/inventario" element={<PaginaInventario />} />
                    </Route>

                    {/* Inventario general es la Unidad. El responsable no entra:
                        su ámbito es el suyo, y la guardia lo manda a /inventario.
                        Admin y consulta no tienen bodega, así que ésta ES su
                        inventario. La RLS es la que de verdad oculta lo ajeno. */}
                    <Route element={<SinAlmacenPropio />}>
                      <Route path="/inventario-general" element={<PaginaInventarioGeneral />} />
                    </Route>
                    {/* Ruta propia y no pestaña dentro de /inventario: es otro
                        trabajo (revisar y corregir, no consultar), sale de otra
                        tabla, y sobre todo es enlazable —"ve a depurar tus 337"
                        es un enlace, no una instrucción de dónde hacer clic—.
                        Cuelga de /inventario para que la migaja diga de dónde
                        viene y para que la barra lateral siga marcando Inventario. */}
                    <Route path="/inventario/depuracion" element={<PaginaDepuracion />} />

                    {/* Sin guardia de rol: los tres roles la abren. Lo que impide
                        que un usuario de consulta registre algo es la RLS, no
                        esconderle la pantalla. */}
                    <Route path="/practicas" element={<PaginaPracticas />} />
                    <Route path="/practicas/nueva" element={<PaginaNuevaPractica />} />
                    {/* El id del borrador en la ruta es lo que hace recargable
                        una captura a medias y direccionable cada una de las
                        varias que puede tener una persona. */}
                    <Route path="/practicas/nueva/:borradorId" element={<PaginaNuevaPractica />} />

                    {/* Con guardia de rol, al reves que /practicas: alli los tres
                        roles entran y la RLS impide escribir, asi que la pantalla
                        sigue sirviendo en modo lectura. Aqui un usuario de
                        consulta no tiene nada que hacer, porque todas las
                        funciones le responden con excepcion. */}
                    <Route element={<SoloOperacion />}>
                      <Route
                        path="/reportes"
                        element={
                          <Suspense fallback={null}>
                            <PaginaReportes />
                          </Suspense>
                        }
                      />

                      {/* Cuelga de /reportes y no de /inventario porque se
                          llega desde «quiero saber que comprar»: el minimo es
                          el dato que le falta a ese reporte, no una propiedad
                          que a nadie le apetezca capturar por si misma. */}
                      <Route
                        path="/reportes/minimos"
                        element={
                          <Suspense fallback={null}>
                            <PaginaMinimos />
                          </Suspense>
                        }
                      />
                    </Route>

                    {/* Bajo /administracion y no en la raíz: es el primero de
                        cinco bloques de catálogo que sólo toca el admin, y el
                        prefijo es lo que evita que cada uno se invente su sitio.
                        SoloAdmin va aquí y no dentro de la pantalla para que la
                        redirección ocurra antes de montar nada. */}
                    <Route element={<SoloAdmin />}>
                      <Route path="/administracion/educativo" element={<PaginaAcademico />} />
                    </Route>
                  </Route>
                </Route>

                <Route element={<RutaProtegida />}>
                  <Route element={<SoloAdmin />}>
                    <Route element={<Layout />}>
                      <Route path="/usuarios" element={<PaginaUsuarios />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </ProveedorSesion>
        </ProveedorBalanza>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
