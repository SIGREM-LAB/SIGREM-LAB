import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'

import type { TransporteBalanza } from './balanza'
import { useBalanza } from './contextoBalanza'
import { ProveedorBalanza } from './ProveedorBalanza'

/**
 * Un puerto serie de mentira: emite las tramas que se le den y luego se queda
 * vivo hasta que lo abortan. Es la misma forma que `TransporteBalanza`, asi que
 * el proveedor no distingue este doble de la Web Serial real.
 */
function crearTransporte(tramas: string[], soportado = true) {
  let cerrado = 0

  const transporte: TransporteBalanza = {
    soportado,
    async conectar() {},
    async desconectar() {
      cerrado += 1
    },
    async *tramas(senal) {
      for (const trama of tramas) {
        if (senal.aborted) return
        yield trama
      }
      await new Promise<void>((listo) => {
        if (senal.aborted) {
          listo()
          return
        }
        senal.addEventListener('abort', () => listo(), { once: true })
      })
    },
  }

  return { transporte, vecesCerrado: () => cerrado }
}

function Mirilla() {
  const balanza = useBalanza()
  const [capturado, setCapturado] = useState('—')

  const textoLectura =
    balanza.lectura === null ? '—' : `${balanza.lectura.valor} ${balanza.lectura.unidad}`

  return (
    <>
      <p>{`estado:${balanza.estado}`}</p>
      <p>{`lectura:${textoLectura}`}</p>
      <p>{`capturado:${capturado}`}</p>
      <button onClick={() => void balanza.conectar()}>conectar</button>
      <button onClick={() => void balanza.desconectar()}>desconectar</button>
      <button
        onClick={() =>
          void balanza.capturar().then((l) => setCapturado(l === null ? 'nada' : String(l.valor)))
        }
      >
        capturar
      </button>
    </>
  )
}

function montar(transporte: TransporteBalanza) {
  return render(
    <ProveedorBalanza crearTransporte={() => transporte}>
      <Mirilla />
    </ProveedorBalanza>,
  )
}

describe('ProveedorBalanza', () => {
  test('arranca desconectada y sin lectura', () => {
    const { transporte } = crearTransporte([])

    montar(transporte)

    expect(screen.getByText('estado:desconectada')).toBeInTheDocument()
    expect(screen.getByText('lectura:—')).toBeInTheDocument()
  })

  test('conectar deja el estado en conectada y publica la ultima trama', async () => {
    const { transporte } = crearTransporte(['     0.00 g  \r\n', '   483.96 g S\r\n'])

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))

    expect(screen.getByText('estado:conectada')).toBeInTheDocument()
    expect(await screen.findByText('lectura:483.96 g')).toBeInTheDocument()
  })

  test('capturar devuelve la ultima lectura estable', async () => {
    const { transporte } = crearTransporte(['   483.96 g S\r\n'])

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    await screen.findByText('lectura:483.96 g')
    await userEvent.click(screen.getByRole('button', { name: 'capturar' }))

    expect(await screen.findByText('capturado:483.96')).toBeInTheDocument()
  })

  test('desconectar suelta el puerto y limpia la lectura', async () => {
    const { transporte, vecesCerrado } = crearTransporte(['   483.96 g S\r\n'])

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    await screen.findByText('lectura:483.96 g')
    await userEvent.click(screen.getByRole('button', { name: 'desconectar' }))

    expect(screen.getByText('estado:desconectada')).toBeInTheDocument()
    expect(screen.getByText('lectura:—')).toBeInTheDocument()
    expect(vecesCerrado()).toBeGreaterThanOrEqual(1)
  })

  // Sin esto, el puerto queda abierto al salir de la pantalla y la siguiente
  // conexion lo encuentra ocupado.
  test('al desmontar suelta el puerto', async () => {
    const { transporte, vecesCerrado } = crearTransporte(['   483.96 g S\r\n'])

    const { unmount } = montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    await screen.findByText('lectura:483.96 g')
    unmount()

    expect(vecesCerrado()).toBeGreaterThanOrEqual(1)
  })
})
