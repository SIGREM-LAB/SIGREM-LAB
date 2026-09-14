import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { serializarBorrador } from './borrador'

const borrarBorrador = vi.fn()
const navegar = vi.fn()

let borradoresGuardados: { id: number; contenido: unknown }[] = []

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
    useBorradores: () => ({ data: borradoresGuardados }),
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
  borradoresGuardados = []
})

describe('PaginaPracticas', () => {
  test('lista lo registrado', () => {
    montar()

    expect(screen.getByText('PRA-0001')).toBeInTheDocument()
    expect(screen.getByText('Bioquímica')).toBeInTheDocument()
  })

  // Con varias capturas a la vez, empezar otra ya no pisa ninguna: el botón
  // siempre invita a registrar, y continuar una existente es cosa de su renglón.
  test('el botón siempre invita a registrar, aunque haya capturas en curso', () => {
    borradoresGuardados = [{ id: 1, contenido: serializarBorrador(CABECERA, NOMBRES, []) }]
    montar()

    expect(screen.getByRole('button', { name: /registrar práctica/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^continuar práctica/i })).toBeNull()
  })

  test('registrar lleva al formulario', async () => {
    montar()

    await userEvent.click(screen.getByRole('button', { name: /registrar práctica/i }))

    expect(navegar).toHaveBeenCalledWith('/practicas/nueva')
  })

  test('el borrador aparece como renglón en curso, con sus nombres', () => {
    borradoresGuardados = [{ id: 1, contenido: serializarBorrador(CABECERA, NOMBRES, []) }]
    montar()

    expect(screen.getByText('Química Analítica')).toBeInTheDocument()
    // Exacto y no /en curso/i: la descripción de la pantalla también lleva esas
    // palabras, y lo que se afirma aquí es que el chip del estado está.
    expect(screen.getByText('En curso')).toBeInTheDocument()
  })

  // Descartar borra trabajo y no se puede deshacer: pedir confirmación es lo
  // que separa un clic mal dado de una captura perdida.
  test('descartar el borrador pide confirmación antes de borrar', async () => {
    borradoresGuardados = [{ id: 1, contenido: serializarBorrador(CABECERA, NOMBRES, []) }]
    montar()

    await userEvent.click(screen.getByRole('button', { name: /descartar la práctica en curso/i }))
    expect(borrarBorrador).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^descartar$/i }))
    expect(borrarBorrador).toHaveBeenCalledWith([1])
  })

  test('cancelar la confirmación no borra nada', async () => {
    borradoresGuardados = [{ id: 1, contenido: serializarBorrador(CABECERA, NOMBRES, []) }]
    montar()

    await userEvent.click(screen.getByRole('button', { name: /descartar la práctica en curso/i }))
    await userEvent.click(screen.getByRole('button', { name: /conservar/i }))

    expect(borrarBorrador).not.toHaveBeenCalled()
  })

  // Dos capturas vivas: cada renglón trae sus propias acciones y su propio id.
  test('con dos capturas se puede continuar la que se elija', async () => {
    borradoresGuardados = [
      { id: 1, contenido: serializarBorrador(CABECERA, NOMBRES, []) },
      { id: 2, contenido: serializarBorrador(CABECERA, NOMBRES, []) },
    ]
    montar()

    const botones = screen.getAllByRole('button', { name: /continuar la práctica en curso/i })
    expect(botones).toHaveLength(2)

    await userEvent.click(botones[1])
    expect(navegar).toHaveBeenCalledWith('/practicas/nueva/2')
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
    borradoresGuardados = [{ id: 9, contenido: { version: 1, cabecera: {}, elementos: [] } }]
    montar()

    expect(screen.getByRole('alert')).toHaveTextContent(/versión anterior/i)

    // Descartar también pide confirmación: borra trabajo que no se recupera.
    await userEvent.click(screen.getByRole('button', { name: /descartarlo/i }))
    await userEvent.click(screen.getByRole('button', { name: /^descartar$/i }))
    expect(borrarBorrador).toHaveBeenCalledWith([9])
  })

  test('sin borrador ilegible no hay aviso', () => {
    montar()

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
