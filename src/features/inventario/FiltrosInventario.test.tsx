import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { FiltrosInventario } from './FiltrosInventario'
import { filtrosIniciales, SIN_UBICACION, type Mueble } from './filtros'

const ALMACENES = [
  { id: 1, clave: 'N3' },
  { id: 2, clave: 'N4' },
  { id: 3, clave: 'LUM' },
  { id: 4, clave: 'LE' },
]

const MUEBLES: Mueble[] = [
  { nombre: 'Anaquel 2', repisas: ['1', '2'] },
  { nombre: 'Anaquel 10', repisas: ['1', '2', '3'] },
]

function pintar(props: Partial<Parameters<typeof FiltrosInventario>[0]> = {}) {
  const onCambio = vi.fn()
  render(
    <FiltrosInventario
      filtros={filtrosIniciales()}
      almacenes={ALMACENES}
      mostrarAlmacen
      muebles={MUEBLES}
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
    expect(screen.getByLabelText(/ordenar por/i)).toBeInTheDocument()
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

  // En Inventario el almacen es el ancla de la pantalla, no una eleccion:
  // ofrecer el selector seria ofrecer salirse de ella.
  test('anclada a un almacen, el selector no se dibuja', () => {
    pintar({ mostrarAlmacen: false })

    expect(screen.queryByLabelText(/almacén/i)).not.toBeInTheDocument()
    // Los demas siguen ahi: lo unico que se va es el almacen.
    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument()
  })

  test('cambiar el almacen propaga su id como numero, no como texto', async () => {
    const { onCambio } = pintar()

    await userEvent.click(screen.getByLabelText(/almacén/i))
    await userEvent.click(screen.getByRole('option', { name: 'LUM' }))

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ almacenId: 3 }))
  })

  // Ordenar por nombre es lo que se pide para encontrar algo cuyo codigo no se
  // sabe; ambas direcciones se ofrecen porque volver de la Z a la A sin poder
  // deshacerlo obligaria a recargar.
  test('ofrece el orden por codigo y las dos direcciones del nombre', async () => {
    pintar()

    await userEvent.click(screen.getByLabelText(/ordenar por/i))

    for (const etiqueta of ['Código', 'Nombre (A–Z)', 'Nombre (Z–A)']) {
      expect(screen.getByRole('option', { name: etiqueta })).toBeInTheDocument()
    }
  })

  test('elegir el alfabetico propaga el orden', async () => {
    const { onCambio } = pintar()

    await userEvent.click(screen.getByLabelText(/ordenar por/i))
    await userEvent.click(screen.getByRole('option', { name: 'Nombre (A–Z)' }))

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ orden: 'nombre_asc' }))
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
      filtros: { ...filtrosIniciales(), termino: 'acetona', almacenId: 2 },
    })

    await userEvent.click(screen.getByRole('checkbox', { name: /bajas/i }))

    expect(onCambio).toHaveBeenCalledWith(
      expect.objectContaining({ termino: 'acetona', almacenId: 2, incluirBaja: true }),
    )
  })

  describe('mueble y repisa', () => {
    // Las ubicaciones son de cada almacen: "Anaquel 4" existe en varios, y sin
    // almacen elegido no hay a cual se refiere.
    test('sin almacen elegido, los dos selectores estan apagados', () => {
      pintar()

      expect(screen.getByRole('combobox', { name: /mueble/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(screen.getByRole('combobox', { name: /repisa/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(screen.getByText('Elige un almacén')).toBeInTheDocument()
    })

    test('con almacen, ofrece los muebles mas "todos" y "sin ubicacion"', async () => {
      pintar({ filtros: { ...filtrosIniciales(), almacenId: 1 } })

      await userEvent.click(screen.getByRole('combobox', { name: /mueble/i }))

      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Todos los muebles',
        'Sin ubicación',
        'Anaquel 2',
        'Anaquel 10',
      ])
    })

    // La 2 de un anaquel no es la del otro: conservarla filtraria por una
    // repisa que nadie eligio.
    test('elegir un mueble suelta la repisa', async () => {
      const { onCambio } = pintar({
        filtros: { ...filtrosIniciales(), almacenId: 1, mueble: 'Anaquel 10', repisa: '3' },
      })

      await userEvent.click(screen.getByRole('combobox', { name: /mueble/i }))
      await userEvent.click(screen.getByRole('option', { name: 'Anaquel 2' }))

      expect(onCambio).toHaveBeenCalledWith(
        expect.objectContaining({ mueble: 'Anaquel 2', repisa: '' }),
      )
    })

    test('la repisa ofrece las del mueble elegido', async () => {
      const { onCambio } = pintar({
        filtros: { ...filtrosIniciales(), almacenId: 1, mueble: 'Anaquel 10' },
      })

      await userEvent.click(screen.getByRole('combobox', { name: /repisa/i }))
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Todas las repisas',
        '1',
        '2',
        '3',
      ])

      await userEvent.click(screen.getByRole('option', { name: '3' }))
      expect(onCambio).toHaveBeenCalledWith(
        expect.objectContaining({ mueble: 'Anaquel 10', repisa: '3' }),
      )
    })

    test('"sin ubicacion" no tiene repisas: el selector se apaga', () => {
      pintar({ filtros: { ...filtrosIniciales(), almacenId: 1, mueble: SIN_UBICACION } })

      expect(screen.getByRole('combobox', { name: /repisa/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })

    // El "Anaquel 2" de N3 no es el de N4.
    test('cambiar de almacen suelta mueble y repisa', async () => {
      const { onCambio } = pintar({
        filtros: { ...filtrosIniciales(), almacenId: 1, mueble: 'Anaquel 2', repisa: '1' },
      })

      await userEvent.click(screen.getByRole('combobox', { name: /almacén/i }))
      await userEvent.click(screen.getByRole('option', { name: 'N4' }))

      expect(onCambio).toHaveBeenCalledWith(
        expect.objectContaining({ almacenId: 2, mueble: '', repisa: '' }),
      )
    })
  })
})
