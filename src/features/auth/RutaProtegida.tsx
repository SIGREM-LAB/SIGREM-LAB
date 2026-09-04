import { Icon } from '@iconify/react'
import { Stack, Typography } from '@mui/material'
import { Navigate, Outlet } from 'react-router-dom'

import { usePerfil } from './usePerfil'
import { useSesion } from './contexto'

export function RutaProtegida() {
  const sesion = useSesion()

  // Mientras carga no se decide nada: redirigir aqui echaria al login a quien
  // ya tiene sesion, en cada recarga de pagina.
  if (sesion.estado === 'cargando') return null
  if (sesion.estado === 'sin-sesion') return <Navigate to="/entrar" replace />

  return <Outlet />
}

/** Protege las pantallas administrativas con el rol que ya vive en perfil. */
export function SoloAdmin() {
  const { data: perfil, isPending, isError } = usePerfil()

  // Con la base caída esta consulta no termina —supabase-js se queda esperando
  // el refresco del token— y devolver `null` dejaba la pantalla en blanco para
  // siempre, sin decir por qué.
  if (isPending) return <Aviso icono="mdi:lock-outline" texto="Comprobando tus permisos…" />

  if (isError) {
    return (
      <Aviso
        icono="mdi:cloud-off-outline"
        texto="No se pudo comprobar tu perfil. Revisa la conexión y vuelve a cargar la página."
      />
    )
  }

  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />

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

/** Lo que se ve en lugar de la pantalla mientras la guardia no puede decidir. */
function Aviso({ icono, texto }: { icono: string; texto: string }) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', py: 10, px: 3 }}>
      <Icon icon={icono} width={32} />
      <Typography sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 420 }}>
        {texto}
      </Typography>
    </Stack>
  )
}
