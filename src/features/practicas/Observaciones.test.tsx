import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Motivo } from './consultas'
import { elementoDesdeExistencia } from './esquemas'
import { Observaciones } from './Observaciones'

const MOTIVOS: Motivo[] = [
  { clave: 'no_tenemos', etiqueta: 'No tenemos', metodos: ['peso', 'cantidad'] },
  { clave: 'material_daniado', etiqueta: 'Material dañado', metodos: ['cantidad'] },
  { clave: 'equipo_daniado', etiqueta: 'Equipo dañado', metodos: ['prestamo'] },
  { clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] },
]

function elemento(metodo: 'peso' | 'cantidad' | 'prestamo', motivos: string[] = []) {
  return {
    ...elementoDesdeExistencia({
      id: 1,
      codigo: 'N3-00042',
      nombre_canonico: 'Etanol 96%',
      clasificacion: metodo === 'prestamo' ? ('equipo' as const) : ('reactivo' as const),
      unidad_base: 'ml',
      almacen_clave: 'N3',
      cantidad: 2000,
      ubicacion: null,
      metodo_control: metodo,
    }),
    motivos,
  }
}

describe('Observaciones', () => {
  // La lista NO está escrita en el componente: sale de motivo_observacion.metodos,
  // para que mover un motivo de panel sea un update y no un redespliegue.
  test('el panel de préstamo no ofrece "Material dañado"', () => {
    render(<Observaciones elemento={elemento('prestamo')} motivos={MOTIVOS} onCambiar={vi.fn()} />)

    expect(screen.getByLabelText('Equipo dañado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Material dañado')).not.toBeInTheDocument()
  })

  test('el de cantidad ofrece los consumibles y su propio dañado', () => {
    render(<Observaciones elemento={elemento('cantidad')} motivos={MOTIVOS} onCambiar={vi.fn()} />)

    expect(screen.getByLabelText('No tenemos')).toBeInTheDocument()
    expect(screen.getByLabelText('Material dañado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Equipo dañado')).not.toBeInTheDocument()
  })

  test('marcar una casilla la agrega a los motivos', async () => {
    const onCambiar = vi.fn()
    render(<Observaciones elemento={elemento('peso')} motivos={MOTIVOS} onCambiar={onCambiar} />)

    await userEvent.click(screen.getByLabelText('No tenemos'))

    expect(onCambiar).toHaveBeenCalledWith({ motivos: ['no_tenemos'] })
  })

  test('desmarcarla la quita sin tocar las demás', async () => {
    const onCambiar = vi.fn()
    render(
      <Observaciones
        elemento={elemento('peso', ['no_tenemos', 'otro'])}
        motivos={MOTIVOS}
        onCambiar={onCambiar}
      />,
    )

    await userEvent.click(screen.getByLabelText('No tenemos'))

    expect(onCambiar).toHaveBeenCalledWith({ motivos: ['otro'] })
  })

  test('la descripción adicional avisa hacia arriba', async () => {
    const onCambiar = vi.fn()
    render(<Observaciones elemento={elemento('peso')} motivos={MOTIVOS} onCambiar={onCambiar} />)

    await userEvent.type(screen.getByLabelText(/descripción adicional/i), 'x')

    expect(onCambiar).toHaveBeenLastCalledWith({ observaciones: 'x' })
  })
})
