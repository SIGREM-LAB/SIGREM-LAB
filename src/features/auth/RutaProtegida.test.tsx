import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { RutaProtegida, SoloAdmin, SoloInvitados } from './RutaProtegida'
import { ContextoSesion, type EstadoSesion } from './contexto'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { usePerfil } = vi.hoisted(() => ({ usePerfil: vi.fn() }))
vi.mock('./usePerfil', () => ({ usePerfil }))

function montar(sesion: EstadoSesion) {
  return render(
    <ContextoSesion.Provider value={sesion}>
      <MemoryRouter initialEntries={['/inventario']}>
        <Routes>
          <Route path="/entrar" element={<p>Pantalla de acceso</p>} />
          <Route element={<RutaProtegida />}>
            <Route path="/inventario" element={<p>Inventario del almacen</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ContextoSesion.Provider>,
  )
}

describe('RutaProtegida', () => {
  // La importante. Supabase tarda un instante en decir si hay sesion guardada.
  // Si el guard decide en ese hueco, un usuario con sesion valida acaba en el
  // login cada vez que recarga la pagina.
  test('mientras la sesion carga no muestra el contenido ni manda al login', () => {
    montar({ estado: 'cargando' })

    expect(screen.queryByText('Inventario del almacen')).not.toBeInTheDocument()
    expect(screen.queryByText('Pantalla de acceso')).not.toBeInTheDocument()
  })

  test('manda al login cuando no hay sesion', () => {
    montar({ estado: 'sin-sesion' })

    expect(screen.getByText('Pantalla de acceso')).toBeInTheDocument()
    expect(screen.queryByText('Inventario del almacen')).not.toBeInTheDocument()
  })

  test('muestra el contenido cuando hay sesion', () => {
    montar({ estado: 'con-sesion', usuarioId: 'u-1' })

    expect(screen.getByText('Inventario del almacen')).toBeInTheDocument()
  })
})

function montarAcceso(sesion: EstadoSesion) {
  return render(
    <ContextoSesion.Provider value={sesion}>
      <MemoryRouter initialEntries={['/entrar']}>
        <Routes>
          <Route path="/" element={<p>Inventario del almacen</p>} />
          <Route element={<SoloInvitados />}>
            <Route path="/entrar" element={<p>Pantalla de acceso</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ContextoSesion.Provider>,
  )
}

describe('SoloInvitados', () => {
  // Sin esto, al entrar correctamente la pantalla de acceso se queda puesta:
  // la sesion cambia pero la ruta sigue siendo /entrar.
  test('saca de la pantalla de acceso a quien ya tiene sesion', () => {
    montarAcceso({ estado: 'con-sesion', usuarioId: 'u-1' })

    expect(screen.getByText('Inventario del almacen')).toBeInTheDocument()
  })

  test('deja ver la pantalla de acceso a quien no tiene sesion', () => {
    montarAcceso({ estado: 'sin-sesion' })

    expect(screen.getByText('Pantalla de acceso')).toBeInTheDocument()
  })
})

function montarAdmin(sesion: EstadoSesion, rol: 'admin' | 'responsable' | 'consulta') {
  usePerfil.mockReturnValue({ isPending: false, error: null, data: { rol } })
  const cliente = new QueryClient()

  return render(
    <QueryClientProvider client={cliente}>
      <ContextoSesion.Provider value={sesion}>
        <MemoryRouter initialEntries={['/usuarios']}>
          <Routes>
            <Route path="/" element={<p>Página principal</p>} />
            <Route path="/entrar" element={<p>Pantalla de acceso</p>} />
            <Route element={<SoloAdmin />}>
              <Route path="/usuarios" element={<p>Administración de usuarios</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ContextoSesion.Provider>
    </QueryClientProvider>,
  )
}

describe('SoloAdmin', () => {
  beforeEach(() => usePerfil.mockReset())

  test('permite el acceso al administrador', () => {
    montarAdmin({ estado: 'con-sesion', usuarioId: 'admin-1' }, 'admin')

    expect(screen.getByText('Administración de usuarios')).toBeInTheDocument()
  })

  test('rechaza el acceso directo de un usuario normal', () => {
    montarAdmin({ estado: 'con-sesion', usuarioId: 'user-1' }, 'responsable')

    expect(screen.getByText('Página principal')).toBeInTheDocument()
    expect(screen.queryByText('Administración de usuarios')).not.toBeInTheDocument()
  })

  /**
   * `usePerfil` se simula en su frontera y no se siembra la caché de Query. Es la
   * única forma determinista de provocar el estado de error: sembrar la caché
   * puede fingir "ya llegó", pero no "falló", y ese es justo el caso que dejaba la
   * pantalla en blanco cuando la base no responde.
   */
  test('mientras el perfil no se conoce avisa, sin decidir', () => {
    usePerfil.mockReturnValue({ isPending: true, error: null, data: undefined })

    render(
      <MemoryRouter initialEntries={['/administracion/academico']}>
        <Routes>
          <Route path="/" element={<p>Menu principal</p>} />
          <Route element={<SoloAdmin />}>
            <Route path="/administracion/academico" element={<p>Panel academico</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Panel academico')).not.toBeInTheDocument()
    expect(screen.queryByText('Menu principal')).not.toBeInTheDocument()
    expect(screen.getByText('Comprobando tus permisos…')).toBeInTheDocument()
  })

  test('si el perfil no se puede leer, lo dice en vez de quedarse en blanco', () => {
    usePerfil.mockReturnValue({ isPending: false, error: new Error('Network error'), data: undefined })

    render(
      <MemoryRouter initialEntries={['/administracion/academico']}>
        <Routes>
          <Route path="/" element={<p>Menu principal</p>} />
          <Route element={<SoloAdmin />}>
            <Route path="/administracion/academico" element={<p>Panel academico</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Panel academico')).not.toBeInTheDocument()
    expect(
      screen.getByText(/No se pudo comprobar tu perfil/),
    ).toBeInTheDocument()
  })
})
