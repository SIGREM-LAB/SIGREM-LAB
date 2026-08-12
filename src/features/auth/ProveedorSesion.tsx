import { useEffect, useState, type ReactNode } from 'react'

import { supabase } from '@/lib/supabase'
import { ContextoSesion, type EstadoSesion } from './contexto'

/**
 * La parte de supabase.auth que usa la app. Declararla permite inyectar un
 * doble en las pruebas sin sustituir el modulo entero.
 */
export type ClienteAuth = {
  getSession(): Promise<{ data: { session: { user: { id: string } } | null } }>
  onAuthStateChange(
    cb: (evento: string, sesion: { user: { id: string } } | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } }
}

function aEstado(sesion: { user: { id: string } } | null): EstadoSesion {
  return sesion ? { estado: 'con-sesion', usuarioId: sesion.user.id } : { estado: 'sin-sesion' }
}

export function ProveedorSesion({
  auth = supabase.auth as unknown as ClienteAuth,
  children,
}: {
  auth?: ClienteAuth
  children: ReactNode
}) {
  const [sesion, setSesion] = useState<EstadoSesion>({ estado: 'cargando' })

  useEffect(() => {
    let vivo = true

    void auth.getSession().then(({ data }) => {
      // Si el componente se desmonto mientras Supabase contestaba, actualizar
      // el estado aqui provoca una advertencia y una fuga.
      if (vivo) setSesion(aEstado(data.session))
    })

    const { data } = auth.onAuthStateChange((_evento, s) => {
      if (vivo) setSesion(aEstado(s))
    })

    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [auth])

  return <ContextoSesion.Provider value={sesion}>{children}</ContextoSesion.Provider>
}
