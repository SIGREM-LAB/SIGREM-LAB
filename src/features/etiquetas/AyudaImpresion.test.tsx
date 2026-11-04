import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { AyudaImpresion } from './AyudaImpresion'
import { ETIQUETA_PRUEBA, esCodigo } from './codigo'

describe('AyudaImpresion', () => {
  afterEach(() => vi.restoreAllMocks())

  test('abre la guía con la configuración del cuadro de impresión', async () => {
    const usuario = userEvent.setup()
    render(<AyudaImpresion />)

    await usuario.click(screen.getByRole('button', { name: 'Cómo imprimir etiquetas' }))

    const guia = screen.getByRole('dialog', { name: 'Cómo imprimir etiquetas' })
    expect(within(guia).getByText('Márgenes:')).toBeInTheDocument()
    // La medida del papel del driver sale de ETIQUETA_MM, no de un texto aparte.
    expect(within(guia).getByText(/papel de 50\.8 × 25\.4 mm/)).toBeInTheDocument()
  })

  test('la etiqueta de prueba se imprime sola', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    const usuario = userEvent.setup()
    render(<AyudaImpresion />)

    await usuario.click(screen.getByRole('button', { name: 'Cómo imprimir etiquetas' }))
    await usuario.click(screen.getByRole('button', { name: 'Imprimir etiqueta de prueba' }))

    const hoja = await screen.findByTestId('hoja-etiquetas')
    expect(within(hoja).getAllByText(ETIQUETA_PRUEBA.codigo)).toHaveLength(2)
    await vi.waitFor(() => expect(imprimir).toHaveBeenCalledOnce())
  })

  test('el código de prueba tiene forma de código, para que la pistola lo tome', () => {
    expect(esCodigo(ETIQUETA_PRUEBA.codigo)).toBe(true)
  })
})
