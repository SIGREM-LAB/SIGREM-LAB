import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { FiltrosInventario } from './FiltrosInventario'
import { filtrosIniciales } from './filtros'

const ALMACENES = [
  { id: 1, clave: 'N3' },
  { id: 2, clave: 'N4' },
  { id: 3, clave: 'LUM' },
  { id: 4, clave: 'LE' },
]

function pintar(props: Partial<Parameters<typeof FiltrosInventario>[0]> = {}) {
  const onCambio = vi.fn()
  render(
    <FiltrosInventario
      filtros={filtrosIniciales(undefined)}
      almacenes={ALMACENES}
      onCambio={onCambio}
      {...props}
    />,
  )
  return { onCambio }
}

describe('FiltrosInventario', () => {
  // Sin etiqueta asociada, un lector de pantalla anuncia "cuadro de edicion" y
  // nada mas. Los cuatro controles llevan la suya.
  test('cada control tiene etiqueta accesible', () => {
    pintar()
    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/almacén/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument()
  })

  test('escribir en el buscador propaga el termino', async () => {
    const { onCambio } = pintar()

    await userEvent.type(screen.getByLabelText(/buscar/i), 'a')

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ termino: 'a' }))
  })

  test('ofrece los cuatro almacenes mas la opcion de verlos todos', async () => {
    pintar()

    await userEvent.click(screen.getByLabelText(/almacén/i))

    expect(screen.getByRole('option', { name: 'Todos los almacenes' })).toBeInTheDocument()
    for (const clave of ['N3', 'N4', 'LUM', 'LE']) {
      expect(screen.getByRole('option', { name: clave })).toBeInTheDocument()
    }
  })

  // Las seis del enum. El prototipo ofrece cinco y deja `componente` fuera.
  test('ofrece las seis clasificaciones', async () => {
    pintar()

    await userEvent.click(screen.getByLabelText(/tipo/i))

    for (const etiqueta of [
      'Reactivos',
      'Materiales',
      'Equipos',
      'Insumos',
      'Componentes',
      'Materia biológica',
    ]) {
      expect(screen.getByRole('option', { name: etiqueta })).toBeInTheDocument()
    }
  })

  test('cambiar el almacen propaga su id como numero, no como texto', async () => {
    const { onCambio } = pintar()

    await userEvent.click(screen.getByLabelText(/almacén/i))
    await userEvent.click(screen.getByRole('option', { name: 'LUM' }))

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ almacenId: 3 }))
  })

  test('la casilla de bajas arranca apagada y propaga el cambio', async () => {
    const { onCambio } = pintar()
    const casilla = screen.getByRole('checkbox', { name: /bajas/i })

    expect(casilla).not.toBeChecked()
    await userEvent.click(casilla)

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ incluirBaja: true }))
  })

  // Cada control publica el estado COMPLETO, no solo su trozo: si alguno se
  // olvidara del resto, cambiar el tipo borraria el termino ya tecleado.
  test('cambiar un filtro conserva los demas', async () => {
    const { onCambio } = pintar({
      filtros: { ...filtrosIniciales(undefined), termino: 'acetona', almacenId: 2 },
    })

    await userEvent.click(screen.getByRole('checkbox', { name: /bajas/i }))

    expect(onCambio).toHaveBeenCalledWith(
      expect.objectContaining({ termino: 'acetona', almacenId: 2, incluirBaja: true }),
    )
  })
})
