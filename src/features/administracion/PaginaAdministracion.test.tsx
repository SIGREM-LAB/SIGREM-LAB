import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { PaginaAdministracion } from './PaginaAdministracion'

const usePerfil = vi.hoisted(() => vi.fn())
vi.mock('@/features/auth/usePerfil', () => ({ usePerfil }))

function conRol(rol: 'admin' | 'responsable' | 'consulta') {
  usePerfil.mockReturnValue({
    isPending: false,
    isError: false,
    error: null,
    data: { rol, nombre: 'Quien sea' },
  })
}

function montar() {
  return render(
    <MemoryRouter>
      <PaginaAdministracion />
    </MemoryRouter>,
  )
}

describe('PaginaAdministracion', () => {
  beforeEach(() => {
    usePerfil.mockReset()
  })

  test('el admin ve las cuatro secciones', () => {
    conRol('admin')
    montar()

    expect(screen.getByRole('link', { name: /Almacenes y laboratorios/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Motivos de observación/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Programa educativo/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Usuarios/ })).toBeInTheDocument()
  })

  // No es sólo que no pueda: enseñarle una sección que la base le va a negar
  // sería ofrecerle un error para el final.
  test('el responsable ve una sola, la de su almacén', () => {
    conRol('responsable')
    montar()

    expect(screen.getByRole('link', { name: /Almacenes y laboratorios/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Programa educativo/ })).not.toBeInTheDocument()
  })

  // La guardia de la ruta ya lo manda a /, pero si algún día se afloja, la
  // pantalla no tiene por qué ofrecerle nada.
  test('un usuario de consulta no ve ninguna', () => {
    conRol('consulta')
    montar()

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
