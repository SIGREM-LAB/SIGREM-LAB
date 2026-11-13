import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { AgregarProductos } from './AgregarProductos'

describe('AgregarProductos', () => {
  test('Buscar producto avisa hacia arriba', async () => {
    const onBuscar = vi.fn()
    render(<AgregarProductos onEscanear={vi.fn()} onBuscar={onBuscar} deshabilitado={false} />)

    await userEvent.click(screen.getByRole('button', { name: /buscar producto/i }))

    expect(onBuscar).toHaveBeenCalledOnce()
  })

  test('Escanear QR avisa hacia arriba', async () => {
    const onEscanear = vi.fn()
    render(<AgregarProductos onEscanear={onEscanear} onBuscar={vi.fn()} deshabilitado={false} />)

    await userEvent.click(screen.getByRole('button', { name: /escanear qr/i }))

    expect(onEscanear).toHaveBeenCalledOnce()
  })

  test('sin laboratorio elegido no se pueden agregar productos', () => {
    render(<AgregarProductos onEscanear={vi.fn()} onBuscar={vi.fn()} deshabilitado />)

    expect(screen.getByRole('button', { name: /buscar producto/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /escanear qr/i })).toBeDisabled()
  })
})
