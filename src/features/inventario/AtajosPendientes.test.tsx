import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { AtajosPendientes } from './AtajosPendientes'
import { menuDeNavegacion } from '@/app/navegacion'

const PENDIENTES = menuDeNavegacion('admin').filter((item) => !item.disponible)

describe('AtajosPendientes', () => {
  test('dibuja una tarjeta por pantalla pendiente', () => {
    render(<AtajosPendientes items={PENDIENTES} />)

    expect(screen.getByText('Reportes')).toBeInTheDocument()
    expect(screen.getByText('Inventario general')).toBeInTheDocument()
  })

  // Practicas se entrego el 3 de septiembre. Aqui no hubo que borrar una
  // tarjeta: basta con que `menuDeNavegacion` la marque disponible y sale sola
  // de esta lista, que es justo lo que promete el comentario del componente.
  test('lo ya entregado desaparece de la fila sin tocar este componente', () => {
    render(<AtajosPendientes items={PENDIENTES} />)

    expect(screen.queryByText('Prácticas')).not.toBeInTheDocument()
  })

  test('cada una cuenta que se va a hacer ahi', () => {
    render(<AtajosPendientes items={PENDIENTES} />)

    for (const item of PENDIENTES) {
      expect(screen.getByText(item.descripcion)).toBeInTheDocument()
    }
  })

  // No son controles: no hay nada que pulsar todavia, y un boton apagado que
  // ocupa media pantalla invita a intentarlo una y otra vez.
  test('no ofrece nada que pulsar', () => {
    render(<AtajosPendientes items={PENDIENTES} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  test('el dia que no quede ninguna pendiente, la fila desaparece', () => {
    const { container } = render(<AtajosPendientes items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
