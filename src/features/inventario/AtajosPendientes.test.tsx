import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { AtajosPendientes } from './AtajosPendientes'
import { menuDeNavegacion } from '@/app/navegacion'

const PENDIENTES = menuDeNavegacion('admin', false).filter((item) => !item.disponible)

describe('AtajosPendientes', () => {
  // Reportes se entrego el 21 de septiembre de 2026 y era la ultima pendiente,
  // asi que hoy la lista esta vacia y la fila entera desaparece de la portada.
  // Que este componente se quede sin nada que dibujar es el final feliz, no un
  // fallo: exactamente lo que promete la prueba de abajo.
  test('sin pendientes no dibuja nada', () => {
    expect(PENDIENTES).toHaveLength(0)

    const { container } = render(<AtajosPendientes items={PENDIENTES} />)

    expect(container).toBeEmptyDOMElement()
  })

  test('dibuja una tarjeta por pantalla pendiente cuando las hay', () => {
    const inventado = {
      ruta: '/inventado',
      etiqueta: 'Pantalla inventada',
      icono: 'mdi:flask-outline',
      grupo: 'operacion' as const,
      descripcion: 'Lo que vendra',
      color: 'grey.600',
      disponible: false,
    }

    render(<AtajosPendientes items={[inventado]} />)

    expect(screen.getByText('Pantalla inventada')).toBeInTheDocument()
    expect(screen.getByText('Lo que vendra')).toBeInTheDocument()
  })

  // Practicas se entrego el 3 de septiembre y el inventario general el 9. En
  // ninguna de las dos hubo que borrar una tarjeta: basta con que
  // `menuDeNavegacion` las marque disponibles y salen solas de esta lista, que
  // es justo lo que promete el comentario del componente.
  test('lo ya entregado desaparece de la fila sin tocar este componente', () => {
    render(<AtajosPendientes items={PENDIENTES} />)

    expect(screen.queryByText('Prácticas')).not.toBeInTheDocument()
    expect(screen.queryByText('Inventario general')).not.toBeInTheDocument()
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
