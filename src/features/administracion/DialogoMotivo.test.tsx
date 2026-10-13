import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoMotivo } from './DialogoMotivo'

describe('DialogoMotivo', () => {
  test('da de alta un motivo, ofrecido en los tres paneles de entrada', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(<DialogoMotivo abierto guardando={false} onGuardar={onGuardar} onCerrar={vi.fn()} />)

    await user.type(screen.getByLabelText('Clave'), 'derrame')
    await user.type(screen.getByLabelText('Etiqueta'), 'Derrame durante la práctica')
    await user.clear(screen.getByLabelText('Orden'))
    await user.type(screen.getByLabelText('Orden'), '8')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).toHaveBeenCalledWith(
      {
        clave: 'derrame',
        etiqueta: 'Derrame durante la práctica',
        orden: 8,
        metodos: ['peso', 'cantidad', 'prestamo'],
      },
      expect.anything(),
    )
  })

  // La clave es la PK y `practica_observacion` apunta por ella.
  test('al editar, la clave no se toca', () => {
    render(
      <DialogoMotivo
        abierto
        inicial={{ clave: 'derrame', etiqueta: 'Derrame', orden: 8, metodos: ['peso'] }}
        guardando={false}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Clave')).toBeDisabled()
  })

  test('rechaza una clave con mayúsculas o espacios', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(<DialogoMotivo abierto guardando={false} onGuardar={onGuardar} onCerrar={vi.fn()} />)

    await user.type(screen.getByLabelText('Clave'), 'Derrame Grande')
    await user.type(screen.getByLabelText('Etiqueta'), 'Derrame')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByText('La clave va en minúsculas y guiones bajos')).toBeInTheDocument()
  })

  test('exige al menos un panel', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(
      <DialogoMotivo
        abierto
        inicial={{ clave: 'derrame', etiqueta: 'Derrame', orden: 8, metodos: ['peso'] }}
        guardando={false}
        onGuardar={onGuardar}
        onCerrar={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Peso' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByText('Elige al menos un panel donde ofrecerlo')).toBeInTheDocument()
  })
})
