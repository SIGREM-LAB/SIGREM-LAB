import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ArticuloConMinimo } from './consultas'
import { TablaMinimos } from './TablaMinimos'

const ARTICULOS: ArticuloConMinimo[] = [
  {
    articulo_id: 1,
    nombre: 'Acetona',
    clasificacion: 'reactivo',
    unidad: 'mL',
    minimo: null,
  },
  {
    articulo_id: 2,
    nombre: 'Etanol',
    clasificacion: 'reactivo',
    unidad: 'mL',
    minimo: 500,
  },
]

describe('TablaMinimos', () => {
  it('guarda al salir del campo, no en cada tecla', async () => {
    const guardar = vi.fn()
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={guardar} />)

    // Tres pulsaciones para escribir «250». Guardar en cada una serían tres
    // escrituras, y la última pisaría a las otras dos sin orden garantizado.
    await userEvent.type(screen.getByLabelText('Mínimo de Acetona'), '250')
    expect(guardar).not.toHaveBeenCalled()

    await userEvent.tab()
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(guardar).toHaveBeenCalledWith({ articuloId: 1, minimo: 250 })
  })

  it('vaciar el campo borra el mínimo, no lo pone en cero', async () => {
    const guardar = vi.fn()
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={guardar} />)

    await userEvent.clear(screen.getByLabelText('Mínimo de Etanol'))
    await userEvent.tab()

    // `minimo_articulo_positivo` rechaza el cero, y «no repongo esto» se dice
    // quitando el renglón.
    expect(guardar).toHaveBeenCalledWith({ articuloId: 2, minimo: null })
  })

  it('no guarda si el valor no cambió', async () => {
    const guardar = vi.fn()
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={guardar} />)

    await userEvent.click(screen.getByLabelText('Mínimo de Etanol'))
    await userEvent.tab()

    expect(guardar).not.toHaveBeenCalled()
  })

  it('muestra el mínimo que ya tiene, y vacío el que no', () => {
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={vi.fn()} />)

    expect(screen.getByLabelText('Mínimo de Etanol')).toHaveValue(500)
    expect(screen.getByLabelText('Mínimo de Acetona')).toHaveValue(null)
  })

  it('la unidad va a la vista: un mínimo sin unidad no se puede interpretar', () => {
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={vi.fn()} />)

    expect(screen.getAllByText('mL')).toHaveLength(2)
  })
})
