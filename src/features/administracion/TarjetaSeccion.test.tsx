import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import type { ItemMenu } from '@/app/navegacion'
import { TarjetaSeccion } from './TarjetaSeccion'

const ITEM: ItemMenu = {
  ruta: '/administracion/almacenes',
  etiqueta: 'Almacenes y laboratorios',
  icono: 'mdi:warehouse',
  grupo: 'administracion',
  descripcion: 'Los datos del almacén y los laboratorios a los que surte',
  color: 'institucional.main',
  disponible: true,
}

describe('TarjetaSeccion', () => {
  // Un enlace de verdad y no un onClick: es lo que permite abrirlo en otra
  // pestaña, copiar la dirección y que el lector de pantalla lo anuncie como
  // enlace. La tarjeta entera es el área pulsable.
  test('la tarjeta entera es un enlace a la sección', () => {
    render(
      <MemoryRouter>
        <TarjetaSeccion item={ITEM} />
      </MemoryRouter>,
    )

    const enlace = screen.getByRole('link', { name: /Almacenes y laboratorios/ })

    expect(enlace).toHaveAttribute('href', '/administracion/almacenes')
    expect(enlace).toHaveTextContent('Los datos del almacén y los laboratorios a los que surte')
  })
})
