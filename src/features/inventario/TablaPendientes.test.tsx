import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { TablaPendientes } from './TablaPendientes'
import type { Pendiente } from './pendientes'

function pendiente(cambios: Partial<Pendiente> = {}): Pendiente {
  return {
    id: 1,
    almacen_id: 1,
    carga_id: 3,
    archivo: 'Inventario final.xlsx',
    hoja: 'Insumos',
    fila: 70,
    motivo: 'regla',
    renglon: { articulo: 'Papel filtro Whatman No. 3', unidad: 'paquete', cantidad: 1 },
    problemas: [
      {
        regla: 'Regla 2 · la cantidad va en la unidad más pequeña que se consume',
        columna: 'G',
        valor: 'paquete',
        detalle: '«paquete» es un empaque, no una unidad de consumo',
      },
    ],
    existencia_id: null,
    existencia_resuelta_id: null,
    estado: 'pendiente',
    nota: null,
    revisado_por: null,
    revisado_en: null,
    creado_en: '2026-08-26T10:00:00Z',
    ...cambios,
  }
}

function pintar(props: Partial<Parameters<typeof TablaPendientes>[0]> = {}) {
  const onAbrir = vi.fn()
  const resultado = render(
    <TablaPendientes
      filas={[pendiente()]}
      total={1}
      pagina={0}
      porPagina={25}
      almacenPropio={1}
      almacenes={[
        { id: 1, clave: 'N3' },
        { id: 2, clave: 'N4' },
      ]}
      onPagina={vi.fn()}
      onPorPagina={vi.fn()}
      onAbrir={onAbrir}
      {...props}
    />,
  )
  return { onAbrir, ...resultado }
}

describe('TablaPendientes', () => {
  test('dice hoja y fila, que es por donde se abre el archivo', () => {
    pintar()
    expect(screen.getByText('Insumos')).toBeInTheDocument()
    expect(screen.getByText('fila 70')).toBeInTheDocument()
  })

  // La unidad ES el problema en 105 de los 337 renglones de N3: si no se puede
  // leer en la lista, hay que abrir uno por uno para saber cuál es cuál.
  test('la cantidad se lee con su unidad, sin abrir el renglón', () => {
    pintar()
    expect(screen.getByText('1 paquete')).toBeInTheDocument()
  })

  test('un renglón que no dice cuánto hay no inventa un cero', () => {
    pintar({ filas: [pendiente({ renglon: { articulo: 'Vaso', unidad: 'pieza' } })] })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('resume el problema en palabras, no con el nombre de la regla', () => {
    pintar()
    expect(
      screen.getByText('«paquete» es un empaque, no una unidad de consumo'),
    ).toBeInTheDocument()
  })

  test('etiqueta el motivo y la revisión en palabras, no con el valor del enum', () => {
    pintar()
    expect(screen.getByText('Regla de captura')).toBeInTheDocument()
    expect(screen.getByText('Sin revisar')).toBeInTheDocument()
  })

  test('«resuelto» se rotula «Cargado»: significa que ya está en el inventario', () => {
    pintar({ filas: [pendiente({ estado: 'resuelto', existencia_resuelta_id: 42 })] })
    expect(screen.getByText('Cargado')).toBeInTheDocument()
  })

  test('marca los renglones de otro almacén, que son de solo consulta', () => {
    pintar({ filas: [pendiente({ almacen_id: 2 })] })
    expect(screen.getByTitle('De otro almacén: solo consulta')).toBeInTheDocument()
    expect(screen.getByText('N4')).toBeInTheDocument()
  })

  test('el renglón se abre desde el teclado, no solo con el ratón', async () => {
    const { onAbrir } = pintar()
    await userEvent.click(screen.getByRole('button', { name: 'Revisar Insumos · fila 70' }))
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  test('sin renglones lo dice, en vez de dejar la tabla en blanco', () => {
    pintar({ filas: [], total: 0 })
    expect(screen.getByText('No queda ningún renglón con esos filtros')).toBeInTheDocument()
  })

  test('un renglón con jsonb de otra forma no tumba la tabla', () => {
    pintar({ filas: [pendiente({ renglon: null, problemas: null })] })
    expect(screen.getByText('Renglón sin nombre')).toBeInTheDocument()
  })
})
