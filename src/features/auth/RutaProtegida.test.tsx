import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import { RutaProtegida, SoloAdmin, SoloInvitados } from './RutaProtegida'
import { ContextoSesion, type EstadoSesion } from './contexto'

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

/**
 * Se siembra la caché de Query en vez de simular la red: `usePerfil` lee de
 * ['perfil', usuarioId], así que poner el dato ahí es la forma honesta de decir
 * "el perfil ya llegó", y es el mismo criterio con el que estas pruebas inyectan
 * la sesión por su contexto.
 *
 * Para el caso "todavía cargando" se pasa la sesión en carga: `usePerfil` queda
 * con `enabled: false`, así que se queda en isPending sin salir a la red. Es
 * también lo que pasa de verdad al recargar la página.
 */
function montarAdmin(sesion: EstadoSesion, rol?: 'admin' | 'responsable' | 'consulta') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (rol !== undefined) {
    cliente.setQueryData(['perfil', 'u-1'], { id: 'u-1', nombre: 'Quien sea', rol })
  }

  return render(
    <QueryClientProvider client={cliente}>
      <ContextoSesion.Provider value={sesion}>
        <MemoryRouter initialEntries={['/administracion/academico']}>
          <Routes>
            <Route path="/" element={<p>Menu principal</p>} />
            <Route element={<SoloAdmin />}>
              <Route path="/administracion/academico" element={<p>Panel academico</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ContextoSesion.Provider>
    </QueryClientProvider>,
  )
}

describe('SoloAdmin', () => {
  test('el admin entra al panel académico', () => {
    montarAdmin({ estado: 'con-sesion', usuarioId: 'u-1' }, 'admin')

    expect(screen.getByText('Panel academico')).toBeInTheDocument()
  })

  // No es seguridad —quien edite el bundle llega igual, y lo que de verdad lo
  // detiene son las políticas de RLS—. Es para que un responsable no se meta a
  // una pantalla que le va a fallar en cada botón.
  test('un responsable rebota al menú principal', () => {
    montarAdmin({ estado: 'con-sesion', usuarioId: 'u-1' }, 'responsable')

    expect(screen.getByText('Menu principal')).toBeInTheDocument()
    expect(screen.queryByText('Panel academico')).not.toBeInTheDocument()
  })

  test('un usuario de consulta rebota al menú principal', () => {
    montarAdmin({ estado: 'con-sesion', usuarioId: 'u-1' }, 'consulta')

    expect(screen.getByText('Menu principal')).toBeInTheDocument()
    expect(screen.queryByText('Panel academico')).not.toBeInTheDocument()
  })

  // Mismo hueco que en RutaProtegida: si el guard decide mientras el perfil
  // todavía no se conoce, el admin acaba en la portada cada vez que recarga.
  test('mientras el perfil no se conoce no decide nada', () => {
    montarAdmin({ estado: 'cargando' })

    expect(screen.queryByText('Panel academico')).not.toBeInTheDocument()
    expect(screen.queryByText('Menu principal')).not.toBeInTheDocument()
  })
})
