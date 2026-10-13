import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Motivo } from './consultas'
import { ListaMotivos } from './ListaMotivos'

const MOTIVOS: Motivo[] = [
  {
    clave: 'derrame',
    etiqueta: 'Derrame durante la práctica',
    orden: 1,
    activo: true,
    metodos: ['peso', 'cantidad'],
  },
  {
    clave: 'faltante',
    etiqueta: 'Faltante al devolver',
    orden: 2,
    activo: false,
    metodos: ['prestamo'],
  },
]

function pintar() {
  render(<ListaMotivos motivos={MOTIVOS} onEditar={vi.fn()} onRetirar={vi.fn()} />)
}

describe('ListaMotivos', () => {
  test('marca los retirados', () => {
    pintar()
    expect(screen.getByText('Retirado')).toBeInTheDocument()
  })

  test('enseña la clave y los paneles del que sigue activo', () => {
    pintar()
    expect(screen.getByText('derrame · Peso, Cantidad')).toBeInTheDocument()
  })

  test('el botón dice retirar o reactivar según el estado', () => {
    pintar()
    expect(
      screen.getByRole('button', { name: 'Retirar Derrame durante la práctica' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivar Faltante al devolver' })).toBeInTheDocument()
  })
})
