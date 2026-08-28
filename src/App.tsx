import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Layout } from '@/app/Layout'
import { PantallaAcceso } from '@/features/auth/PantallaAcceso'
import { ProveedorSesion } from '@/features/auth/ProveedorSesion'
import { RutaProtegida, SoloInvitados } from '@/features/auth/RutaProtegida'
import { PaginaDepuracion } from '@/features/inventario/PaginaDepuracion'
import { PaginaInicio } from '@/features/inventario/PaginaInicio'
import { PaginaInventario } from '@/features/inventario/PaginaInventario'
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

export default function App() {
  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <QueryClientProvider client={cliente}>
        <ProveedorSesion>
          <BrowserRouter>
            <Routes>
              <Route element={<SoloInvitados />}>
                <Route path="/entrar" element={<PantallaAcceso />} />
              </Route>

              <Route element={<RutaProtegida />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<PaginaInicio />} />
                  <Route path="/inventario" element={<PaginaInventario />} />
                  {/* Ruta propia y no pestaña dentro de /inventario: es otro
                      trabajo (revisar y corregir, no consultar), sale de otra
                      tabla, y sobre todo es enlazable —"ve a depurar tus 337"
                      es un enlace, no una instrucción de dónde hacer clic—.
                      Cuelga de /inventario para que la migaja diga de dónde
                      viene y para que la barra lateral siga marcando Inventario. */}
                  <Route path="/inventario/depuracion" element={<PaginaDepuracion />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ProveedorSesion>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
