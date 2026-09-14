import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoAsignatura } from './DialogoAsignatura'

describe('DialogoAsignatura', () => {
  test('permite cambiar el semestre de una asignatura vinculada', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(
      <DialogoAsignatura
        abierto
        disponibles={[]}
        inicial={{ nombre: 'Química General', semestre: 2 }}
        guardando={false}
        onGuardar={onGuardar}
        onCerrar={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Semestre' }))
    await user.click(screen.getByRole('option', { name: '7°' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).toHaveBeenCalledWith(
      { nombre: 'Química General', semestre: 7 },
      expect.anything(),
    )
  })

  test('permite cambiar una asignatura a optativa', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(
      <DialogoAsignatura
        abierto
        disponibles={[]}
        inicial={{ nombre: 'Química General', semestre: 2 }}
        guardando={false}
        onGuardar={onGuardar}
        onCerrar={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Semestre' }))
    await user.click(screen.getByRole('option', { name: 'Optativa' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).toHaveBeenCalledWith(
      { nombre: 'Química General', semestre: null },
      expect.anything(),
    )
  })
})
