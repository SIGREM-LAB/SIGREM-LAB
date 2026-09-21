import { render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import type { TransporteBalanza } from './balanza'
import { BarraBalanza } from './BarraBalanza'
import { crearBalanzaDoble } from './doble'
import { ProveedorBalanza } from './ProveedorBalanza'

function montar(transporte: TransporteBalanza) {
  render(
    <ProveedorBalanza crearTransporte={() => transporte}>
      <BarraBalanza />
    </ProveedorBalanza>,
  )
}

async function conectar() {
  await userEvent.click(screen.getByRole('button', { name: /conectar balanza/i }))
}

describe('BarraBalanza', () => {
  test('sin soporte del navegador avisa y no ofrece conectar', () => {
    montar(crearBalanzaDoble(false).transporte)

    expect(screen.getByText(/no puede leer la balanza/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conectar balanza/i })).not.toBeInTheDocument()
  })

  test('conectada ensena la lectura en vivo', async () => {
    const balanza = crearBalanzaDoble()
    montar(balanza.transporte)
    await conectar()
    balanza.emitir('   483.96 g S\r\n')

    expect(await screen.findByText('483.96 g')).toBeInTheDocument()
    expect(screen.getByText('Peso estable')).toBeInTheDocument()
  })

  // No apareció ningún puerto: ni driver, ni cable, no se sabe. La guía no
  // diagnostica, ordena los pasos por probabilidad.
  test('si no aparece ningun puerto, abre la guia de preparacion', async () => {
    const balanza = crearBalanzaDoble()
    balanza.fallarAlConectar('sin-puerto')
    montar(balanza.transporte)

    await conectar()

    expect(await screen.findByText(/no aparece ninguna balanza/i)).toBeInTheDocument()
  })

  test('un puerto ocupado no abre la guia: eso no se arregla instalando nada', async () => {
    const balanza = crearBalanzaDoble()
    balanza.fallarAlConectar('ocupado')
    montar(balanza.transporte)

    await conectar()

    expect(await screen.findByText(/no abre/i)).toBeInTheDocument()
    expect(screen.queryByText(/no aparece ninguna balanza/i)).not.toBeInTheDocument()
  })

  // La guía se puede cerrar, pero la duda sigue ahí. Sin este botón habría que
  // volver a fallar para recuperarla.
  test('tras cerrar la guia queda un boton para recuperarla', async () => {
    const balanza = crearBalanzaDoble()
    balanza.fallarAlConectar('sin-puerto')
    montar(balanza.transporte)
    await conectar()
    await screen.findByText(/no aparece ninguna balanza/i)

    // `waitForElementToBeRemoved` y no `queryBy` a secas: el dialogo de MUI se
    // desmonta al acabar el fundido de salida, no en el clic.
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitForElementToBeRemoved(() => screen.queryByText(/no aparece ninguna balanza/i))

    await userEvent.click(screen.getByRole('button', { name: /qué hago/i }))
    expect(screen.getByText(/no aparece ninguna balanza/i)).toBeInTheDocument()
  })

  test('reintentar desde la guia conecta y la cierra', async () => {
    const balanza = crearBalanzaDoble()
    balanza.fallarAlConectar('sin-puerto')
    montar(balanza.transporte)
    await conectar()
    await screen.findByText(/no aparece ninguna balanza/i)

    // Como si le hubieran hecho caso: instalar, desenchufar y volver a enchufar.
    balanza.fallarAlConectar(null)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('button', { name: 'Desconectar' })).toBeInTheDocument()
    expect(screen.queryByText(/no aparece ninguna balanza/i)).not.toBeInTheDocument()
  })
})
