import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { LogoUAEH } from './LogoUAEH'

describe('LogoUAEH', () => {
  test('se anuncia con el nombre de la universidad', () => {
    render(<LogoUAEH alto={30} variante="marca" />)

    expect(
      screen.getByRole('img', { name: /universidad autónoma del estado de hidalgo/i }),
    ).toBeInTheDocument()
  })

  // Cuando la misma pantalla lleva el logo dos veces -el monograma arriba y el
  // logo completo abajo- el segundo no debe anunciarse: un lector de pantalla
  // leeria el nombre de la universidad dos veces sin que eso aporte nada.
  test('la copia decorativa no se anuncia', () => {
    render(<LogoUAEH alto={105} decorativo />)

    expect(screen.queryByRole('img')).toBeNull()
  })
})
