import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'

import { BotonTema } from './BotonTema'
import { tema } from '@/tema'

/** El unico boton cuyo nombre empieza por "Tema:". */
function control() {
  return screen.getByRole('button', { name: /^Tema:/ })
}

beforeEach(() => {
  // La preferencia vive en localStorage y el esquema resuelto en un atributo de
  // <html>: sin limpiarlos, cada prueba arrancaria donde termino la anterior.
  localStorage.clear()
  document.documentElement.removeAttribute('data-mui-color-scheme')
})

describe('BotonTema', () => {
  test('cicla automatico, claro, oscuro y vuelve', async () => {
    const usuario = userEvent.setup()
    render(
      <ThemeProvider theme={tema}>
        <BotonTema />
      </ThemeProvider>,
    )

    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')

    await usuario.click(control())
    expect(control()).toHaveAttribute('aria-label', 'Tema: claro')

    await usuario.click(control())
    expect(control()).toHaveAttribute('aria-label', 'Tema: oscuro')

    await usuario.click(control())
    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')
  })

  test('guarda la preferencia y marca el esquema en el documento', async () => {
    const usuario = userEvent.setup()
    render(
      <ThemeProvider theme={tema}>
        <BotonTema />
      </ThemeProvider>,
    )

    await usuario.click(control())
    expect(localStorage.getItem('mui-mode')).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-mui-color-scheme', 'light')

    await usuario.click(control())
    expect(document.documentElement).toHaveAttribute('data-mui-color-scheme', 'dark')
  })

  // Sin proveedor, useColorScheme devuelve el contexto vacio de MUI: mode
  // undefined y setMode sin efecto. Es la misma forma que tiene el primer
  // render antes de montar, y la que ven las pruebas de pantallas que no
  // envuelven en el tema. No puede parpadear ni tronar.
  test('aguanta el esquema sin resolver', async () => {
    const usuario = userEvent.setup()
    render(<BotonTema />)

    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')

    await usuario.click(control())

    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')
  })
})
