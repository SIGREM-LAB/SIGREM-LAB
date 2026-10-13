import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { BuscadorCodigo } from './BuscadorCodigo'

describe('BuscadorCodigo', () => {
  test('con un código válido, busca', async () => {
    const user = userEvent.setup()
    const onBuscar = vi.fn()
    render(<BuscadorCodigo onBuscar={onBuscar} />)

    await user.type(screen.getByRole('textbox', { name: 'Buscar código' }), 'n3-00717{Enter}')

    expect(onBuscar).toHaveBeenCalledWith('n3-00717')
  })

  test('con otra cosa, avisa y no busca', async () => {
    const user = userEvent.setup()
    const onBuscar = vi.fn()
    render(<BuscadorCodigo onBuscar={onBuscar} />)

    await user.type(screen.getByRole('textbox', { name: 'Buscar código' }), 'sulfato{Enter}')

    expect(onBuscar).not.toHaveBeenCalled()
    expect(screen.getByText('Escribe un código como N3-00717')).toBeInTheDocument()
  })
})
