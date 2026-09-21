import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { TransporteBalanza } from '@/features/balanza/balanza'
import { crearBalanzaDoble } from '@/features/balanza/doble'
import { ProveedorBalanza } from '@/features/balanza/ProveedorBalanza'
import { CapturaPeso } from './CapturaPeso'
import { elementoDesdeExistencia, type ElementoCaptura } from './esquemas'

function elemento(parcial: Partial<ElementoCaptura> = {}): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      id: 1,
      codigo: 'N3-00042',
      nombre_canonico: 'Etanol 96%',
      clasificacion: 'reactivo',
      unidad_base: 'g',
      almacen_clave: 'N3',
      cantidad: 2000,
      ubicacion: 'Lab 2',
      metodo_control: 'peso',
    }),
    ...parcial,
  }
}

function montar(transporte: TransporteBalanza, el: ElementoCaptura, onCambiar = vi.fn()) {
  render(
    <ProveedorBalanza crearTransporte={() => transporte}>
      <CapturaPeso elemento={el} onCambiar={onCambiar} />
    </ProveedorBalanza>,
  )
  return onCambiar
}

async function conectar() {
  await userEvent.click(screen.getByRole('button', { name: /conectar balanza/i }))
  await screen.findByText('483.96 g')
}

describe('CapturaPeso — balanza', () => {
  test('sin soporte avisa y no ofrece conectar', () => {
    montar(crearBalanzaDoble(false).transporte, elemento())

    expect(screen.getByText(/no puede leer la balanza/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conectar balanza/i })).not.toBeInTheDocument()
  })

  test('conectada, leer balanza escribe el peso inicial', async () => {
    const balanza = crearBalanzaDoble()
    balanza.mantener('   483.96 g S\r\n')
    const onCambiar = montar(balanza.transporte, elemento())
    await conectar()

    await userEvent.click(screen.getAllByRole('button', { name: /leer balanza/i })[0])

    await waitFor(() => expect(onCambiar).toHaveBeenCalledWith({ pesoInicial: 483.96 }))
  })

  test('el segundo boton escribe el peso final', async () => {
    const balanza = crearBalanzaDoble()
    balanza.mantener('   483.96 g S\r\n')
    const onCambiar = montar(balanza.transporte, elemento())
    await conectar()

    await userEvent.click(screen.getAllByRole('button', { name: /leer balanza/i })[1])

    await waitFor(() => expect(onCambiar).toHaveBeenCalledWith({ pesoFinal: 483.96 }))
  })

  // La balanza manda su unidad; el producto se captura en la suya. Si no
  // coinciden no hay conversion, y escribir el numero crudo seria mentira.
  test('si la unidad no coincide, avisa y no escribe', async () => {
    const balanza = crearBalanzaDoble()
    balanza.mantener('   483.96 g S\r\n')
    const onCambiar = montar(balanza.transporte, elemento({ unidadBase: 'ml' }))
    await conectar()

    await userEvent.click(screen.getAllByRole('button', { name: /leer balanza/i })[0])

    expect(await screen.findByText(/no se convierte solo/i)).toBeInTheDocument()
    expect(onCambiar).not.toHaveBeenCalled()
  })
})
