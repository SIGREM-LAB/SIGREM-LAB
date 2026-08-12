import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import { RutaProtegida } from './RutaProtegida'
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
