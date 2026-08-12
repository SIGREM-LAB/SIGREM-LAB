import { Navigate, Outlet } from 'react-router-dom'

import { useSesion } from './contexto'

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
