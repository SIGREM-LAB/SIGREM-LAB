import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoPrepararBalanza, RUTA_INSTALADOR } from './DialogoPrepararBalanza'

function montar(onReintentar = vi.fn(async () => {}), onCerrar = vi.fn()) {
  render(
    <DialogoPrepararBalanza abierto onCerrar={onCerrar} onReintentar={onReintentar} />,
  )
  return { onReintentar, onCerrar }
}

describe('DialogoPrepararBalanza', () => {
  test('cerrado no pinta nada', () => {
    render(
      <DialogoPrepararBalanza abierto={false} onCerrar={vi.fn()} onReintentar={vi.fn(async () => {})} />,
    )

    expect(screen.queryByText(/no aparece ninguna balanza/i)).not.toBeInTheDocument()
  })

  // El archivo lo sirve la propia app desde `public/drivers/`. Si la ruta se
  // rompe, el boton grande del paso 2 lleva a un 404 y la guia no sirve de nada.
  test('el boton de descarga apunta al instalador que sirve la app', () => {
    montar()

    const boton = screen.getByRole('link', { name: /descargar el instalador/i })
    expect(boton).toHaveAttribute('href', RUTA_INSTALADOR)
    expect(boton).toHaveAttribute('download')
  })

  test('nombra los cuadros de dialogo que Windows va a ensenar', () => {
    montar()

    expect(screen.getByText(/conservar/i)).toBeInTheDocument()
    expect(screen.getByText(/haga cambios en el/i)).toBeInTheDocument()
  })

  // El paso que se olvida siempre: Windows no vuelve a mirar un aparato que ya
  // estaba conectado antes de instalar el driver.
  test('pide desenchufar y volver a enchufar', () => {
    montar()

    expect(screen.getByText(/desenchufa el adaptador y vuelve a enchufarlo/i)).toBeInTheDocument()
  })

  test('reintentar vuelve a conectar con el filtro puesto', async () => {
    const { onReintentar } = montar()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onReintentar).toHaveBeenCalledTimes(1)
    expect(onReintentar).toHaveBeenCalledWith(undefined)
  })

  // La salida para el almacen que acabe con un adaptador que no sea FTDI: el
  // filtro lo esconderia del selector y pareceria que no hay balanza.
  test('«mi adaptador no es FTDI» reintenta sin el filtro', async () => {
    const { onReintentar } = montar()

    await userEvent.click(screen.getByRole('button', { name: /no es FTDI/i }))

    expect(onReintentar).toHaveBeenCalledWith(true)
  })

  test('cerrar avisa a quien lo abrio', async () => {
    const { onCerrar } = montar()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onCerrar).toHaveBeenCalled()
  })
})
