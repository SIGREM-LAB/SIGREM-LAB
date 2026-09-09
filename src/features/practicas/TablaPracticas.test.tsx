import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { FilaHistorial } from './historial'
import { TablaPracticas } from './TablaPracticas'

const EN_CURSO: FilaHistorial = {
  clave: 'borrador',
  estado: 'en_curso',
  practicaId: null,
  folio: null,
  fecha: '2026-09-08',
  asignatura: 'Bioquímica',
  laboratorio: 'Laboratorio de docencia N3',
  productos: 2,
}

const FINALIZADA: FilaHistorial = {
  clave: 'practica-7',
  estado: 'finalizada',
  practicaId: 7,
  folio: 'PRA-0001',
  fecha: '2026-09-05',
  asignatura: 'Análisis Instrumental',
  laboratorio: 'Laboratorio de docencia N4',
  productos: 3,
}

function montar(extra = {}) {
  const props = {
    filas: [EN_CURSO, FINALIZADA],
    cargando: false,
    error: null as unknown,
    onVer: vi.fn(),
    onContinuar: vi.fn(),
    onDescartar: vi.fn(),
    ...extra,
  }
  render(<TablaPracticas {...props} />)
  return props
}

/** Los renglones del cuerpo, sin la fila de encabezados. */
function renglones() {
  return within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')
}

describe('TablaPracticas', () => {
  test('el renglón en curso se pinta antes que la finalizada', () => {
    montar()

    expect(renglones()[0]).toHaveTextContent(/en curso/i)
    expect(renglones()[1]).toHaveTextContent('PRA-0001')
  })

  // El folio lo asigna el trigger al finalizar. Mostrar uno inventado sería
  // mostrar un dato que no existe.
  test('el renglón en curso no finge un folio', () => {
    montar()

    expect(renglones()[0]).not.toHaveTextContent(/PRA-/)
  })

  test('cada renglón muestra asignatura, laboratorio y cuántos productos lleva', () => {
    montar()

    expect(renglones()[1]).toHaveTextContent('Análisis Instrumental')
    expect(renglones()[1]).toHaveTextContent('Laboratorio de docencia N4')
    expect(renglones()[1]).toHaveTextContent('3')
  })

  test('tocar una finalizada avisa con su id', async () => {
    const { onVer } = montar()

    await userEvent.click(screen.getByRole('button', { name: /ver práctica pra-0001/i }))

    expect(onVer).toHaveBeenCalledWith(7)
  })

  // Continuar y descartar son del borrador y de nadie más: una práctica
  // registrada no se retoma ni se borra desde aquí.
  test('solo el renglón en curso ofrece continuar y descartar', async () => {
    const { onContinuar } = montar()

    expect(within(renglones()[1]).queryByRole('button', { name: /continuar/i })).toBeNull()
    expect(within(renglones()[1]).queryByRole('button', { name: /descartar/i })).toBeNull()

    await userEvent.click(within(renglones()[0]).getByRole('button', { name: /continuar/i }))
    expect(onContinuar).toHaveBeenCalled()
  })

  test('sin prácticas lo dice, en vez de quedarse en blanco', () => {
    montar({ filas: [] })

    expect(screen.getByText(/todavía no hay prácticas/i)).toBeInTheDocument()
  })

  test('mientras carga no dice que no hay nada', () => {
    montar({ filas: [], cargando: true })

    expect(screen.queryByText(/todavía no hay prácticas/i)).not.toBeInTheDocument()
  })

  // Mismo modo de falla que se corrigió en el buscador: sin esto, una consulta
  // rota llega como cero filas y se anuncia como "todavía no hay prácticas",
  // que es una afirmación sobre el almacén y no sobre la consulta.
  test('un fallo de la consulta se ve, en vez de pasar por "no hay nada"', () => {
    montar({ filas: [], error: { code: '42501', message: 'permission denied' } })

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar/i)
    expect(screen.queryByText(/todavía no hay prácticas/i)).not.toBeInTheDocument()
  })
})
