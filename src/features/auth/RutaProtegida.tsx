import { Navigate, Outlet } from 'react-router-dom'

import { useSesion } from './contexto'
import { usePerfil } from './usePerfil'

export function RutaProtegida() {
  const sesion = useSesion()

  // Mientras carga no se decide nada: redirigir aqui echaria al login a quien
  // ya tiene sesion, en cada recarga de pagina.
  if (sesion.estado === 'cargando') return null
  if (sesion.estado === 'sin-sesion') return <Navigate to="/entrar" replace />

  return <Outlet />
}

/**
 * El inverso: protege la pantalla de acceso. Sin esto, al entrar
 * correctamente el formulario se queda puesto, porque la sesion cambia pero
 * la ruta sigue siendo /entrar.
 */
export function SoloInvitados() {
  const sesion = useSesion()

  if (sesion.estado === 'cargando') return null
  if (sesion.estado === 'con-sesion') return <Navigate to="/" replace />

  return <Outlet />
}

/**
 * Las pantallas de administración: el plan académico, y las que vengan.
 *
 * Esto es comodidad, no seguridad. Quien edite el bundle llega a la ruta igual;
 * lo que de verdad protege los datos son las políticas de RLS, que le niegan la
 * escritura a cualquiera que no sea admin. La guardia existe para que un
 * responsable no se meta a una pantalla que le va a fallar en cada botón.
 */
export function SoloAdmin() {
  const { data: perfil, isPending } = usePerfil()

  // Mismo motivo que en RutaProtegida: mientras el perfil no se conoce no se
  // decide nada. Redirigir aquí echaría al admin a la portada en cada F5.
  if (isPending) return null
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}
