import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { DetallePractica } from './consultas'
import { PanelPractica } from './PanelPractica'

const REACTIVO = {
  id: 1,
  metodo_control: 'peso' as const,
  peso_inicial: 526,
  peso_final: 520,
  consumo: 6,
  cantidad_entregada: null,
  cantidad_devuelta: null,
  cantidad_danada: null,
  perdidas: null,
  estado_salida: null,
  estado_devolucion: null,
  observaciones: 'Se derramó un poco',
  existencia: {
    codigo: 'N3-00042',
    articulo: { nombre_canonico: 'Etanol 96%', unidad_base: 'ml' },
  },
}

const MATERIAL = {
  id: 2,
  metodo_control: 'cantidad' as const,
  peso_inicial: null,
  peso_final: null,
  consumo: null,
  cantidad_entregada: 10,
  cantidad_devuelta: 8,
  cantidad_danada: 1,
  perdidas: 1,
  estado_salida: null,
  estado_devolucion: null,
  observaciones: null,
  existencia: {
    codigo: 'N3-00043',
    articulo: { nombre_canonico: 'Vaso de precipitado 250 ml', unidad_base: 'piezas' },
  },
}

const EQUIPO = {
  id: 3,
  metodo_control: 'prestamo' as const,
  peso_inicial: null,
  peso_final: null,
  consumo: null,
  cantidad_entregada: null,
  cantidad_devuelta: null,
  cantidad_danada: null,
  perdidas: null,
  estado_salida: 'correcto' as const,
  estado_devolucion: 'presenta_fallas' as const,
  observaciones: null,
  existencia: {
    codigo: 'N3-00044',
    articulo: { nombre_canonico: 'Balanza analítica', unidad_base: 'piezas' },
  },
}

const DETALLE = {
  id: 7,
  folio: 'PRA-0001',
  fecha: '2026-09-05',
  observaciones: null,
  programa: { nombre: 'Química en Alimentos' },
  asignatura: { nombre: 'Bioquímica' },
  catalogo: { numero: 2, nombre: 'Actividad enzimática' },
  laboratorio: { nombre: 'Laboratorio de docencia N3' },
  responsable: { nombre: 'Daniel González' },
  practica_elemento: [REACTIVO, MATERIAL, EQUIPO],
} as unknown as DetallePractica

function montar(extra = {}) {
  const props = {
    detalle: DETALLE as DetallePractica | undefined,
    cargando: false,
    error: null as unknown,
    onCerrar: vi.fn(),
    ...extra,
  }
  render(<PanelPractica {...props} />)
  return props
}

describe('PanelPractica', () => {
  test('el folio nombra el panel: es lo que identifica una práctica', () => {
    montar()

    expect(screen.getByRole('dialog', { name: /PRA-0001/ })).toBeInTheDocument()
  })

  test('muestra la cabecera académica y quién la registró', () => {
    montar()

    expect(screen.getByText('Bioquímica')).toBeInTheDocument()
    expect(screen.getByText(/Actividad enzimática/)).toBeInTheDocument()
    expect(screen.getByText('Laboratorio de docencia N3')).toBeInTheDocument()
    expect(screen.getByText('Daniel González')).toBeInTheDocument()
  })

  // Cada método guarda campos distintos, y mostrar los de otro método sería
  // mostrar nulos. Es la misma regla que ya aplica el panel de captura.
  test('de un reactivo muestra el consumo, no las cantidades', () => {
    montar()

    expect(screen.getByText(/Etanol 96%/)).toBeInTheDocument()
    expect(screen.getByText(/Consumió 6 ml/)).toBeInTheDocument()
  })

  test('de un material muestra lo entregado, devuelto y dañado', () => {
    montar()

    expect(screen.getByText(/Entregó 10/)).toBeInTheDocument()
    expect(screen.getByText(/devolvió 8/)).toBeInTheDocument()
    expect(screen.getByText(/dañó 1/)).toBeInTheDocument()
  })

  test('de un equipo muestra en qué estado salió y en cuál volvió', () => {
    montar()

    expect(screen.getByText(/Salió correcto/i)).toBeInTheDocument()
    expect(screen.getByText(/volvió presenta fallas/i)).toBeInTheDocument()
  })

  test('la observación de un producto se muestra', () => {
    montar()

    expect(screen.getByText(/Se derramó un poco/)).toBeInTheDocument()
  })

  test('cerrar avisa hacia arriba', async () => {
    const { onCerrar } = montar()

    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }))

    expect(onCerrar).toHaveBeenCalled()
  })

  test('un fallo se ve, en vez de un panel vacío', () => {
    montar({ detalle: undefined, error: { code: '42501', message: 'permission denied' } })

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar/i)
  })
})
