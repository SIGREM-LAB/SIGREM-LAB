import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, test, vi } from 'vitest'

import type { Usuario } from './administracion'
import { DialogoEditarUsuario } from './DialogoEditarUsuario'

vi.mock('./consultas', () => ({
  useAlmacenesActivos: () => ({
    data: [{ id: 3, clave: 'N3', nombre: 'Química', activo: true }],
    error: null,
    isPending: false,
  }),
}))

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    correo: 'ana@uaeh.edu.mx',
    estado: 'activo',
    nombre: 'Ana Pérez',
    rol: 'admin',
    almacen_id: null,
    almacen: null,
    creado_en: '2026-08-18T00:00:00Z',
    ...cambios,
  }
}

function pintar(props: Partial<Parameters<typeof DialogoEditarUsuario>[0]> = {}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onGuardar = vi.fn()

  return {
    onGuardar,
    ...render(
      <QueryClientProvider client={cliente}>
        <DialogoEditarUsuario
          usuario={usuario()}
          esMiCuenta={false}
          guardando={false}
          error={null}
          onCerrar={vi.fn()}
          onGuardar={onGuardar}
          onContrasena={vi.fn()}
          {...props}
        />
      </QueryClientProvider>,
    ),
  }
}

describe('DialogoEditarUsuario', () => {
  /**
   * La mitad de arriba del candado del último admin. La otra mitad es el
   * trigger de la base, que es el que de verdad manda.
   */
  test('sobre la cuenta propia el rol queda bloqueado y dice por qué', () => {
    pintar({ esMiCuenta: true })

    expect(screen.getByLabelText('Rol')).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByText('Es tu cuenta: tu propio rol lo cambia otro administrador'),
    ).toBeInTheDocument()
  })

  test('sobre la cuenta de otro el rol se edita con normalidad', () => {
    pintar()

    expect(screen.getByLabelText('Rol')).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('el nombre se edita aunque sea la cuenta propia', () => {
    pintar({ esMiCuenta: true })

    expect(screen.getByLabelText('Nombre completo')).toBeEnabled()
  })

  /**
   * Tener almacén y ser responsable son lo mismo desde
   * `perfil_almacen_solo_responsable`. Ofrecerle el campo a un admin sería
   * ofrecerle un error de la base.
   */
  test('el almacén no se ofrece cuando el rol no es responsable', () => {
    pintar()

    expect(screen.queryByLabelText('Laboratorio / Área asignada')).not.toBeInTheDocument()
    expect(screen.getByText(/El almacén es exclusivo de los responsables/)).toBeInTheDocument()
  })

  test('a un responsable sí se le pide el almacén', () => {
    pintar({ usuario: usuario({ rol: 'responsable', almacen_id: 3 }) })

    expect(screen.getByLabelText('Laboratorio / Área asignada')).toBeInTheDocument()
  })

  test('un fallo al guardar se ve, en vez de dejar el diálogo mudo', () => {
    pintar({ error: 'Eres el último administrador. Nombra a otro antes de quitarte el rol.' })

    expect(screen.getByText(/Eres el último administrador/)).toBeInTheDocument()
  })
})
