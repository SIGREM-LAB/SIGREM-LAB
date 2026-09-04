import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { AgregarProductos } from './AgregarProductos'

describe('AgregarProductos', () => {
  test('Buscar producto avisa hacia arriba', async () => {
    const onBuscar = vi.fn()
    render(<AgregarProductos onBuscar={onBuscar} deshabilitado={false} />)

    await userEvent.click(screen.getByRole('button', { name: /buscar producto/i }))

    expect(onBuscar).toHaveBeenCalledOnce()
  })

  // Visible pero apagado, como las entradas pendientes del menú: el diseño
  // aprobado se ve completo y nadie se topa con un botón que no hace nada.
  test('Escanear QR está apagado y dice por qué', async () => {
    render(<AgregarProductos onBuscar={vi.fn()} deshabilitado={false} />)

    const boton = screen.getByRole('button', { name: /escanear qr/i })

    expect(boton).toBeDisabled()

    // El aviso vive en el Tooltip, que MUI monta al pasar el ratón. Se pasa por
    // el <span> que lo envuelve porque un botón deshabilitado no dispara
    // eventos del ratón, que es justo por lo que ese span existe.
    await userEvent.hover(boton.parentElement as HTMLElement)
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(/lector/i)
    })
  })

  test('sin laboratorio elegido no se pueden agregar productos', () => {
    render(<AgregarProductos onBuscar={vi.fn()} deshabilitado />)

    expect(screen.getByRole('button', { name: /buscar producto/i })).toBeDisabled()
  })
})
