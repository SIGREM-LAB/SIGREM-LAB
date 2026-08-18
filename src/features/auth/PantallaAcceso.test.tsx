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
})
