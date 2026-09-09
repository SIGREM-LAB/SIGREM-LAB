import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Usuario } from './administracion'
import { TablaUsuarios } from './TablaUsuarios'

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    correo: 'ana@uaeh.edu.mx',
    estado: 'activo',
    nombre: 'Ana Pérez',
    rol: 'responsable',
    almacen_id: 1,
    almacen: {
      id: 1,
      clave: 'N3',
      nombre: 'Química',
      activo: true,
      creado_en: '2026-08-18T00:00:00Z',
      personas_expuestas: null,
      uso_principal: null,
      zona_riesgo: null,
    },
    creado_en: '2026-08-18T00:00:00Z',
    ...cambios,
  }
}

function pintar(props: Partial<Parameters<typeof TablaUsuarios>[0]> = {}) {
  const onEditar = vi.fn()
  const onContrasena = vi.fn()
  const resultado = render(
    <TablaUsuarios
      usuarios={[usuario()]}
      cargando={false}
      onEditar={onEditar}
      onContrasena={onContrasena}
      {...props}
    />,
  )
  return { onEditar, onContrasena, ...resultado }
}

describe('TablaUsuarios', () => {
  test('pinta el renglón con su rol, su almacén y su estado', () => {
    pintar()

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ana@uaeh.edu.mx')).toBeInTheDocument()
    expect(screen.getByText('Responsable')).toBeInTheDocument()
    expect(screen.getByText('N3')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  test('una cuenta sin almacén lo dice, no deja el hueco en blanco', () => {
    pintar({ usuarios: [usuario({ rol: 'consulta', almacen_id: null, almacen: null })] })

    expect(screen.getByText('Sin asignar')).toBeInTheDocument()
  })

  test('sin usuarios avisa, en vez de dejar una tabla vacía sin explicación', () => {
    pintar({ usuarios: [] })

    expect(screen.getByText('Todavía no hay usuarios registrados')).toBeInTheDocument()
  })

  test('mientras carga no anuncia que no hay usuarios', () => {
    pintar({ usuarios: [], cargando: true })

    expect(screen.queryByText('Todavía no hay usuarios registrados')).not.toBeInTheDocument()
  })

  /**
   * La contraseña se restablece desde el renglón: es la acción que más se pide
   * en esta pantalla y no puede depender de entrar primero a "Editar".
   */
  test('el renglón ofrece editar y restablecer contraseña', async () => {
    const { onEditar, onContrasena } = pintar()

    await userEvent.click(screen.getByRole('button', { name: 'Editar a Ana Pérez' }))
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer la contraseña de Ana Pérez' }))

    expect(onEditar).toHaveBeenCalledWith(usuario())
    expect(onContrasena).toHaveBeenCalledWith(usuario())
  })
})
