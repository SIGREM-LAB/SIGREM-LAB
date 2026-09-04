import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { PanelExistencia, type Movimiento } from './PanelExistencia'
import type { Fila } from './TablaExistencias'

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
  nombre_canonico: 'Acetona, líquido, pureza 99.5%, CAS: 67-64-1',
  descripcion: null,
  clasificacion: 'reactivo',
  metodo_control: 'peso',
  unidad_base: 'mL',
  almacen_clave: 'N3',
  ubicacion: 'N3 · Anaquel 2 · Repisa 3',
  nombre_norm: 'acetona, liquido, pureza 99.5%, cas: 67-64-1',
  marca_norm: 'sigma',
}

const MOVIMIENTOS: Movimiento[] = [
  {
    id: 10,
    tipo: 'consumo',
    cantidad: -45,
    cantidad_despues: 139.8,
    ocurrido_en: '2026-08-20T15:00:00Z',
    motivo: 'Práctica de titulación',
  },
]

function pintar(props: Partial<Parameters<typeof PanelExistencia>[0]> = {}) {
  const onCerrar = vi.fn()
  render(
    <PanelExistencia
      fila={FILA}
      almacenPropio={1}
      movimientos={MOVIMIENTOS}
      cargandoMovimientos={false}
      datosTipo={null}
      onCerrar={onCerrar}
      {...props}
    />,
  )
  return { onCerrar }
}

describe('PanelExistencia', () => {
  test('el panel se anuncia con el codigo de la existencia', () => {
    pintar()
    expect(screen.getByRole('dialog', { name: /N3-00001/ })).toBeInTheDocument()
  })

  test('muestra el codigo, que es lo que va impreso en la etiqueta', () => {
    pintar()
    expect(screen.getByText('N3-00001')).toBeInTheDocument()
  })

  test('el boton de cerrar tiene nombre accesible y funciona', async () => {
    const { onCerrar } = pintar()

    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }))

    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  test('lista los movimientos con su signo', () => {
    pintar()
    expect(screen.getByText('-45 mL')).toBeInTheDocument()
    expect(screen.getByText(/práctica de titulación/i)).toBeInTheDocument()
  })

  test('una entrada lleva su signo mas', () => {
    pintar({
      movimientos: [{ ...MOVIMIENTOS[0], id: 11, tipo: 'entrada', cantidad: 500, motivo: null }],
    })
    expect(screen.getByText('+500 mL')).toBeInTheDocument()
  })

  test('dice cuando no hay movimientos, en vez de dejar el hueco', () => {
    pintar({ movimientos: [] })
    expect(screen.getByText(/todavía no hay movimientos/i)).toBeInTheDocument()
  })

  // La senal de "esto no es tuyo". En una pantalla de solo lectura es lo unico
  // que distingue el almacen propio del ajeno.
  test('avisa cuando la existencia es de otro almacen', () => {
    pintar({ almacenPropio: 2 })
    expect(screen.getByText(/pertenece a N3/i)).toBeInTheDocument()
    expect(screen.getByText(/no modificarla/i)).toBeInTheDocument()
  })

  test('no avisa cuando la existencia es del almacen propio', () => {
    pintar({ almacenPropio: 1 })
    expect(screen.queryByText(/no modificarla/i)).not.toBeInTheDocument()
  })

  // Admin y consulta no tienen almacen propio: el aviso no aplica.
  test('sin almacen propio no avisa', () => {
    pintar({ almacenPropio: null })
    expect(screen.queryByText(/no modificarla/i)).not.toBeInTheDocument()
  })

  test('sin fila seleccionada no hay panel', () => {
    pintar({ fila: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
