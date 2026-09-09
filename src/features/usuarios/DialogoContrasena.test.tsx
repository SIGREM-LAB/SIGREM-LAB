import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Usuario } from './administracion'
import { DialogoContrasena } from './DialogoContrasena'

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    correo: 'ana@uaeh.edu.mx',
    estado: 'activo',
    nombre: 'Ana Pérez',
    rol: 'consulta',
    almacen_id: null,
    almacen: null,
    creado_en: '2026-08-18T00:00:00Z',
    ...cambios,
  }
}

function pintar(props: Partial<Parameters<typeof DialogoContrasena>[0]> = {}) {
  const onEstablecer = vi.fn()
  const onEnviarEnlace = vi.fn()
  const resultado = render(
    <DialogoContrasena
      usuario={usuario()}
      minutosEspera={0}
      guardando={false}
      enviando={false}
      errorDirecta={null}
      errorCorreo={null}
      onCerrar={vi.fn()}
      onEstablecer={onEstablecer}
      onEnviarEnlace={onEnviarEnlace}
      {...props}
    />,
  )
  return { onEstablecer, onEnviarEnlace, ...resultado }
}

describe('DialogoContrasena', () => {
  /**
   * El caso que motivó la pantalla: cambiar la contraseña sin pasar por el
   * correo. Por eso es la pestaña que abre.
   */
  test('abre en la vía directa y entrega la contraseña tecleada', async () => {
    const { onEstablecer } = pintar()

    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Sigrem2026!')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'Sigrem2026!')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(onEstablecer).toHaveBeenCalledWith('Sigrem2026!')
  })

  test('una contraseña débil no sale del navegador', async () => {
    const { onEstablecer } = pintar()

    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'sigrem')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'sigrem')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByText('Debe tener al menos 8 caracteres')).toBeInTheDocument()
    expect(onEstablecer).not.toHaveBeenCalled()
  })

  test('si las dos no coinciden, lo dice antes de mandar nada', async () => {
    const { onEstablecer } = pintar()

    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Sigrem2026!')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'Sigrem2026?')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(onEstablecer).not.toHaveBeenCalled()
  })

  test('la segunda pestaña manda el enlace por correo', async () => {
    const { onEnviarEnlace } = pintar()

    await userEvent.click(screen.getByRole('tab', { name: 'Enviar enlace' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(onEnviarEnlace).toHaveBeenCalled()
  })

  /** El freno de una hora: la cuota de correos del proyecto es de dos por hora. */
  test('con un envío reciente el botón de correo queda bloqueado', async () => {
    pintar({ minutosEspera: 42 })

    await userEvent.click(screen.getByRole('tab', { name: 'Enviar enlace' }))

    expect(screen.getByText(/Espera 42 min/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeDisabled()
  })

  test('sin correo registrado, la vía del correo no se ofrece', async () => {
    pintar({ usuario: usuario({ correo: null }) })

    await userEvent.click(screen.getByRole('tab', { name: 'Enviar enlace' }))

    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeDisabled()
    expect(screen.getByText(/no tiene correo registrado/)).toBeInTheDocument()
  })
})
