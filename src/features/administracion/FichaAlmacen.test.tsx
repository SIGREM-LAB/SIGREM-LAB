import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Almacen } from './consultas'
import { FichaAlmacen } from './FichaAlmacen'

const ICSA: Almacen = {
  id: 5,
  clave: 'ICSA',
  nombre: 'ICSA',
  usoPrincipal: null,
  zonaRiesgo: null,
  personasExpuestas: null,
}

describe('FichaAlmacen', () => {
  // La clave la casan el ETL, el exportador y la semilla. Cambiarla en caliente
  // rompe cargas, y por eso el privilegio de update no la incluye: el campo
  // deshabilitado solo evita que alguien lo intente y reciba un 42501.
  test('la clave se ve pero no se edita', () => {
    render(<FichaAlmacen almacen={ICSA} puedeEditar guardando={false} onGuardar={vi.fn()} />)

    expect(screen.getByLabelText('Clave')).toBeDisabled()
    expect(screen.getByLabelText('Clave')).toHaveValue('ICSA')
  })

  test('guarda los tres campos de la NOM', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(<FichaAlmacen almacen={ICSA} puedeEditar guardando={false} onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Uso principal'), 'Prácticas de laboratorio')
    await user.type(screen.getByLabelText('Zona de riesgo'), 'Laboratorio')
    await user.type(screen.getByLabelText('Personas expuestas'), '40')
    await user.click(screen.getByRole('button', { name: 'Guardar ficha' }))

    expect(onGuardar).toHaveBeenCalledWith(
      {
        nombre: 'ICSA',
        usoPrincipal: 'Prácticas de laboratorio',
        zonaRiesgo: 'Laboratorio',
        personasExpuestas: 40,
      },
      expect.anything(),
    )
  })

  // Un responsable mirando el almacen de otro: la base se lo negaria igual, pero
  // un formulario que acepta escritura y luego responde 42501 es una trampa.
  test('sin permiso, los campos están deshabilitados y no hay botón', () => {
    render(
      <FichaAlmacen almacen={ICSA} puedeEditar={false} guardando={false} onGuardar={vi.fn()} />,
    )

    expect(screen.getByLabelText('Uso principal')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar ficha' })).not.toBeInTheDocument()
  })
})
