import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { BotonExportar } from './BotonExportar'

const usePerfil = vi.hoisted(() => vi.fn())
vi.mock('@/features/auth/usePerfil', () => ({ usePerfil }))

function conRol(rol: 'admin' | 'responsable' | 'consulta') {
  usePerfil.mockReturnValue({
    isPending: false,
    isError: false,
    error: null,
    data: { rol, nombre: 'Quien sea' },
  })
}

describe('BotonExportar', () => {
  beforeEach(() => {
    usePerfil.mockReset()
  })

  test('un usuario de consulta no lo ve', () => {
    conRol('consulta')

    const { container } = render(<BotonExportar almacenId={1} almacenClave="UCL-N3" />)

    // Ensenarselo seria ofrecerle un error: puede_reportar() le responde con
    // excepcion en cuanto pulse.
    expect(container).toBeEmptyDOMElement()
  })

  test('responsable y admin lo ven activo con un almacén', () => {
    for (const rol of ['responsable', 'admin'] as const) {
      conRol(rol)
      const { unmount } = render(<BotonExportar almacenId={1} almacenClave="UCL-N3" />)

      expect(screen.getByRole('button', { name: /exportar/i }), rol).toBeEnabled()
      unmount()
    }
  })

  // El formato unificado es UN LIBRO POR ALMACEN: uno solo no puede representar
  // los siete, y un archivo asi el ETL no podria releerlo.
  test('sin almacén concreto se apaga en vez de exportar una mezcla', () => {
    conRol('admin')

    render(<BotonExportar almacenId={null} almacenClave={null} />)

    expect(screen.getByRole('button', { name: /exportar/i })).toBeDisabled()
  })
})
