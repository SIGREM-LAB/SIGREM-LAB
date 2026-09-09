import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { elementoDesdeExistencia, type ElementoCaptura } from './esquemas'
import { TablaProductos } from './TablaProductos'

function elemento(
  id: number,
  nombre: string,
  clasificacion: 'reactivo' | 'material' | 'equipo',
  metodo: 'peso' | 'cantidad' | 'prestamo',
  campos: Partial<ElementoCaptura> = {},
): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      id,
      codigo: `N3-0000${id}`,
      nombre_canonico: nombre,
      clasificacion,
      unidad_base: 'ml',
      almacen_clave: 'N3',
      cantidad: 100,
      ubicacion: 'Lab 1',
      metodo_control: metodo,
    }),
    ...campos,
  }
}

const ETANOL = elemento(1, 'Etanol 96%', 'reactivo', 'peso', {
  pesoInicial: 526,
  pesoFinal: 520,
})
const VASO = elemento(2, 'Vaso de precipitado', 'material', 'cantidad')
const PHMETRO = elemento(3, 'pH-metro Hanna', 'equipo', 'prestamo', {
  estadoSalida: 'correcto',
})

function montar(extra = {}) {
  const props = {
    elementos: [ETANOL, VASO, PHMETRO],
    seleccionado: null as number | null,
    onElegir: vi.fn(),
    onQuitar: vi.fn(),
    ...extra,
  }
  render(<TablaProductos {...props} />)
  return props
}

describe('TablaProductos', () => {
  test('el contador dice cuántos van de cuántos', () => {
    montar()

    expect(screen.getByText('(2/3 completados)')).toBeInTheDocument()
  })

  test('cada fila muestra código, nombre, tipo y método', () => {
    montar()

    const fila = screen.getByRole('row', { name: /etanol 96%/i })

    expect(within(fila).getByText('N3-00001')).toBeInTheDocument()
    expect(within(fila).getByText('Reactivo')).toBeInTheDocument()
    expect(within(fila).getByText('Peso')).toBeInTheDocument()
  })

  // El chip sale de estaCompleto(), que es el espejo de los checks de la base.
  // Si esto y el botón de Finalizar discreparan, alguien finalizaría creyendo
  // que está completo y se comería un 23514.
  test('el estado de cada fila sale de si le falta captura', () => {
    montar()

    expect(
      within(screen.getByRole('row', { name: /etanol/i })).getByText('Completado'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /vaso/i })).getByText('Pendiente'),
    ).toBeInTheDocument()
  })

  test('hacer clic en una fila la selecciona', async () => {
    const { onElegir } = montar()

    await userEvent.click(screen.getByRole('row', { name: /vaso/i }))

    expect(onElegir).toHaveBeenCalledWith(2)
  })

  test('quitar avisa hacia arriba y no selecciona la fila', async () => {
    const { onQuitar, onElegir } = montar()

    await userEvent.click(screen.getByRole('button', { name: /quitar vaso de precipitado/i }))

    expect(onQuitar).toHaveBeenCalledWith(2)
    expect(onElegir).not.toHaveBeenCalled()
  })

  test('la fila seleccionada se marca para lectores de pantalla', () => {
    montar({ seleccionado: 2 })

    expect(screen.getByRole('row', { name: /vaso/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('row', { name: /etanol/i })).toHaveAttribute('aria-selected', 'false')
  })

  test('sin productos lo dice, con la instrucción de qué hacer', () => {
    montar({ elementos: [] })

    expect(screen.getByText('Sin productos')).toBeInTheDocument()
    expect(screen.getByText(/buscar producto/i)).toBeInTheDocument()
    expect(screen.queryByText(/completados/)).not.toBeInTheDocument()
  })
})
