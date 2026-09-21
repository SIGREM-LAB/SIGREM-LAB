import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'

import type { TransporteBalanza } from './balanza'
import { crearBalanzaDoble } from './doble'
import { useBalanza } from './contextoBalanza'
import { ProveedorBalanza } from './ProveedorBalanza'

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
      <p>{`error:${balanza.error ?? '—'}`}</p>
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
    const { transporte } = crearBalanzaDoble()

    montar(transporte)

    expect(screen.getByText('estado:desconectada')).toBeInTheDocument()
    expect(screen.getByText('lectura:—')).toBeInTheDocument()
  })

  test('conectar deja el estado en conectada y publica la ultima trama', async () => {
    const { transporte, emitir } = crearBalanzaDoble()

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    emitir('     0.00 g  \r\n')
    emitir('   483.96 g S\r\n')

    expect(screen.getByText('estado:conectada')).toBeInTheDocument()
    expect(await screen.findByText('lectura:483.96 g')).toBeInTheDocument()
  })

  test('capturar devuelve la lectura estable', async () => {
    const { transporte, emitir } = crearBalanzaDoble()

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    await userEvent.click(screen.getByRole('button', { name: 'capturar' }))
    emitir('   483.96 g S\r\n')

    expect(await screen.findByText('capturado:483.96')).toBeInTheDocument()
  })

  // La de verdad importante. La balanza marca 483.96, alguien quita el frasco y
  // la balanza deja de mandar —modo por comando, cable flojo, apagada—. Si
  // `capturar` entrega lo ultimo que recuerda, el operador ve aparecer un
  // numero creible que no es el de ahora, y ese numero se escribe en el
  // inventario.
  test('capturar no devuelve la lectura vieja: espera una posterior a la peticion', async () => {
    const { transporte, emitir } = crearBalanzaDoble()

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    emitir('   483.96 g S\r\n')
    await screen.findByText('lectura:483.96 g')

    await userEvent.click(screen.getByRole('button', { name: 'capturar' }))
    // Todavia nada: la unica lectura que hay es de antes de pedirla.
    expect(screen.getByText('capturado:—')).toBeInTheDocument()

    emitir('   500.00 g S\r\n')

    expect(await screen.findByText('capturado:500')).toBeInTheDocument()
  })

  test('una trama nueva pero inestable tampoco vale', async () => {
    const { transporte, emitir } = crearBalanzaDoble()

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    await userEvent.click(screen.getByRole('button', { name: 'capturar' }))
    emitir('   483.96 g  \r\n')
    await screen.findByText('lectura:483.96 g')

    expect(screen.getByText('capturado:—')).toBeInTheDocument()

    emitir('   483.96 g S\r\n')
    expect(await screen.findByText('capturado:483.96')).toBeInTheDocument()
  })

  // Sin esto la pantalla se queda diciendo «conectada» con el ultimo peso
  // congelado en el chip, y no hay forma de notar que la balanza ya no esta.
  test('si el puerto se muere solo, lo dice en vez de quedarse en conectada', async () => {
    const { transporte, emitir, morir, vecesCerrado } = crearBalanzaDoble()

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    emitir('   483.96 g S\r\n')
    await screen.findByText('lectura:483.96 g')

    morir()

    expect(await screen.findByText('estado:error')).toBeInTheDocument()
    expect(screen.getByText('lectura:—')).toBeInTheDocument()
    expect(screen.getByText(/^error:Se perdió la conexión/)).toBeInTheDocument()
    // Y el puerto se suelta, para que reconectar no lo encuentre ocupado.
    expect(vecesCerrado()).toBeGreaterThanOrEqual(1)
  })

  test('desconectar suelta el puerto y limpia la lectura', async () => {
    const { transporte, emitir, vecesCerrado } = crearBalanzaDoble()

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    emitir('   483.96 g S\r\n')
    await screen.findByText('lectura:483.96 g')
    await userEvent.click(screen.getByRole('button', { name: 'desconectar' }))

    expect(screen.getByText('estado:desconectada')).toBeInTheDocument()
    expect(screen.getByText('lectura:—')).toBeInTheDocument()
    expect(vecesCerrado()).toBeGreaterThanOrEqual(1)
  })

  // Desconectar a mano NO es un fallo: el aviso de «se perdio la conexion» solo
  // vale cuando nadie lo pidio.
  test('desconectar a mano no deja un error en pantalla', async () => {
    const { transporte, emitir } = crearBalanzaDoble()

    montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    emitir('   483.96 g S\r\n')
    await screen.findByText('lectura:483.96 g')
    await userEvent.click(screen.getByRole('button', { name: 'desconectar' }))

    expect(screen.getByText('error:—')).toBeInTheDocument()
    expect(screen.getByText('estado:desconectada')).toBeInTheDocument()
  })

  // Sin esto, el puerto queda abierto al salir de la pantalla y la siguiente
  // conexion lo encuentra ocupado.
  test('al desmontar suelta el puerto', async () => {
    const { transporte, emitir, vecesCerrado } = crearBalanzaDoble()

    const { unmount } = montar(transporte)
    await userEvent.click(screen.getByRole('button', { name: 'conectar' }))
    emitir('   483.96 g S\r\n')
    await screen.findByText('lectura:483.96 g')
    unmount()

    expect(vecesCerrado()).toBeGreaterThanOrEqual(1)
  })
})
