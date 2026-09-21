import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { BotonBalanza } from './BotonBalanza'
import type { TransporteBalanza } from './balanza'
import { crearBalanzaDoble } from './doble'
import { ProveedorBalanza } from './ProveedorBalanza'

function montar(transporte: TransporteBalanza, unidad: string | null, onPeso = vi.fn()) {
  render(
    <ProveedorBalanza crearTransporte={() => transporte}>
      <BotonBalanza unidad={unidad} onPeso={onPeso} />
    </ProveedorBalanza>,
  )
  return onPeso
}

describe('BotonBalanza', () => {
  test('sin soporte del navegador queda apagado', () => {
    montar(crearBalanzaDoble(false).transporte, 'g')

    expect(screen.getByRole('button', { name: /leer balanza/i })).toBeDisabled()
  })

  // El primer clic es el gesto que el navegador exige para pedir el puerto: el
  // botón conecta solo y en la misma pulsación toma el peso.
  test('conecta solo y escribe el peso', async () => {
    const balanza = crearBalanzaDoble()
    balanza.mantener('   483.96 g S\r\n')
    const onPeso = montar(balanza.transporte, 'g')

    await userEvent.click(screen.getByRole('button', { name: /leer balanza/i }))

    await waitFor(() => expect(onPeso).toHaveBeenCalledWith(483.96))
  })

  test('sin unidad no coteja y escribe igual', async () => {
    const balanza = crearBalanzaDoble()
    balanza.mantener('   483.96 g S\r\n')
    const onPeso = montar(balanza.transporte, null)

    await userEvent.click(screen.getByRole('button', { name: /leer balanza/i }))

    await waitFor(() => expect(onPeso).toHaveBeenCalledWith(483.96))
  })

  // Pasar gramos a mililitros necesita la densidad; un número convertido a ojo
  // es peor que ninguno.
  test('si la unidad no coincide, avisa y no escribe', async () => {
    const balanza = crearBalanzaDoble()
    balanza.mantener('   483.96 g S\r\n')
    const onPeso = montar(balanza.transporte, 'ml')

    await userEvent.click(screen.getByRole('button', { name: /leer balanza/i }))

    expect(await screen.findByText(/no se convierte solo/i)).toBeInTheDocument()
    expect(onPeso).not.toHaveBeenCalled()
  })
})
