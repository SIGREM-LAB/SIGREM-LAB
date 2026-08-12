import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import { RutaProtegida, SoloInvitados } from './RutaProtegida'
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
