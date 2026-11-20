import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { FiltrosActivos } from './FiltrosActivos'
import { filtrosIniciales, SIN_UBICACION, type Filtros } from './filtros'

const ALMACENES = [
  { id: 1, clave: 'N3' },
  { id: 2, clave: 'N4' },
  { id: 3, clave: 'LUM' },
  { id: 4, clave: 'LE' },
]

function pintar(filtros: Partial<Filtros> = {}, onLimpiar?: () => void, mostrarAlmacen = true) {
  const onCambio = vi.fn()
  const resultado = render(
    <FiltrosActivos
      filtros={{ ...filtrosIniciales(), ...filtros }}
      almacenes={ALMACENES}
      mostrarAlmacen={mostrarAlmacen}
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

  // En Inventario el almacen esta puesto SIEMPRE, porque es el ancla de la
  // pantalla. Su chip trae una X que lo pondria en "todos", que es justo lo que
  // esa pantalla no puede hacer: seria un boton para romperla.
  test('anclada a un almacen, su chip no aparece', () => {
    pintar({ almacenId: 3, termino: 'acetona' }, undefined, false)

    expect(screen.queryByText('Almacén: LUM')).not.toBeInTheDocument()
    expect(screen.getByText('Buscar: acetona')).toBeInTheDocument()
  })

  test('el estado se nombra en palabras, no con el valor del enum', () => {
    pintar({ estado: 'stock_bajo' })
    expect(screen.getByText('Estado: stock bajo')).toBeInTheDocument()
    expect(screen.queryByText(/stock_bajo/)).not.toBeInTheDocument()
  })

  // El orden enciende el boton de limpiar, asi que tiene que verse por que.
  test('el orden alfabetico se anuncia con su propio chip', async () => {
    const { onCambio } = pintar({ orden: 'nombre_asc' })

    expect(screen.getByText('Orden: Nombre (A–Z)')).toBeInTheDocument()

    screen.getByLabelText(/Quitar filtro\. Orden: Nombre/).focus()
    await userEvent.keyboard('{Backspace}')

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ orden: 'codigo' }))
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

  describe('mueble y repisa', () => {
    test('se anuncian con su nombre', () => {
      pintar({ almacenId: 1, mueble: 'Anaquel 4', repisa: '2' })

      expect(screen.getByText('Mueble: Anaquel 4')).toBeInTheDocument()
      expect(screen.getByText('Repisa: 2')).toBeInTheDocument()
    })

    test('"sin ubicacion" se dice en palabras, no con el valor interno', () => {
      pintar({ almacenId: 1, mueble: SIN_UBICACION })

      expect(screen.getByText('Sin ubicación')).toBeInTheDocument()
    })

    // Sin mueble la repisa no significa nada.
    test('quitar el mueble quita tambien la repisa', async () => {
      const { onCambio } = pintar({ almacenId: 1, mueble: 'Anaquel 4', repisa: '2' })

      screen.getByLabelText('Quitar filtro. Mueble: Anaquel 4').focus()
      await userEvent.keyboard('{Backspace}')

      expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ mueble: '', repisa: '' }))
    })

    test('quitar el almacen suelta mueble y repisa', async () => {
      const { onCambio } = pintar({ almacenId: 1, mueble: 'Anaquel 4', repisa: '2' })

      screen.getByLabelText('Quitar filtro. Almacén: N3').focus()
      await userEvent.keyboard('{Backspace}')

      expect(onCambio).toHaveBeenCalledWith(
        expect.objectContaining({ almacenId: 'todos', mueble: '', repisa: '' }),
      )
    })
  })
})
