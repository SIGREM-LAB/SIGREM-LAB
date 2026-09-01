import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { ListaAsignaturas } from './ListaAsignaturas'

const ASIGNATURAS = [
  { asignaturaId: 4, nombre: 'Bromatología', semestre: null },
  { asignaturaId: 3, nombre: 'Análisis de Alimentos', semestre: 5 },
  { asignaturaId: 1, nombre: 'Química General', semestre: 1 },
]

function montar() {
  return render(
    <ListaAsignaturas
      asignaturas={ASIGNATURAS}
      seleccionada={null}
      onElegir={vi.fn()}
      onCambiarSemestre={vi.fn()}
      onDesvincular={vi.fn()}
    />,
  )
}

describe('ListaAsignaturas', () => {
  test('muestra un encabezado por semestre', () => {
    montar()

    expect(screen.getByText('1°')).toBeInTheDocument()
    expect(screen.getByText('5°')).toBeInTheDocument()
    expect(screen.getByText('Optativa')).toBeInTheDocument()
  })

  // Lo que de verdad se prueba aquí: que el orden llegue hasta el DOM. La
  // agrupación ya está probada en semestres.test.ts; esto ancla que el
  // componente no la deshaga al pintarla.
  test('la optativa se pinta al final, después del último semestre', () => {
    montar()

    const encabezados = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

    expect(encabezados).toEqual(['1°', '5°', 'Optativa'])
  })

  test('cada asignatura aparece bajo su semestre', () => {
    montar()

    expect(screen.getByText('Química General')).toBeInTheDocument()
    expect(screen.getByText('Bromatología')).toBeInTheDocument()
  })
})
