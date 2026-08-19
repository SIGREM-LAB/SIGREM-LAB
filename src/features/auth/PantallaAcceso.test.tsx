import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { PantallaAcceso, type AuthAcceso } from './PantallaAcceso'

function authQue(resultado: { error: { message: string } | null }): AuthAcceso {
  return { signInWithPassword: async () => resultado }
}

describe('PantallaAcceso', () => {
  test('pide el correo cuando se envia vacio', async () => {
    const user = userEvent.setup()
    render(<PantallaAcceso auth={authQue({ error: null })} />)

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/escribe tu correo/i)).toBeInTheDocument()
  })

  // Supabase contesta 'Invalid login credentials' en ingles. Mostrarlo tal cual
  // -o no mostrar nada- deja al responsable sin saber que hacer.
  test('traduce el rechazo de Supabase a un mensaje entendible', async () => {
    const user = userEvent.setup()
    render(<PantallaAcceso auth={authQue({ error: { message: 'Invalid login credentials' } })} />)

    await user.type(screen.getByLabelText(/correo/i), 'n3@uaeh.local')

    // Anclado con ^...$ a proposito. El boton de mostrar/ocultar tambien se
    // llama "Mostrar contraseña", asi que /contrase/i encuentra dos elementos y
    // Testing Library se niega a adivinar cual. La etiqueta del boton esta
    // bien: es lo que lee un lector de pantalla. El que estaba flojo era esto.
    await user.type(screen.getByLabelText(/^contraseña$/i), 'equivocada')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/correo o la contrase/i)).toBeInTheDocument()
  })

  // El logo ya trae impreso "Universidad Autonoma del Estado de Hidalgo".
  // Repetirlo como texto al lado obliga a leerlo dos veces y no agrega nada.
  test('no repite como texto el nombre que el logo ya dice', () => {
    render(<PantallaAcceso auth={authQue({ error: null })} />)

    expect(screen.queryByText(/Universidad Autónoma del Estado de Hidalgo ·/)).toBeNull()
    expect(screen.getByText(/Sistema Integral de Gestión de Reactivos/)).toBeInTheDocument()
  })

  // El login es una pantalla completa donde alguien se puede quedar un rato, y
  // la unica que se ve sin haber entrado: el control tiene que estar aqui
  // tambien, no solo dentro de la app.
  test('ofrece el control de tema', () => {
    render(<PantallaAcceso auth={authQue({ error: null })} />)

    expect(screen.getByRole('button', { name: /^Tema:/ })).toBeInTheDocument()
  })
})
