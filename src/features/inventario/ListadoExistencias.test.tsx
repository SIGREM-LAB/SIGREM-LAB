import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Fila } from './TablaExistencias'
import type { ResumenAlmacen } from './menu'

const { espias } = vi.hoisted(() => ({
  espias: {
    existencias: vi.fn(),
    resumenAlmacenes: vi.fn(),
  },
}))

const FILA: Fila = {
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
  nombre_canonico: 'Acetona',
  descripcion: null,
  clasificacion: 'reactivo',
  metodo_control: 'peso',
  unidad_base: 'g',
  almacen_clave: 'N3',
  ubicacion: 'Anaquel 2 · Repisa 3',
  nombre_norm: 'acetona',
  marca_norm: 'sigma',
}

/**
 * Lo que devuelve el listado en este momento. Es una variable y no la constante
 * de arriba para poder simular lo que pasa tras guardar: la consulta se
 * invalida y vuelve con la fila corregida.
 */
let filaActual: Fila = FILA

function resumen(id: number, clave: string): ResumenAlmacen {
  return {
    id,
    clave,
    nombre: `Almacén ${clave}`,
    total: 100,
    disponible: 90,
    stockBajo: 5,
    agotado: 3,
    contaminado: 1,
    mantenimiento: 1,
  }
}

// El doble reemplaza la capa de datos entera: lo que se prueba aquí es el
// reparto entre las dos pantallas, no las consultas.
vi.mock('./consultas', async () => {
  const real = await vi.importActual<typeof import('./consultas')>('./consultas')
  return {
    ...real,
    useExistencias: (...args: unknown[]) => {
      espias.existencias(...args)
      return {
        data: { filas: [filaActual], total: 1 },
        isPending: false,
        isFetching: false,
        isPlaceholderData: false,
        error: null,
      }
    },
    useAlmacenes: () => ({
      data: [
        { id: 1, clave: 'N3' },
        { id: 2, clave: 'N4' },
      ],
    }),
    useResumenAlmacenes: (habilitado: boolean) => {
      espias.resumenAlmacenes(habilitado)
      return { data: [resumen(1, 'N3'), resumen(2, 'N4')], isPending: false }
    },
    useMovimientos: () => ({ data: [], isPending: false }),
    useDetalleExistencia: () => ({ data: undefined }),
  }
})

const { ListadoExistencias } = await import('./ListadoExistencias')

function pintar(props: Partial<Parameters<typeof ListadoExistencias>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ListadoExistencias almacenFijo={null} almacenPropio={null} {...props} />
    </MemoryRouter>,
  )
}

/** Los filtros con los que se pidió la última página. */
function ultimosFiltros() {
  const llamadas = espias.existencias.mock.calls
  return llamadas[llamadas.length - 1][0] as { almacenId: number | 'todos' }
}

beforeEach(() => {
  espias.existencias.mockClear()
  espias.resumenAlmacenes.mockClear()
  filaActual = FILA
})

describe('ListadoExistencias', () => {
  describe('anclado a un almacén', () => {
    test('el almacén llega a la consulta sin que nadie lo elija', () => {
      pintar({ almacenFijo: 2, almacenPropio: 2 })
      expect(ultimosFiltros().almacenId).toBe(2)
    })

    // Las tres piezas que dejan de significar algo cuando todos los renglones
    // son de la misma bodega.
    test('no dibuja la tira, ni el selector, ni la columna', () => {
      pintar({ almacenFijo: 2, almacenPropio: 2 })

      expect(screen.queryByRole('group', { name: 'Filtrar por almacén' })).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Almacén' })).not.toBeInTheDocument()
      expect(screen.queryByRole('columnheader', { name: 'Almacén' })).not.toBeInTheDocument()
    })

    // Veinte números que no se enseñan en ningún sitio: pedirlos sería un viaje
    // por cada visita a la pantalla.
    test('no pide el resumen por almacén', () => {
      pintar({ almacenFijo: 2, almacenPropio: 2 })
      expect(espias.resumenAlmacenes).toHaveBeenCalledWith(false)
    })
  })

  describe('cruzando los cuatro', () => {
    test('arranca en todos los almacenes', () => {
      pintar()
      expect(ultimosFiltros().almacenId).toBe('todos')
    })

    test('dibuja la tira, el selector y la columna', () => {
      pintar()

      expect(screen.getByRole('group', { name: 'Filtrar por almacén' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Almacén' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Almacén' })).toBeInTheDocument()
    })

    test('pide el resumen por almacén, que es lo que pinta la tira', () => {
      pintar()
      expect(espias.resumenAlmacenes).toHaveBeenCalledWith(true)
    })

    // Quien pulsa N4 en el menú principal aterriza aquí ya filtrado por N4.
    test('la semilla del menú entra como filtro de arranque', () => {
      pintar({ almacenSemilla: 2 })
      expect(ultimosFiltros().almacenId).toBe(2)
    })

    // La semilla se lee al montar y no es el punto de partida al que vuelve
    // "Limpiar": llegar filtrado por N4 y querer los cuatro es justo para lo que
    // se pulsa ese botón, así que el chip tiene que estar puesto.
    test('llegar con semilla deja el filtro anunciado y se puede quitar', () => {
      pintar({ almacenSemilla: 2 })

      expect(screen.getByText('Almacén: N4')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeInTheDocument()
    })
  })

  describe('editar', () => {
    // Se ofrece en Inventario, que está anclado a tu bodega. Inventario general
    // cruza los cuatro almacenes y tendrá su propia acción.
    test('el detalle ofrece corregir donde se permite', async () => {
      const usuario = userEvent.setup()
      pintar({ almacenFijo: 1, almacenPropio: 1, permiteEditar: true })

      await usuario.click(screen.getByRole('button', { name: /N3-00001/ }))
      expect(await screen.findByRole('button', { name: /^editar$/i })).toBeInTheDocument()
    })

    test('y no lo ofrece donde no', async () => {
      const usuario = userEvent.setup()
      pintar({ almacenFijo: 1, almacenPropio: 1 })

      await usuario.click(screen.getByRole('button', { name: /N3-00001/ }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^editar$/i })).not.toBeInTheDocument()
    })

    // El panel abierto no guarda una copia de la fila: la busca en el listado
    // cada vez. Con una copia, tras guardar seguiría enseñando el saldo viejo
    // detrás del diálogo.
    test('el detalle abierto se refresca cuando la tabla trae otro dato', async () => {
      const usuario = userEvent.setup()
      const { rerender } = pintar({ almacenFijo: 1, almacenPropio: 1, permiteEditar: true })

      await usuario.click(screen.getByRole('button', { name: /N3-00001/ }))
      expect(await screen.findByRole('dialog', { name: /N3-00001/ })).toHaveTextContent('SIGMA')

      filaActual = { ...FILA, marca: 'MEYER', cantidad: 108 }
      rerender(
        <MemoryRouter>
          <ListadoExistencias almacenFijo={1} almacenPropio={1} permiteEditar />
        </MemoryRouter>,
      )

      expect(screen.getByRole('dialog', { name: /N3-00001/ })).toHaveTextContent('MEYER')
      expect(screen.getByRole('dialog', { name: /N3-00001/ })).toHaveTextContent('108 g')
    })
  })
})
