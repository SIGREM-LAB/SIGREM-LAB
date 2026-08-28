import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import { OtrosAlmacenes } from './OtrosAlmacenes'
import type { ResumenAlmacen } from './menu'

const ALMACENES: ResumenAlmacen[] = [
  {
    id: 2,
    clave: 'N4',
    nombre: 'Almacén Nivel 4',
    total: 388,
    disponible: 330,
    stockBajo: 46,
    agotado: 12,
    contaminado: 0,
    mantenimiento: 0,
  },
  {
    id: 3,
    clave: 'LUM',
    nombre: 'Almacén LUM',
    total: 201,
    disponible: 178,
    stockBajo: 17,
    agotado: 6,
    contaminado: 0,
    mantenimiento: 0,
  },
]

function Destino() {
  const { state } = useLocation()
  const almacenId = (state as { almacenId?: unknown } | null)?.almacenId
  return <p>llegó almacén {String(almacenId)}</p>
}

function pintar() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <OtrosAlmacenes almacenes={ALMACENES} titulo="Otros almacenes" subtitulo="Solo consulta" />
          }
        />
        <Route path="/inventario" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OtrosAlmacenes', () => {
  test('nombra cada almacen por su clave y su nombre largo', () => {
    pintar()

    expect(screen.getByText('N4')).toBeInTheDocument()
    expect(screen.getByText('Almacén Nivel 4')).toBeInTheDocument()
    expect(screen.getByText('201')).toBeInTheDocument()
  })

  // Enlaces de verdad y no divs con onClick: asi se recorren con Tab y se
  // abren en pestana nueva con el clic de en medio.
  test('cada renglon es un enlace', () => {
    pintar()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  test('pulsar un renglon abre el inventario filtrado por ese almacen', async () => {
    pintar()

    await userEvent.click(screen.getByRole('link', { name: /LUM/ }))

    expect(screen.getByText('llegó almacén 3')).toBeInTheDocument()
  })

  test('el titulo y el subtitulo los decide quien la usa', () => {
    pintar()

    expect(screen.getByText('Otros almacenes')).toBeInTheDocument()
    expect(screen.getByText('Solo consulta')).toBeInTheDocument()
  })
})
