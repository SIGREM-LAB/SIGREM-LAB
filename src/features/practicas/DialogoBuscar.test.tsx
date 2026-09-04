import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoBuscar } from './DialogoBuscar'

const FILAS = [
  {
    id: 12,
    codigo: 'N3-00042',
    nombre_canonico: 'Etanol 96%',
    clasificacion: 'reactivo' as const,
    unidad_base: 'ml',
    almacen_clave: 'N3',
    cantidad: 2000,
    ubicacion: 'Lab 2',
    metodo_control: 'peso' as const,
  },
  {
    id: 13,
    codigo: 'N3-00043',
    nombre_canonico: 'Vaso de precipitado 250 ml',
    clasificacion: 'material' as const,
    unidad_base: 'piezas',
    almacen_clave: 'N3',
    cantidad: 24,
    ubicacion: 'Lab 1',
    metodo_control: 'cantidad' as const,
  },
]

function montar(extra = {}) {
  const props = {
    abierto: true,
    termino: '',
    onTermino: vi.fn(),
    filas: FILAS,
    cargando: false,
    yaAgregados: [] as number[],
    onAgregar: vi.fn(),
    onCerrar: vi.fn(),
    ...extra,
  }
  render(<DialogoBuscar {...props} />)
  return props
}

describe('DialogoBuscar', () => {
  test('cada fila muestra código, nombre, clasificación, almacén y saldo', () => {
    montar()

    expect(screen.getByText('N3-00042')).toBeInTheDocument()
    expect(screen.getByText('Etanol 96%')).toBeInTheDocument()
    expect(screen.getByText('Reactivo')).toBeInTheDocument()
    expect(screen.getByText('N3 · 2000 ml')).toBeInTheDocument()
    expect(screen.getByText('Lab 2')).toBeInTheDocument()
  })

  test('agregar avisa con la fila completa', async () => {
    const { onAgregar } = montar()

    await userEvent.click(screen.getByRole('button', { name: /agregar etanol 96%/i }))

    expect(onAgregar).toHaveBeenCalledWith(FILAS[0])
  })

  // Sin esto se agrega dos veces el mismo frasco y quedan dos practica_elemento
  // sobre la misma existencia, cada uno descontando por su cuenta.
  test('lo que ya está en la captura no se puede agregar otra vez', () => {
    montar({ yaAgregados: [12] })

    expect(screen.getByRole('button', { name: /agregar etanol 96%/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /agregar vaso de precipitado/i })).toBeEnabled()
  })

  test('teclear avisa del término hacia arriba', async () => {
    const { onTermino } = montar()

    await userEvent.type(screen.getByLabelText('Código o nombre'), 'eta')

    expect(onTermino).toHaveBeenCalled()
  })

  test('sin resultados lo dice, en vez de quedarse en blanco', () => {
    montar({ filas: [], termino: 'zzz' })

    expect(screen.getByText(/no hay productos que coincidan/i)).toBeInTheDocument()
  })

  test('mientras carga no dice que no hay nada', () => {
    montar({ filas: [], termino: 'zzz', cargando: true })

    expect(screen.queryByText(/no hay productos que coincidan/i)).not.toBeInTheDocument()
  })
})
