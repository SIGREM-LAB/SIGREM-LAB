import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { RutaProtegida, SoloAdmin, SoloInvitados } from './RutaProtegida'
import { ContextoSesion, type EstadoSesion } from './contexto'

const { usePerfil } = vi.hoisted(() => ({
  usePerfil: vi.fn(),
}))

vi.mock('./usePerfil', () => ({
  usePerfil,
}))

function montar(sesion: EstadoSesion) {
  return render(
    <ContextoSesion.Provider value={sesion}>
      <MemoryRouter initialEntries={['/inventario']}>
        <Routes>
          <Route path="/entrar" element={<p>Pantalla de acceso</p>} />

          <Route element={<RutaProtegida />}>
            <Route
              path="/inventario"
              element={<p>Inventario del almacen</p>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </ContextoSesion.Provider>,
  )
}

describe('RutaProtegida', () => {
  // Supabase tarda un instante en indicar si existe una sesión guardada.
  // Mientras carga, no debe mostrar contenido ni mandar al login.
  test('mientras la sesion carga no muestra el contenido ni manda al login', () => {
    montar({ estado: 'cargando' })

    expect(
      screen.queryByText('Inventario del almacen'),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Pantalla de acceso'),
    ).not.toBeInTheDocument()
  })

  test('manda al login cuando no hay sesion', () => {
    montar({ estado: 'sin-sesion' })

    expect(
      screen.getByText('Pantalla de acceso'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Inventario del almacen'),
    ).not.toBeInTheDocument()
  })

  test('muestra el contenido cuando hay sesion', () => {
    montar({
      estado: 'con-sesion',
      usuarioId: 'u-1',
    })

    expect(
      screen.getByText('Inventario del almacen'),
    ).toBeInTheDocument()
  })
})

function montarAcceso(sesion: EstadoSesion) {
  return render(
    <ContextoSesion.Provider value={sesion}>
      <MemoryRouter initialEntries={['/entrar']}>
        <Routes>
          <Route
            path="/"
            element={<p>Inventario del almacen</p>}
          />

          <Route element={<SoloInvitados />}>
            <Route
              path="/entrar"
              element={<p>Pantalla de acceso</p>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </ContextoSesion.Provider>,
  )
}

describe('SoloInvitados', () => {
  test('saca de la pantalla de acceso a quien ya tiene sesion', () => {
    montarAcceso({
      estado: 'con-sesion',
      usuarioId: 'u-1',
    })

    expect(
      screen.getByText('Inventario del almacen'),
    ).toBeInTheDocument()
  })

  test('deja ver la pantalla de acceso a quien no tiene sesion', () => {
    montarAcceso({
      estado: 'sin-sesion',
    })

    expect(
      screen.getByText('Pantalla de acceso'),
    ).toBeInTheDocument()
  })
})

/*
 * ============================================================
 * ADMINISTRACIÓN DE USUARIOS
 * ============================================================
 */

function montarAdminUsuarios(
  sesion: EstadoSesion,
  rol: 'admin' | 'responsable' | 'consulta',
) {
  usePerfil.mockReturnValue({
    isPending: false,
    isError: false,
    error: null,
    data: { rol },
  })

  const cliente = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={cliente}>
      <ContextoSesion.Provider value={sesion}>
        <MemoryRouter initialEntries={['/usuarios']}>
          <Routes>
            <Route
              path="/"
              element={<p>Página principal</p>}
            />

            <Route
              path="/entrar"
              element={<p>Pantalla de acceso</p>}
            />

            <Route element={<SoloAdmin />}>
              <Route
                path="/usuarios"
                element={<p>Administración de usuarios</p>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </ContextoSesion.Provider>
    </QueryClientProvider>,
  )
}

describe('SoloAdmin - Administración de usuarios', () => {
  beforeEach(() => {
    usePerfil.mockReset()
  })

  test('permite el acceso al administrador', () => {
    montarAdminUsuarios(
      {
        estado: 'con-sesion',
        usuarioId: 'admin-1',
      },
      'admin',
    )

    expect(
      screen.getByText('Administración de usuarios'),
    ).toBeInTheDocument()
  })

  test('rechaza el acceso directo de un usuario normal', () => {
    montarAdminUsuarios(
      {
        estado: 'con-sesion',
        usuarioId: 'user-1',
      },
      'responsable',
    )

    expect(
      screen.getByText('Página principal'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Administración de usuarios'),
    ).not.toBeInTheDocument()
  })
})

/*
 * ============================================================
 * PANEL ACADÉMICO
 * ============================================================
 *
 * usePerfil se simula directamente para poder probar de forma
 * determinista los estados de carga y error.
 */

function montarAdminAcademico(estado: {
  data?: {
    rol: 'admin' | 'responsable' | 'consulta'
  }
  isPending?: boolean
  isError?: boolean
}) {
  usePerfil.mockReturnValue({
    data: estado.data,
    isPending: estado.isPending ?? false,
    isError: estado.isError ?? false,
    error: estado.isError
      ? new Error('No se pudo cargar el perfil')
      : null,
  })

  return render(
    <MemoryRouter initialEntries={['/administracion/academico']}>
      <Routes>
        <Route
          path="/"
          element={<p>Menu principal</p>}
        />

        <Route element={<SoloAdmin />}>
          <Route
            path="/administracion/academico"
            element={<p>Panel academico</p>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('SoloAdmin - Panel académico', () => {
  beforeEach(() => {
    usePerfil.mockReset()
  })

  test('el admin entra al panel académico', () => {
    montarAdminAcademico({
      data: {
        rol: 'admin',
      },
    })

    expect(
      screen.getByText('Panel academico'),
    ).toBeInTheDocument()
  })

  test('un responsable rebota al menú principal', () => {
    montarAdminAcademico({
      data: {
        rol: 'responsable',
      },
    })

    expect(
      screen.getByText('Menu principal'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Panel academico'),
    ).not.toBeInTheDocument()
  })

  test('un usuario de consulta rebota al menú principal', () => {
    montarAdminAcademico({
      data: {
        rol: 'consulta',
      },
    })

    expect(
      screen.getByText('Menu principal'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Panel academico'),
    ).not.toBeInTheDocument()
  })

  test('mientras el perfil no se conoce avisa, sin decidir', () => {
    montarAdminAcademico({
      isPending: true,
    })

    expect(
      screen.queryByText('Panel academico'),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Menu principal'),
    ).not.toBeInTheDocument()

    expect(
      screen.getByText('Comprobando tus permisos…'),
    ).toBeInTheDocument()
  })

  test('si el perfil no se puede leer, lo dice en vez de quedarse en blanco', () => {
    montarAdminAcademico({
      isError: true,
    })

    expect(
      screen.queryByText('Panel academico'),
    ).not.toBeInTheDocument()

    expect(
      screen.getByText(/No se pudo comprobar tu perfil/),
    ).toBeInTheDocument()
  })
})
