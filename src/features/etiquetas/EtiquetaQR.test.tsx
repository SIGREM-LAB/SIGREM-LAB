import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { EtiquetaQR } from './EtiquetaQR'

describe('EtiquetaQR', () => {
  test('lleva el código, el nombre y la ubicación', () => {
    render(
      <EtiquetaQR
        codigo="N3-00717"
        nombre="Sulfato de cobre pentahidratado"
        ubicacion="Gabinete 301 / Repisa 2"
      />,
    )

    // Dos veces: el texto impreso y el título del SVG del QR.
    expect(screen.getAllByText('N3-00717')).toHaveLength(2)
    expect(screen.getByText('Sulfato de cobre pentahidratado')).toBeInTheDocument()
    expect(screen.getByText('Gabinete 301 / Repisa 2')).toBeInTheDocument()
    expect(screen.getByTitle('N3-00717').closest('svg')).not.toBeNull()
  })

  test('sin ubicación no deja un renglón vacío', () => {
    const { container } = render(<EtiquetaQR codigo="N4-00001" nombre="Matraz" ubicacion={null} />)
    // El primero es el título del SVG del QR.
    expect(container.textContent).toBe('N4-00001N4-00001Matraz')
  })
})
