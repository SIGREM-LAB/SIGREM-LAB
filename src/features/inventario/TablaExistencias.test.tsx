import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { TablaExistencias, type Fila } from './TablaExistencias'

function fila(cambios: Partial<Fila> = {}): Fila {
  return {
    id: 1,
    codigo: 'N3-00001',
    marca: 'SIGMA',
    cantidad: 139.8,
    estado: 'disponible',
    almacen_id: 1,
    ubicacion_id: 7,
    fecha_caducidad: null,
    creado_en: '2026-08-01T10:00:00Z',
    articulo_id: 5,
    nombre_canonico: '1,10-Fenantrolina monohidrato, sólido, pureza 99%, CAS: 5144-89-8',
    descripcion: null,
    clasificacion: 'reactivo',
    unidad_base: 'g',
    almacen_clave: 'N3',
    ubicacion: 'N3 · Anaquel 2 · Repisa 3',
    nombre_norm: '1,10-fenantrolina monohidrato, solido, pureza 99%, cas: 5144-89-8',
    marca_norm: 'sigma',
    ...cambios,
  }
}

function pintar(props: Partial<Parameters<typeof TablaExistencias>[0]> = {}) {
  const onAbrir = vi.fn()
  const resultado = render(
    <TablaExistencias
      filas={[fila()]}
      total={1}
      pagina={0}
      porPagina={25}
      almacenPropio={1}
      onPagina={vi.fn()}
      onPorPagina={vi.fn()}
      onAbrir={onAbrir}
      {...props}
    />,
  )
  return { onAbrir, ...resultado }
}

describe('TablaExistencias', () => {
  test('muestra la sustancia sin partirla por sus propias comas', () => {
    pintar()
    expect(screen.getByText('1,10-Fenantrolina monohidrato')).toBeInTheDocument()
  })

  test('muestra la cantidad con su unidad', () => {
    pintar()
    expect(screen.getByText('139.8 g')).toBeInTheDocument()
  })

  test('etiqueta el estado en palabras, no con el valor del enum', () => {
    pintar()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.queryByText('disponible')).not.toBeInTheDocument()
  })

  // El detalle tiene que abrirse con teclado. El prototipo pone el onClick en el
  // <tr>, y a un <tr> no se llega con Tab: sin raton la pantalla es inservible.
  test('el detalle se abre con el teclado', async () => {
    const { onAbrir } = pintar()

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(onAbrir).toHaveBeenCalledTimes(1)
    expect(onAbrir.mock.calls[0][0].codigo).toBe('N3-00001')
  })

  test('el control del detalle dice de que existencia es', () => {
    pintar()
    expect(screen.getByRole('button', { name: /N3-00001/ })).toBeInTheDocument()
  })

  test('la tabla tiene nombre accesible', () => {
    pintar()
    expect(screen.getByRole('table', { name: /existencias/i })).toBeInTheDocument()
  })

  test('avisa cuando no hay resultados', () => {
    pintar({ filas: [], total: 0 })
    expect(screen.getByText(/no se encontraron existencias/i)).toBeInTheDocument()
  })

  test('marca las filas que no son del almacen propio', () => {
    pintar({ filas: [fila({ almacen_id: 2, almacen_clave: 'N4' })], almacenPropio: 1 })
    expect(screen.getByTitle(/solo consulta/i)).toBeInTheDocument()
  })

  // Admin y consulta no tienen almacen propio contra el que contrastar: marcar
  // las 164 filas como ajenas seria ruido, no informacion.
  test('sin almacen propio no marca ninguna fila como ajena', () => {
    pintar({ almacenPropio: null })
    expect(screen.queryByTitle(/solo consulta/i)).not.toBeInTheDocument()
  })

  // La vista expone todas sus columnas anulables. Ninguna de estas es nula en la
  // tabla de abajo, pero el tipo lo permite y la pantalla no puede reventar.
  test('sobrevive a una fila con columnas nulas', () => {
    pintar({
      filas: [fila({ nombre_canonico: null, cantidad: null, estado: null, ubicacion: null })],
    })
    expect(screen.getByRole('button', { name: /N3-00001/ })).toBeInTheDocument()
  })

  // Las dos pruebas de abajo cuidan lo mismo: que la tabla no se mueva. Con el
  // reparto automatico de anchos, cada pagina reacomoda las seis columnas segun
  // el largo de sus datos, y cambiar de almacen se ve como un brinco.
  test('las columnas llevan ancho fijo', () => {
    const { container } = pintar()
    expect(container.querySelectorAll('colgroup col')).toHaveLength(6)
  })

  // Mientras llega la primera pagina se dibujan renglones vacios con su medida
  // final, no un hueco que luego empuja todo hacia abajo.
  test('cargando dibuja renglones de relleno y no anuncia que no hay nada', () => {
    pintar({ cargando: true, filas: [], total: 0 })

    // Uno de cabecera mas los ocho de relleno.
    expect(screen.getAllByRole('row')).toHaveLength(9)
    expect(screen.queryByText(/no se encontraron existencias/i)).not.toBeInTheDocument()
  })
})
