import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ProveedorSesion, type ClienteAuth } from './ProveedorSesion'
import { useSesion } from './contexto'

function Mirilla() {
  const sesion = useSesion()
  return <p>{sesion.estado === 'con-sesion' ? `sesion:${sesion.usuarioId}` : sesion.estado}</p>
}

/**
 * Doble del cliente de Supabase con la misma forma que usa la app. No se
 * afirma sobre el doble: se afirma sobre lo que el proveedor renderiza.
 */
function crearAuth(sesionInicial: { user: { id: string } } | null) {
  let resolver: (() => void) | undefined
  const listo = new Promise<void>((r) => { resolver = r })
  let desuscrito = false

  const auth: ClienteAuth = {
    async getSession() {
      return { data: { session: sesionInicial } }
    },
    onAuthStateChange() {
      return {
        data: { subscription: { unsubscribe: () => { desuscrito = true } } },
      }
    },
  }

  return { auth, listo, resolver: () => resolver?.(), estaDesuscrito: () => desuscrito }
}

describe('ProveedorSesion', () => {
  test('arranca en cargando antes de que Supabase conteste', () => {
    const { auth } = crearAuth(null)

    render(<ProveedorSesion auth={auth}><Mirilla /></ProveedorSesion>)

    expect(screen.getByText('cargando')).toBeInTheDocument()
  })

  test('publica la sesion cuando Supabase reporta una guardada', async () => {
    const { auth } = crearAuth({ user: { id: 'u-42' } })

    render(<ProveedorSesion auth={auth}><Mirilla /></ProveedorSesion>)

    expect(await screen.findByText('sesion:u-42')).toBeInTheDocument()
  })

  test('publica sin-sesion cuando no hay ninguna guardada', async () => {
    const { auth } = crearAuth(null)

    render(<ProveedorSesion auth={auth}><Mirilla /></ProveedorSesion>)

    expect(await screen.findByText('sin-sesion')).toBeInTheDocument()
  })

  // Sin esto, cada montaje deja un listener vivo: en desarrollo con StrictMode
  // se acumulan y la sesion empieza a actualizarse varias veces por evento.
  test('se desuscribe del listener al desmontar', async () => {
    const { auth, estaDesuscrito } = crearAuth(null)

    const { unmount } = render(<ProveedorSesion auth={auth}><Mirilla /></ProveedorSesion>)
    await screen.findByText('sin-sesion')
    unmount()

    expect(estaDesuscrito()).toBe(true)
  })
})
