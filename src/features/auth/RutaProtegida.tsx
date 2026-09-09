import { Icon } from '@iconify/react'
import { Stack, Typography } from '@mui/material'
import { Navigate, Outlet } from 'react-router-dom'

import { useSesion } from './contexto'
import { usePerfil } from './usePerfil'

export function RutaProtegida() {
  const sesion = useSesion()

  // Mientras carga no se decide nada: redirigir aqui echaria al login a quien
  // ya tiene sesion, en cada recarga de pagina.
  if (sesion.estado === 'cargando') return null

  if (sesion.estado === 'sin-sesion') {
    return <Navigate to="/entrar" replace />
  }

  return <Outlet />
}

/** Protege las pantallas administrativas con el rol que ya vive en perfil. */
export function SoloAdministradores() {
  const sesion = useSesion()
  const perfil = usePerfil()

  if (sesion.estado === 'cargando' || perfil.isPending) {
    return null
  }

  if (
    sesion.estado === 'sin-sesion' ||
    perfil.error ||
    perfil.data?.rol !== 'admin'
  ) {
    return (
      <Navigate
        to={sesion.estado === 'sin-sesion' ? '/entrar' : '/'}
        replace
      />
    )
  }

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

  if (sesion.estado === 'con-sesion') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/**
 * Las pantallas de administración: el programa educativo, y las que vengan.
 *
 * Esto es comodidad, no seguridad. Quien edite el bundle llega a la ruta igual;
 * lo que de verdad protege los datos son las políticas de RLS, que le niegan la
 * escritura a cualquiera que no sea admin. La guardia existe para que un
 * responsable no se meta a una pantalla que le va a fallar en cada botón.
 */
export function SoloAdmin() {
  const {
    data: perfil,
    isPending,
    isError,
  } = usePerfil()

  // Con la base caída esta consulta no termina —supabase-js se queda esperando
  // el refresco del token— y devolver `null` dejaba la pantalla en blanco para
  // siempre, sin decir por qué. Es distinto de RutaProtegida: aquella tarda un
  // instante en leer la sesión de localStorage y no sale a la red.
  if (isPending) {
    return (
      <Aviso
        icono="mdi:lock-outline"
        texto="Comprobando tus permisos…"
      />
    )
  }

  if (isError) {
    return (
      <Aviso
        icono="mdi:cloud-off-outline"
        texto="No se pudo comprobar tu perfil. Revisa la conexión y vuelve a cargar la página."
      />
    )
  }

  if (perfil?.rol !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/**
 * Inventario es la pantalla de UNA bodega: la de quien entra. Quien no tiene
 * almacén asignado —admin y consulta, cuyo ámbito es la Unidad entera— no tiene
 * ahí nada que ver, y se le manda a Inventario general, que es su inventario.
 *
 * Como `SoloAdmin`, esto es comodidad y no seguridad: la RLS deja leer las
 * cuatro bodegas a cualquiera con sesión, y ésa es la decisión. Lo que la
 * guardia compra es que la pantalla no se monte nunca sin el dato del que
 * depende, y por eso `PaginaInventario` puede dar por hecho que hay almacén en
 * vez de reajustar sus filtros cuando el perfil aterriza.
 */
export function ConAlmacenPropio() {
  const { data: perfil, isPending, isError } = usePerfil()

  if (isPending) {
    return <Aviso icono="mdi:warehouse" texto="Comprobando tu almacén…" />
  }

  if (isError) {
    return (
      <Aviso
        icono="mdi:cloud-off-outline"
        texto="No se pudo comprobar tu perfil. Revisa la conexión y vuelve a cargar la página."
      />
    )
  }

  if (!perfil?.almacen) {
    return <Navigate to="/inventario-general" replace />
  }

  return <Outlet />
}

/** Lo que se ve en lugar de la pantalla mientras la guardia no puede decidir. */
function Aviso({
  icono,
  texto,
}: {
  icono: string
  texto: string
}) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        py: 10,
        px: 3,
      }}
    >
      <Icon icon={icono} width={32} />

      <Typography
        sx={{
          color: 'text.secondary',
          textAlign: 'center',
          maxWidth: 420,
        }}
      >
        {texto}
      </Typography>
    </Stack>
  )
}
