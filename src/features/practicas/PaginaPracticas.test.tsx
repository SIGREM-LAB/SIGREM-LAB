import { render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const registrar = vi.fn()
const guardarBorrador = vi.fn()
const borrarBorrador = vi.fn()

// El doble reemplaza la capa de datos entera. Lo que se prueba aquí son las
// reglas de estado de la pantalla, no las consultas: ésas se ejercitan en el
// guion manual, contra la base de verdad y con usuarios de verdad.
vi.mock('./consultas', async () => {
  const real = await vi.importActual<typeof import('./consultas')>('./consultas')
  return {
    ...real,
    useProgramas: () => ({ data: [{ id: 1, nombre: 'Química en Alimentos' }] }),
    useSemestresDePrograma: () => ({ data: [3] }),
    useAsignaturasDeSemestre: () => ({ data: [{ id: 10, nombre: 'Bioquímica' }] }),
    usePracticasDeAsignatura: () => ({
      data: [{ id: 100, numero: 2, nombre: 'Actividad enzimática' }],
    }),
    useLaboratorios: () => ({
      data: [{ id: 5, nombre: 'Laboratorio de docencia N3', almacenClave: 'N3' }],
    }),
    useMotivos: () => ({
      data: [{ clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] }],
    }),
    useBuscarExistencias: () => ({
      data: [
        {
          id: 12,
          codigo: 'N3-00042',
          nombre_canonico: 'Etanol 96%',
          clasificacion: 'reactivo',
          unidad_base: 'ml',
          almacen_clave: 'N3',
          cantidad: 2000,
          ubicacion: 'Lab 2',
          metodo_control: 'peso',
        },
      ],
      isPending: false,
    }),
    useBorrador: () => ({ data: null, isPending: false }),
    useGuardarBorrador: () => ({ mutate: guardarBorrador, isPending: false }),
    useBorrarBorrador: () => ({ mutate: borrarBorrador, isPending: false }),
    useRegistrarPractica: () => ({ mutate: registrar, isPending: false }),
  }
})

const { PaginaPracticas } = await import('./PaginaPracticas')

function montar() {
  render(
    <MemoryRouter>
      <PaginaPracticas />
    </MemoryRouter>,
  )
}

/** Llena la cascada completa: es el prerrequisito de casi todo lo demás. */
async function llenarCabecera() {
  await userEvent.click(screen.getByLabelText('Programa educativo'))
  await userEvent.click(screen.getByRole('option', { name: 'Química en Alimentos' }))
  await userEvent.click(screen.getByLabelText('Semestre'))
  await userEvent.click(screen.getByRole('option', { name: '3°' }))
  await userEvent.click(screen.getByLabelText('Asignatura'))
  await userEvent.click(screen.getByRole('option', { name: 'Bioquímica' }))
  await userEvent.click(screen.getByLabelText('Número de práctica'))
  await userEvent.click(screen.getByRole('option', { name: /Práctica 2/ }))
  await userEvent.click(screen.getByLabelText('Laboratorio'))
  await userEvent.click(screen.getByRole('option', { name: /Laboratorio de docencia N3/ }))
}

async function agregarEtanol() {
  await userEvent.click(screen.getByRole('button', { name: /buscar producto/i }))
  await userEvent.click(screen.getByRole('button', { name: /agregar etanol 96%/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  // Hay que esperar a que el diálogo se desmonte. Mientras se va cerrando, MUI
  // deja el resto de la página con `aria-hidden`, y las consultas por rol -que
  // es como lo ve un lector de pantalla- no encuentran nada detrás.
  await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
}

beforeEach(() => {
  registrar.mockClear()
  guardarBorrador.mockClear()
  borrarBorrador.mockClear()
})

describe('PaginaPracticas', () => {
  test('arranca con el panel vacío y sin productos', () => {
    montar()

    expect(screen.getByText('Seleccione un producto')).toBeInTheDocument()
    expect(screen.getByText('Sin productos')).toBeInTheDocument()
  })

  // Sin laboratorio no hay almacén, y sin almacén no hay sobre qué buscar.
  test('no se pueden agregar productos antes de elegir laboratorio', () => {
    montar()

    expect(screen.getByRole('button', { name: /buscar producto/i })).toBeDisabled()
  })

  test('agregar un producto lo pone en la tabla y lo selecciona', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    expect(screen.getByRole('row', { name: /etanol 96%/i })).toBeInTheDocument()
    expect(screen.getByText('Control por Peso')).toBeInTheDocument()
  })

  test('quitar un producto lo saca de la tabla y vacía el panel', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()
    await userEvent.click(screen.getByRole('button', { name: /quitar etanol 96%/i }))

    expect(screen.getByText('Sin productos')).toBeInTheDocument()
    expect(screen.getByText('Seleccione un producto')).toBeInTheDocument()
  })

  test('finalizar está apagado sin productos', async () => {
    montar()
    await llenarCabecera()

    expect(screen.getByRole('button', { name: /finalizar práctica/i })).toBeDisabled()
  })

  // El mismo criterio que el chip de la tabla y que los checks de la base. Si
  // discreparan, alguien finalizaría creyendo que está completo.
  test('finalizar está apagado con un producto pendiente', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    expect(screen.getByRole('button', { name: /finalizar práctica/i })).toBeDisabled()
  })

  test('con todo capturado, finalizar manda el payload sin metodo_control', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    await userEvent.type(screen.getByLabelText(/peso inicial/i), '526')
    await userEvent.type(screen.getByLabelText(/peso final/i), '520')
    await userEvent.click(screen.getByRole('button', { name: /finalizar práctica/i }))

    expect(registrar).toHaveBeenCalledOnce()
    const [{ cabecera, elementos }] = registrar.mock.calls[0]

    expect(cabecera.laboratorioId).toBe(5)
    expect(cabecera.practicaCatalogoId).toBe(100)
    expect(elementos).toEqual([
      {
        existencia_id: 12,
        peso_inicial: 526,
        peso_final: 520,
        observaciones: null,
        motivos: [],
      },
    ])
  })

  test('guardar borrador manda la captura tal como va, a medias', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    await userEvent.click(screen.getByRole('button', { name: /guardar borrador/i }))

    expect(guardarBorrador).toHaveBeenCalledOnce()
    const [contenido] = guardarBorrador.mock.calls[0]

    expect(contenido.version).toBe(1)
    expect(contenido.elementos).toHaveLength(1)
    expect(contenido.elementos[0].pesoInicial).toBeNull()
  })

  test('guardar borrador está apagado si no hay nada que guardar', () => {
    montar()

    expect(screen.getByRole('button', { name: /guardar borrador/i })).toBeDisabled()
  })
})
