import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import type { Motivo } from './consultas'
import { elementoDesdeExistencia, type ElementoCaptura } from './esquemas'
import { PanelControl } from './PanelControl'

const MOTIVOS: Motivo[] = [
  { clave: 'no_tenemos', etiqueta: 'No tenemos', metodos: ['peso', 'cantidad'] },
  { clave: 'material_daniado', etiqueta: 'Material dañado', metodos: ['cantidad'] },
  { clave: 'equipo_daniado', etiqueta: 'Equipo dañado', metodos: ['prestamo'] },
  { clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] },
]

function crear(
  metodo: 'peso' | 'cantidad' | 'prestamo',
  clasificacion: 'reactivo' | 'material' | 'equipo',
  campos: Partial<ElementoCaptura> = {},
): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      id: 1,
      codigo: 'N3-00042',
      nombre_canonico: 'Etanol 96%',
      clasificacion,
      unidad_base: 'ml',
      almacen_clave: 'N3',
      cantidad: 2000,
      ubicacion: 'Lab 2',
      metodo_control: metodo,
    }),
    ...campos,
  }
}

function montar(elemento: ElementoCaptura | null, onCambiar = vi.fn()) {
  render(<PanelControl elemento={elemento} motivos={MOTIVOS} onCambiar={onCambiar} />)
  return onCambiar
}

/**
 * Un anfitrión con estado para las pruebas que teclean.
 *
 * `PanelControl` es controlado: sin alguien que aplique el cambio y vuelva a
 * renderizar, el `<input>` se queda con el valor viejo y teclear "526" deja
 * sólo el último dígito. Es lo que hace la pantalla de verdad, así que la
 * prueba lo hace también en vez de conformarse con un dígito.
 */
function AnfitrionConEstado({
  inicial,
  onCambiar,
}: {
  inicial: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}) {
  const [elemento, setElemento] = useState(inicial)

  return (
    <PanelControl
      elemento={elemento}
      motivos={MOTIVOS}
      onCambiar={(parcial) => {
        onCambiar(parcial)
        setElemento((actual) => ({ ...actual, ...parcial }))
      }}
    />
  )
}

function montarConEstado(elemento: ElementoCaptura, onCambiar = vi.fn()) {
  render(<AnfitrionConEstado inicial={elemento} onCambiar={onCambiar} />)
  return onCambiar
}

describe('PanelControl — vacío', () => {
  test('sin producto elegido invita a elegir uno', () => {
    montar(null)

    expect(screen.getByText('Seleccione un producto')).toBeInTheDocument()
    expect(screen.getByText(/haga clic en una fila/i)).toBeInTheDocument()
  })
})

describe('PanelControl — elige el sub-panel por el método', () => {
  test('peso', () => {
    montar(crear('peso', 'reactivo'))

    expect(screen.getByText('Control por Peso')).toBeInTheDocument()
    expect(screen.getByLabelText(/peso inicial/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/cantidad entregada/i)).not.toBeInTheDocument()
  })

  test('cantidad', () => {
    montar(crear('cantidad', 'material'))

    expect(screen.getByText('Control por Cantidad')).toBeInTheDocument()
    expect(screen.getByLabelText(/cantidad entregada/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/peso inicial/i)).not.toBeInTheDocument()
  })

  test('préstamo', () => {
    montar(crear('prestamo', 'equipo'))

    expect(screen.getByText('Control por Préstamo')).toBeInTheDocument()
    expect(screen.getByLabelText(/estado de salida/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/peso inicial/i)).not.toBeInTheDocument()
  })
})

describe('PanelControl — peso', () => {
  test('el consumo se calcula en vivo', () => {
    montar(crear('peso', 'reactivo', { pesoInicial: 526, pesoFinal: 520 }))

    expect(screen.getByText('6 ml')).toBeInTheDocument()
  })

  test('teclear el peso inicial avisa hacia arriba como número', async () => {
    const onCambiar = montarConEstado(crear('peso', 'reactivo'))

    await userEvent.type(screen.getByLabelText(/peso inicial/i), '526')

    expect(onCambiar).toHaveBeenLastCalledWith({ pesoInicial: 526 })
  })

  test('borrar el campo lo deja nulo, no en cero', async () => {
    const onCambiar = montarConEstado(crear('peso', 'reactivo', { pesoInicial: 5 }))

    await userEvent.clear(screen.getByLabelText(/peso inicial/i))

    expect(onCambiar).toHaveBeenLastCalledWith({ pesoInicial: null })
  })

  // Web Serial pide Chromium, HTTPS y saber el protocolo del aparato. Apagado,
  // como Escanear QR.
  test('Leer balanza está apagado', () => {
    montar(crear('peso', 'reactivo'))

    for (const boton of screen.getAllByRole('button', { name: /leer balanza/i })) {
      expect(boton).toBeDisabled()
    }
  })
})

describe('PanelControl — cantidad', () => {
  test('las pérdidas se calculan en vivo', () => {
    montar(
      crear('cantidad', 'material', {
        cantidadEntregada: 10,
        cantidadDevuelta: 7,
        cantidadDanada: 2,
      }),
    )

    expect(screen.getByText('1 ml')).toBeInTheDocument()
  })
})

describe('PanelControl — el error del producto se ve donde se captura', () => {
  test('un peso final mayor que el inicial lo dice ahí mismo', () => {
    montar(crear('peso', 'reactivo', { pesoInicial: 520, pesoFinal: 526 }))

    expect(
      screen.getByText('El peso final no puede ser mayor que el inicial'),
    ).toBeInTheDocument()
  })

  test('un producto correcto muestra que está completo', () => {
    montar(crear('peso', 'reactivo', { pesoInicial: 526, pesoFinal: 520 }))

    expect(screen.getByText('Producto completado')).toBeInTheDocument()
  })
})
