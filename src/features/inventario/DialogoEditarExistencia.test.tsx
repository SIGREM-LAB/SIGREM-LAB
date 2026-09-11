import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Campo } from './campos'
import { DialogoEditarExistencia } from './DialogoEditarExistencia'
import type { Fila } from './TablaExistencias'

/**
 * El perfil de reactivo recortado a lo que hace falta. Los `destino` son los de
 * verdad: de ellos sale qué se edita y qué solo se enseña.
 */
const REACTIVO: Campo[] = [
  {
    campo: 'nombre_articulo',
    etiqueta: 'Artículo',
    tipo_dato: 'texto',
    destino: 'articulo.nombre_canonico',
    opciones: null,
    ayuda: null,
    obligatorio: true,
    orden: 1,
  },
  {
    campo: 'cas',
    etiqueta: 'Número CAS',
    tipo_dato: 'texto',
    destino: 'articulo_reactivo.cas',
    opciones: null,
    ayuda: null,
    obligatorio: false,
    orden: 2,
  },
  {
    campo: 'marca',
    etiqueta: 'Marca',
    tipo_dato: 'texto',
    destino: 'existencia.marca',
    opciones: null,
    ayuda: null,
    obligatorio: false,
    orden: 3,
  },
  {
    campo: 'cantidad',
    etiqueta: 'Cantidad en existencia',
    tipo_dato: 'numero',
    destino: 'movimiento.carga_inicial',
    opciones: null,
    ayuda: null,
    obligatorio: true,
    orden: 4,
  },
  {
    campo: 'mueble',
    etiqueta: 'Mueble',
    tipo_dato: 'texto',
    destino: 'ubicacion.componentes.mueble',
    opciones: null,
    ayuda: null,
    obligatorio: false,
    orden: 5,
  },
]

const FILA: Fila = {
  id: 42,
  codigo: 'N3-00042',
  marca: 'SIGMA',
  cantidad: 139.8,
  estado: 'disponible',
  almacen_id: 3,
  ubicacion_id: 7,
  fecha_caducidad: null,
  creado_en: '2026-08-01T10:00:00Z',
  articulo_id: 5,
  nombre_canonico: 'Acetona, líquido, pureza 99.5%',
  descripcion: null,
  clasificacion: 'reactivo',
  metodo_control: 'peso',
  unidad_base: 'mL',
  almacen_clave: 'N3',
  ubicacion: 'N3 · Anaquel 2',
  nombre_norm: 'acetona',
  marca_norm: 'sigma',
}

const mutar = vi.fn()
let campos: Campo[] = []
let actuales: Record<string, unknown> = {}

