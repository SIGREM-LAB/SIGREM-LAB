import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoLaboratorio } from './DialogoLaboratorio'

describe('DialogoLaboratorio', () => {
  test('da de alta un laboratorio', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(
      <DialogoLaboratorio
        abierto
        almacen="N4"
        guardando={false}
        onGuardar={onGuardar}
        onCerrar={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Nombre del laboratorio'), 'Laboratorio de enseñanza 7')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).toHaveBeenCalledWith(
      { nombre: 'Laboratorio de enseñanza 7' },
      expect.anything(),
    )
  })

  test('el título dice en qué almacén se está dando de alta', () => {
    render(
      <DialogoLaboratorio
        abierto
        almacen="N4"
        guardando={false}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    expect(screen.getByText('Nuevo laboratorio de N4')).toBeInTheDocument()
  })

  // El cargador de Excel y el alta de existencia resuelven el laboratorio por
  // nombre normalizado, no por id: renombrar cambia que renglones futuros hacen
  // match. Las existencias ya registradas no se mueven, porque esas si apuntan
  // por id. Decirlo es la diferencia entre una correccion y una sorpresa.
  test('al renombrar avisa del efecto sobre las cargas futuras', () => {
    render(
      <DialogoLaboratorio
        abierto
        almacen="N4"
        inicial={{ nombre: 'Análisis Sensorial' }}
        guardando={false}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    expect(screen.getByText(/cargas de Excel futuras/i)).toBeInTheDocument()
  })

  test('al dar de alta no aparece ese aviso', () => {
    render(
      <DialogoLaboratorio
        abierto
        almacen="N4"
        guardando={false}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    expect(screen.queryByText(/cargas de Excel futuras/i)).not.toBeInTheDocument()
  })
})
