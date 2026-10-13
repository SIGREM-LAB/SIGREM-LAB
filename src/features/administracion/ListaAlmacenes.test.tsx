import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Almacen } from './consultas'
import { ListaAlmacenes } from './ListaAlmacenes'

const N3: Almacen = {
  id: 1,
  clave: 'N3',
  nombre: 'Almacén Nivel 3',
  usoPrincipal: 'Prácticas de laboratorio en UCL',
  zonaRiesgo: 'Laboratorio',
  personasExpuestas: 80,
}

const ICSA: Almacen = {
  id: 5,
  clave: 'ICSA',
  nombre: 'ICSA',
  usoPrincipal: null,
  zonaRiesgo: null,
  personasExpuestas: null,
}

describe('ListaAlmacenes', () => {
  // ICSA entro el 17 de septiembre con las tres constantes en nulo, «hasta que
  // el responsable las confirme». Marcarlo es lo que convierte esa nota de
  // migracion en algo que alguien ve y arregla.
  test('marca el almacén con la ficha NOM incompleta', () => {
    render(<ListaAlmacenes almacenes={[N3, ICSA]} seleccionado={1} onElegir={vi.fn()} />)

    expect(screen.getByText('Falta la ficha NOM')).toBeInTheDocument()
  })

  test('no marca el que la tiene completa', () => {
    render(<ListaAlmacenes almacenes={[N3]} seleccionado={1} onElegir={vi.fn()} />)

    expect(screen.queryByText('Falta la ficha NOM')).not.toBeInTheDocument()
  })

  // Basta con que falte UNA de las tres: el exportador las reinyecta juntas en
  // cada renglon, y una a medias sale igual de rota que ninguna.
  test('una sola constante en nulo ya cuenta como incompleta', () => {
    render(
      <ListaAlmacenes
        almacenes={[{ ...N3, personasExpuestas: null }]}
        seleccionado={1}
        onElegir={vi.fn()}
      />,
    )

    expect(screen.getByText('Falta la ficha NOM')).toBeInTheDocument()
  })
})
