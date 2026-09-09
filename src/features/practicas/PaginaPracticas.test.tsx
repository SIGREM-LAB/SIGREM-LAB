import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { serializarBorrador } from './borrador'

const borrarBorrador = vi.fn()
const navegar = vi.fn()

let borradorGuardado: { contenido: unknown } | null = null

vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useNavigate: () => navegar }
})

// El doble reemplaza la capa de datos entera, igual que en el resto del módulo:
// lo que se prueba aquí son las reglas de la pantalla, no las consultas.
vi.mock('./consultas', async () => {
  const real = await vi.importActual<typeof import('./consultas')>('./consultas')
  return {
    ...real,
    useHistorialPracticas: () => ({
      data: {
        filas: [
          {
            clave: 'practica-7',
            estado: 'finalizada',
            practicaId: 7,
            folio: 'PRA-0001',
            fecha: '2026-09-05',
            asignatura: 'Bioquímica',
            laboratorio: 'Laboratorio de docencia N3',
            productos: 3,
          },
        ],
        total: 1,
      },
      isFetching: false,
      error: null,
    }),
    useBorrador: () => ({ data: borradorGuardado }),
    useDetallePractica: () => ({ data: undefined, isFetching: false, error: null }),
    useBorrarBorrador: () => ({ mutate: borrarBorrador, isPending: false }),
  }
})

const { PaginaPracticas } = await import('./PaginaPracticas')

const CABECERA = { programaId: 1, asignaturaId: 2, laboratorioId: 5, fecha: '2026-09-08' }
const NOMBRES = { asignatura: 'Química Analítica', laboratorio: 'Laboratorio de docencia N4' }

function montar() {
  render(
    <MemoryRouter>
      <PaginaPracticas />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  borradorGuardado = null
})

describe('PaginaPracticas', () => {
  test('lista lo registrado', () => {
    montar()

    expect(screen.getByText('PRA-0001')).toBeInTheDocument()
    expect(screen.getByText('Bioquímica')).toBeInTheDocument()
  })

  // El botón nombra lo que hay. Con un borrador vivo no se puede empezar otra
  // captura sin descartarlo, porque el borrador es uno por persona: ofrecer
  // "Registrar" ahí sería ofrecer pisarlo en silencio.
  test('sin borrador el botón invita a registrar', () => {
    montar()

    expect(screen.getByRole('button', { name: /registrar práctica/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^continuar/i })).toBeNull()
  })

  test('con borrador el botón invita a continuar', () => {
    borradorGuardado = { contenido: serializarBorrador(CABECERA, NOMBRES, []) }
    montar()

    expect(screen.getByRole('button', { name: /continuar práctica/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /registrar práctica/i })).toBeNull()
  })

  test('registrar lleva al formulario', async () => {
    montar()

    await userEvent.click(screen.getByRole('button', { name: /registrar práctica/i }))

    expect(navegar).toHaveBeenCalledWith('/practicas/nueva')
  })

  test('el borrador aparece como renglón en curso, con sus nombres', () => {
    borradorGuardado = { contenido: serializarBorrador(CABECERA, NOMBRES, []) }
    montar()

    expect(screen.getByText('Química Analítica')).toBeInTheDocument()
    // Exacto y no /en curso/i: la descripción de la pantalla también lleva esas
    // palabras, y lo que se afirma aquí es que el chip del estado está.
    expect(screen.getByText('En curso')).toBeInTheDocument()
  })

  // Descartar borra trabajo y no se puede deshacer: pedir confirmación es lo
  // que separa un clic mal dado de una captura perdida.
  test('descartar el borrador pide confirmación antes de borrar', async () => {
    borradorGuardado = { contenido: serializarBorrador(CABECERA, NOMBRES, []) }
    montar()

    await userEvent.click(screen.getByRole('button', { name: /descartar la práctica en curso/i }))
    expect(borrarBorrador).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^descartar$/i }))
    expect(borrarBorrador).toHaveBeenCalled()
  })

  test('cancelar la confirmación no borra nada', async () => {
    borradorGuardado = { contenido: serializarBorrador(CABECERA, NOMBRES, []) }
    montar()

    await userEvent.click(screen.getByRole('button', { name: /descartar la práctica en curso/i }))
    await userEvent.click(screen.getByRole('button', { name: /conservar/i }))

    expect(borrarBorrador).not.toHaveBeenCalled()
  })

  test('ver una práctica abre el panel de detalle', async () => {
    montar()

    await userEvent.click(screen.getByRole('button', { name: /ver práctica pra-0001/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // Un borrador que ya no se puede leer no pinta renglón —filaDeBorrador
  // devuelve null— así que sin este aviso desaparecería sin dejar rastro: el
  // botón diría "Registrar" y el trabajo viejo seguiría ahí, invisible.
  test('un borrador que ya no se entiende se avisa y se puede descartar', async () => {
    borradorGuardado = { contenido: { version: 1, cabecera: {}, elementos: [] } }
    montar()

    expect(screen.getByRole('alert')).toHaveTextContent(/versión anterior/i)

    await userEvent.click(screen.getByRole('button', { name: /descartarlo/i }))
    expect(borrarBorrador).toHaveBeenCalled()
  })

  test('sin borrador ilegible no hay aviso', () => {
    montar()

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
