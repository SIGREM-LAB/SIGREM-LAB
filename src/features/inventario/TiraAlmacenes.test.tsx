import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { TiraAlmacenes } from './TiraAlmacenes'
import type { ResumenAlmacen } from './menu'

function almacen(cambios: Partial<ResumenAlmacen> = {}): ResumenAlmacen {
  return {
    id: 1,
    clave: 'N3',
    nombre: 'Laboratorio N3',
    total: 412,
    disponible: 380,
    stockBajo: 12,
    agotado: 6,
    contaminado: 2,
    mantenimiento: 0,
    ...cambios,
  }
}

const ALMACENES = [
  almacen(),
  almacen({ id: 2, clave: 'N4', nombre: 'Laboratorio N4', stockBajo: 0, agotado: 0 }),
]

function pintar(props: Partial<Parameters<typeof TiraAlmacenes>[0]> = {}) {
  const onSeleccionar = vi.fn()
  render(
    <TiraAlmacenes
      almacenes={ALMACENES}
      seleccionado="todos"
      almacenPropio={null}
      onSeleccionar={onSeleccionar}
      {...props}
    />,
  )
  return { onSeleccionar }
}

describe('TiraAlmacenes', () => {
  test('pulsar un almacen lo pone como filtro', async () => {
    const { onSeleccionar } = pintar()

    await userEvent.click(screen.getByRole('button', { name: /^N4/ }))

    expect(onSeleccionar).toHaveBeenCalledWith(2)
  })

  // Sin esto, para volver a ver los cuatro habria que bajar al selector: la
  // tira dejaria de ser reversible por donde se uso.
  test('pulsar el que ya esta puesto vuelve a los cuatro', async () => {
    const { onSeleccionar } = pintar({ seleccionado: 2 })

    await userEvent.click(screen.getByRole('button', { name: /^N4/ }))

    expect(onSeleccionar).toHaveBeenCalledWith('todos')
  })

  // Son botones de alternancia, no enlaces: no llevan a ningun sitio, encienden
  // y apagan un filtro. `aria-pressed` es lo que hace que un lector de pantalla
  // diga cual esta puesto; sin el, la marca vive solo en el color del borde.
  test('el almacen puesto se anuncia como pulsado', () => {
    pintar({ seleccionado: 2 })

    expect(screen.getByRole('button', { name: /^N4/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^N3/ })).toHaveAttribute('aria-pressed', 'false')
  })

  test('el nombre accesible lleva las cifras, no solo la clave', () => {
    pintar()

    expect(
      screen.getByRole('button', { name: /N3.*412 existencias.*18 por atender/ }),
    ).toBeInTheDocument()
  })

  // Con palabra y no solo con un borde de color, por lo mismo que el estado de
  // la tabla no se fia del color.
  test('rotula con palabras el almacen de quien mira', () => {
    pintar({ almacenPropio: 1 })
    expect(screen.getByText('Tuyo')).toBeInTheDocument()
  })

  test('sin almacen propio no rotula ninguno', () => {
    pintar({ almacenPropio: null })
    expect(screen.queryByText('Tuyo')).not.toBeInTheDocument()
  })

  // El aviso solo sale donde hay trabajo: si saliera siempre, dejaria de leerse.
  test('el aviso de atencion solo aparece donde hay algo que atender', () => {
    pintar()
    expect(screen.getAllByText(/por atender/)).toHaveLength(1)
  })

  test('mientras carga no ofrece botones a medio pintar', () => {
    pintar({ cargando: true })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
