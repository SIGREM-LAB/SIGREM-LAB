import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Laboratorio } from './consultas'
import { ListaLaboratorios } from './ListaLaboratorios'

const LABORATORIOS: Laboratorio[] = [
  { id: 1, nombre: 'Análisis Sensorial', activo: true },
  { id: 2, nombre: 'Laboratorio de enseñanza 5', activo: false },
]

describe('ListaLaboratorios', () => {
  test('marca los retirados', () => {
    render(
      <ListaLaboratorios
        laboratorios={LABORATORIOS}
        puedeEditar
        onEditar={vi.fn()}
        onRetirar={vi.fn()}
      />,
    )

    expect(screen.getByText('Retirado')).toBeInTheDocument()
  })

  // Retirar y reactivar son el mismo boton: el rotulo accesible es lo que dice
  // cual de las dos cosas hace, y es por lo que se puede probar.
  test('el botón dice retirar o reactivar según el estado', () => {
    render(
      <ListaLaboratorios
        laboratorios={LABORATORIOS}
        puedeEditar
        onEditar={vi.fn()}
        onRetirar={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Retirar Análisis Sensorial' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reactivar Laboratorio de enseñanza 5' }),
    ).toBeInTheDocument()
  })

  test('sin permiso no se dibujan los botones', () => {
    render(
      <ListaLaboratorios
        laboratorios={LABORATORIOS}
        puedeEditar={false}
        onEditar={vi.fn()}
        onRetirar={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
