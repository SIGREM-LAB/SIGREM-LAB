import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { DialogoMovimiento } from './DialogoMovimiento'
import type { Fila } from './TablaExistencias'

const FILA: Fila = {
  id: 42,
  codigo: 'N3-00042',
  marca: 'Merck',
  cantidad: 1500,
  estado: 'disponible',
  almacen_id: 3,
  ubicacion_id: 7,
  fecha_caducidad: null,
  creado_en: '2026-08-01T10:00:00Z',
  articulo_id: 5,
  nombre_canonico: 'Ácido sulfúrico, líquido, 98%',
  descripcion: null,
  clasificacion: 'reactivo',
  metodo_control: 'peso',
  unidad_base: 'mL',
  almacen_clave: 'N3',
  ubicacion: 'N3 · Anaquel 2',
  nombre_norm: 'acido sulfurico',
  marca_norm: 'merck',
}

const registrar = vi.fn()
const cambiar = vi.fn()

vi.mock('./consultas', () => ({
  useDetalleExistencia: () => ({
    data: { cantidad_minima: 150, laboratorio_id: 2 },
    isPending: false,
    error: null,
  }),
  useLaboratorios: () => ({
    data: [
      { id: 2, nombre: 'Análisis Sensorial' },
      { id: 3, nombre: 'Laboratorio de enseñanza 5' },
    ],
  }),
  useRegistrarMovimiento: () => ({
    mutate: registrar,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
  useCambiarLaboratorio: () => ({
    mutate: cambiar,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
}))

function pintar(props: Partial<Parameters<typeof DialogoMovimiento>[0]> = {}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCerrar = vi.fn()
  const onRegistrado = vi.fn()

  return {
    onCerrar,
    onRegistrado,
    ...render(
      <QueryClientProvider client={cliente}>
        <DialogoMovimiento
          fila={FILA}
          onCerrar={onCerrar}
          onRegistrado={onRegistrado}
          {...props}
        />
      </QueryClientProvider>,
    ),
  }
}

/** Elige un tipo en el selector de arriba. */
async function elegirTipo(usuario: ReturnType<typeof userEvent.setup>, etiqueta: string) {
  await usuario.click(screen.getByRole('combobox', { name: /Tipo de movimiento/ }))
  await usuario.click(await screen.findByRole('option', { name: etiqueta }))
}

beforeEach(() => {
  registrar.mockClear()
  cambiar.mockClear()
})

describe('DialogoMovimiento', () => {
  test('sin fila no hay diálogo', () => {
    pintar({ fila: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // La ficha de arriba es lo que evita registrar una merma de 40 litros en el
  // frasco equivocado por haber pulsado un renglón de más.
  test('enseña con qué frasco se está trabajando', () => {
    pintar()

    expect(screen.getByText('N3-00042')).toBeInTheDocument()
    expect(screen.getByText('Ácido sulfúrico, líquido, 98%')).toBeInTheDocument()
    expect(screen.getByText('1500 mL')).toBeInTheDocument()
    expect(screen.getByText('150 mL')).toBeInTheDocument()
    expect(screen.getByText('Análisis Sensorial')).toBeInTheDocument()
  })

  test('una entrada suma y no exige motivo', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.type(screen.getByLabelText(/Cantidad recibida/), '500')
    await usuario.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(registrar).toHaveBeenCalledTimes(1)
    expect(registrar.mock.calls[0][0]).toMatchObject({
      existenciaId: 42,
      tipo: 'entrada',
      cantidad: 500,
      motivo: null,
      // La de hoy no viaja: deja el `default now()` de la base.
      ocurridoEn: null,
    })
  })

  // La prueba de que los campos salen de la definición del tipo y no de un
  // formulario fijo: cambiar el tipo cambia lo que se pregunta.
  test('cada tipo pregunta lo suyo', async () => {
    const usuario = userEvent.setup()
    pintar()

    expect(screen.getByLabelText(/Cantidad recibida/)).toBeInTheDocument()

    await elegirTipo(usuario, 'Merma')
    expect(screen.getByLabelText(/Cantidad dañada/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Motivo/)).toBeInTheDocument()

    await elegirTipo(usuario, 'Ajuste de inventario')
    expect(screen.getByLabelText(/Existencia física encontrada/)).toBeInTheDocument()
  })

  test('la merma exige motivo antes de guardar', async () => {
    const usuario = userEvent.setup()
    pintar()

    await elegirTipo(usuario, 'Merma')
    await usuario.type(screen.getByLabelText(/Cantidad dañada/), '10')
    await usuario.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(await screen.findByText(/Motivo es obligatorio/)).toBeInTheDocument()
    expect(registrar).not.toHaveBeenCalled()
  })

  // `aplicar_movimiento` lo rechazaría, pero enterarse al pulsar Guardar, con
  // el error de Postgres, es peor que no poder teclearlo.
  test('no deja descontar más de lo que hay', async () => {
    const usuario = userEvent.setup()
    pintar()

    await elegirTipo(usuario, 'Salida por consumo interno')
    await usuario.type(screen.getByLabelText(/Cantidad/), '2000')
    await usuario.type(screen.getByLabelText(/Motivo/), 'Práctica')
    await usuario.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(await screen.findByText(/quedan 1500 mL/)).toBeInTheDocument()
    expect(registrar).not.toHaveBeenCalled()
  })

  test('el ajuste manda la diferencia, no lo contado', async () => {
    const usuario = userEvent.setup()
    pintar()

    await elegirTipo(usuario, 'Ajuste de inventario')
    await usuario.type(screen.getByLabelText(/Existencia física encontrada/), '1440')
    await usuario.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(registrar.mock.calls[0][0]).toMatchObject({ tipo: 'ajuste_conteo', cantidad: -60 })
  })

  test('caducado se guarda como merma y lo dice en pantalla', async () => {
    const usuario = userEvent.setup()
    pintar()

    await elegirTipo(usuario, 'Producto caducado')
    expect(screen.getByText(/Se registra como merma/i)).toBeInTheDocument()

    await usuario.type(screen.getByLabelText(/Cantidad caducada/), '200')
    await usuario.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(registrar.mock.calls[0][0]).toMatchObject({
      tipo: 'merma',
      cantidad: -200,
      motivo: 'Producto caducado',
    })
  })

  test('un equipo no puede caducar, así que no se ofrece', async () => {
    const usuario = userEvent.setup()
    pintar({ fila: { ...FILA, clasificacion: 'equipo' } })

    await usuario.click(screen.getByRole('combobox', { name: /Tipo de movimiento/ }))
    expect(screen.queryByRole('option', { name: 'Producto caducado' })).not.toBeInTheDocument()
  })

  // No pasa por la bitácora porque no mueve cantidad, y eso se dice donde se
  // decide, no en un comentario del código.
  test('el cambio de laboratorio avisa que no deja bitácora y va por otro camino', async () => {
    const usuario = userEvent.setup()
    pintar()

    await elegirTipo(usuario, 'Cambio de laboratorio')
    expect(screen.getByText(/no deja renglón en «Movimientos»/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('combobox', { name: /Laboratorio destino/ }))
    await usuario.click(await screen.findByRole('option', { name: 'Laboratorio de enseñanza 5' }))
    await usuario.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(registrar).not.toHaveBeenCalled()
    expect(cambiar).toHaveBeenCalledTimes(1)
    expect(cambiar.mock.calls[0][0]).toEqual({ existenciaId: 42, laboratorioId: 3 })
  })

  test('no deja mandarlo al laboratorio donde ya está', async () => {
    const usuario = userEvent.setup()
    pintar()

    await elegirTipo(usuario, 'Cambio de laboratorio')
    await usuario.click(screen.getByRole('combobox', { name: /Laboratorio destino/ }))
    await usuario.click(await screen.findByRole('option', { name: 'Análisis Sensorial' }))
    await usuario.click(screen.getByRole('button', { name: /Guardar movimiento/ }))

    expect(await screen.findByText(/donde ya está/)).toBeInTheDocument()
    expect(cambiar).not.toHaveBeenCalled()
  })
})