vi.mock('./consultas', () => ({
  useFormulario: () => ({
    data: campos,
    isPending: false,
    isFetching: false,
    error: null,
  }),
  useValoresExistencia: () => ({
    data: actuales,
    isPending: false,
    isFetching: false,
    error: null,
  }),
  useLaboratorios: () => ({ data: [] }),
  useActualizarExistencia: () => ({
    mutate: mutar,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
}))

function pintar(props: Partial<Parameters<typeof DialogoEditarExistencia>[0]> = {}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCerrar = vi.fn()
  const onGuardada = vi.fn()

  return {
    onCerrar,
    onGuardada,
    ...render(
      <QueryClientProvider client={cliente}>
        <DialogoEditarExistencia
          fila={FILA}
          onCerrar={onCerrar}
          onGuardada={onGuardada}
          {...props}
        />
      </QueryClientProvider>,
    ),
  }
}

beforeEach(() => {
  mutar.mockClear()
  campos = REACTIVO
  actuales = {
    nombre_articulo: 'Acetona, líquido, pureza 99.5%',
    cas: '67-64-1',
    marca: 'SIGMA',
    cantidad: 139.8,
    mueble: 'Anaquel 2',
  }
})

describe('DialogoEditarExistencia', () => {
  test('sin fila no hay diálogo', () => {
    pintar({ fila: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('arranca con lo que la existencia tiene hoy, no en blanco', () => {
    pintar()
    expect(screen.getByLabelText(/Marca/)).toHaveValue('SIGMA')
    expect(screen.getByLabelText(/Mueble/)).toHaveValue('Anaquel 2')
  })

  // Los campos salen de la base, igual que en el alta: no hay lista propia ni
  // condicionales por clasificación.
  test('pinta los campos que devolvió la base', () => {
    pintar()
    expect(screen.getByLabelText(/Artículo/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mueble/)).toBeInTheDocument()
  })

  // El artículo lo comparten todos los frascos de la misma sustancia. Se ven
  // —son la ficha de seguridad del reactivo— pero no se tocan.
  test('los campos del artículo se enseñan bloqueados, con la razón', () => {
    pintar()

    expect(screen.getByLabelText(/Artículo/)).toBeDisabled()
    expect(screen.getByLabelText(/Número CAS/)).toBeDisabled()
    expect(screen.getByLabelText(/Marca/)).toBeEnabled()
    expect(screen.getAllByText(/se comparte con las demás existencias/i).length).toBeGreaterThan(0)
  })

  test('manda solo los campos del frasco, y los vacíos también', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.clear(screen.getByLabelText(/Marca/))
    await usuario.click(screen.getByRole('button', { name: /Guardar cambios/ }))

    expect(mutar).toHaveBeenCalledTimes(1)
    expect(mutar.mock.calls[0][0]).toMatchObject({
      existenciaId: 42,
      // Vacía y presente: es como se borra la marca. Si se omitiera, la base
      // la dejaría como estaba y el formulario estaría mintiendo.
      valores: { marca: '', cantidad: '139.8', mueble: 'Anaquel 2' },
      motivo: null,
    })
    // Lo del artículo no viaja aunque esté pintado en la pantalla.
    expect(mutar.mock.calls[0][0].valores).not.toHaveProperty('nombre_articulo')
    expect(mutar.mock.calls[0][0].valores).not.toHaveProperty('cas')
  })

  // El saldo se mueve con un movimiento, y un renglón de bitácora que dice
  // «-31.8 mL» sin decir por qué obliga a preguntarle a quien lo hizo.
  test('cambiar la cantidad anuncia el ajuste y exige el motivo', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.clear(screen.getByLabelText(/Cantidad/))
    await usuario.type(screen.getByLabelText(/Cantidad/), '108')

    expect(await screen.findByLabelText(/Motivo del ajuste/)).toBeInTheDocument()
    expect(screen.getByText(/ajuste de conteo/i)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /Guardar y registrar el ajuste/ }))

    expect(await screen.findByText(/es lo que queda en la/i)).toBeInTheDocument()
    expect(mutar).not.toHaveBeenCalled()
  })

  test('con el motivo capturado, el ajuste se manda', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.clear(screen.getByLabelText(/Cantidad/))
    await usuario.type(screen.getByLabelText(/Cantidad/), '108')
    await usuario.type(await screen.findByLabelText(/Motivo del ajuste/), 'Conteo de septiembre')
    await usuario.click(screen.getByRole('button', { name: /Guardar y registrar el ajuste/ }))

    expect(mutar).toHaveBeenCalledTimes(1)
    expect(mutar.mock.calls[0][0]).toMatchObject({
      valores: { cantidad: '108' },
      motivo: 'Conteo de septiembre',
    })
  })

  // Corregir un anaquel no es un conteo: pedir el motivo ahí sería un peaje.
  test('sin tocar la cantidad no se pide motivo', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.clear(screen.getByLabelText(/Mueble/))
    await usuario.type(screen.getByLabelText(/Mueble/), 'Anaquel 7')

    expect(screen.queryByLabelText(/Motivo del ajuste/)).not.toBeInTheDocument()
  })

  test('el código de la existencia se ve: es lo que va en la etiqueta', () => {
    pintar()
    expect(screen.getByText('N3-00042')).toBeInTheDocument()
  })
})
