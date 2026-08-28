import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { FiltrosActivos } from './FiltrosActivos'
import { filtrosIniciales, type Filtros } from './filtros'

const ALMACENES = [
  { id: 1, clave: 'N3' },
  { id: 2, clave: 'N4' },
  { id: 3, clave: 'LUM' },
  { id: 4, clave: 'LE' },
]

function pintar(filtros: Partial<Filtros> = {}, onLimpiar?: () => void) {
  const onCambio = vi.fn()
  const resultado = render(
    <FiltrosActivos
      filtros={{ ...filtrosIniciales(undefined), ...filtros }}
      almacenes={ALMACENES}
      onCambio={onCambio}
      onLimpiar={onLimpiar}
    />,
  )
  return { onCambio, ...resultado }
}

describe('FiltrosActivos', () => {
  test('sin nada filtrado no ocupa espacio', () => {
    const { container } = pintar()
    expect(container).toBeEmptyDOMElement()
  })

  test('el almacen se nombra por su clave, no por su id', () => {
    pintar({ almacenId: 3 })
    expect(screen.getByText('Almacén: LUM')).toBeInTheDocument()
  })

  test('el estado se nombra en palabras, no con el valor del enum', () => {
    pintar({ estado: 'stock_bajo' })
    expect(screen.getByText('Estado: stock bajo')).toBeInTheDocument()
    expect(screen.queryByText(/stock_bajo/)).not.toBeInTheDocument()
  })

  // Cada chip publica el estado COMPLETO. Si alguno se olvidara del resto,
  // quitar el almacen borraria de paso el termino ya tecleado.
  test('quitar un filtro conserva los demas', async () => {
    const { onCambio } = pintar({ termino: 'acetona', almacenId: 2 })

    // Con el foco puesto, Supr quita el chip: el filtro se puede soltar sin
    // raton, que es como se trabaja en el almacen.
    screen.getByLabelText(/Quitar filtro\. Almacén: N4/).focus()
    await userEvent.keyboard('{Backspace}')

    expect(onCambio).toHaveBeenCalledWith(
      expect.objectContaining({ termino: 'acetona', almacenId: 'todos' }),
    )
  })

  test('el boton de limpiar solo aparece cuando hay a donde volver', async () => {
    const onLimpiar = vi.fn()
    pintar({ termino: 'acetona' }, onLimpiar)

    await userEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }))

    expect(onLimpiar).toHaveBeenCalledTimes(1)
  })

  test('sin onLimpiar no se ofrece limpiar', () => {
    pintar({ termino: 'acetona' })
    expect(screen.queryByRole('button', { name: /limpiar filtros/i })).not.toBeInTheDocument()
  })
})
