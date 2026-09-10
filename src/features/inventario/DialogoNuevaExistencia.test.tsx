import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Campo } from './campos'
import { DialogoNuevaExistencia } from './DialogoNuevaExistencia'

/**
 * El perfil de reactivo, recortado a lo que hace falta para probar el diálogo.
 * Los `destino` son los de verdad: de ellos sale el agrupado en recuadros.
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
    campo: 'cantidad',
    etiqueta: 'Cantidad en existencia',
    tipo_dato: 'numero',
    destino: 'movimiento.carga_inicial',
    opciones: null,
    ayuda: null,
    obligatorio: true,
    orden: 2,
  },
  {
    campo: 'unidad',
    etiqueta: 'Unidad de medida',
    tipo_dato: 'texto',
    destino: 'articulo.unidad_base',
    opciones: null,
    ayuda: null,
    obligatorio: true,
    orden: 3,
  },
  {
    campo: 'estado_fisico',
    etiqueta: 'Estado físico',
    tipo_dato: 'seleccion',
    destino: 'articulo_reactivo.estado_fisico',
    opciones: ['solido', 'liquido', 'gas'],
    ayuda: null,
    obligatorio: true,
    orden: 4,
  },
  {
    campo: 'densidad',
    etiqueta: 'Densidad (g/mL)',
    tipo_dato: 'numero',
    destino: 'articulo_reactivo.densidad',
    opciones: null,
    ayuda: null,
    obligatorio: false,
    orden: 5,
  },
  {
    campo: 'mueble',
    etiqueta: 'Mueble',
    tipo_dato: 'texto',
    destino: 'ubicacion.componentes.mueble',
    opciones: null,
    ayuda: null,
    obligatorio: false,
    orden: 6,
  },
]

const EQUIPO: Campo[] = [
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
    campo: 'numero_serie',
    etiqueta: 'Número de serie',
    tipo_dato: 'texto',
    destino: 'existencia.numero_serie',
    opciones: null,
    ayuda: null,
    obligatorio: false,
    orden: 2,
  },
]

const mutar = vi.fn()
let perfiles: Record<string, Campo[]> = {}

vi.mock('./consultas', () => ({
  useFormulario: (_almacen: number, clasificacion: string | null) => ({
    data: clasificacion === null ? undefined : (perfiles[clasificacion] ?? []),
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  useLaboratorios: () => ({ data: [] }),
  useBuscarArticulo: () => ({ data: [] }),
  useCrearExistencia: () => ({
    mutate: mutar,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
}))

function pintar(props: Partial<Parameters<typeof DialogoNuevaExistencia>[0]> = {}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCerrar = vi.fn()
  const onCreada = vi.fn()

  return {
    onCerrar,
    onCreada,
    ...render(
      <QueryClientProvider client={cliente}>
        <DialogoNuevaExistencia
          abierto
          almacen={{ id: 3, clave: 'N3', nombre: 'Almacén Nivel 3' }}
          onCerrar={onCerrar}
          onCreada={onCreada}
          {...props}
        />
      </QueryClientProvider>,
    ),
  }
}

beforeEach(() => {
  mutar.mockClear()
  perfiles = { reactivo: REACTIVO, equipo: EQUIPO }
})

describe('DialogoNuevaExistencia', () => {
  test('pinta los campos que devolvió la base, no una lista propia', () => {
    pintar()

    expect(screen.getByLabelText(/Artículo/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Densidad/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mueble/)).toBeInTheDocument()
  })

  // La prueba de que no hay condicionales por clasificación: el mismo componente
  // pinta otro formulario porque la base le dio otra lista.
  test('cambiar de tipo cambia los campos', async () => {
    const usuario = userEvent.setup()
    pintar()

    expect(screen.queryByLabelText(/Número de serie/)).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('combobox', { name: /Tipo de producto/ }))
    await usuario.click(screen.getByRole('option', { name: 'Equipo / Maquinaria' }))

    expect(await screen.findByLabelText(/Número de serie/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Densidad/)).not.toBeInTheDocument()
  })

  test('el almacén no se elige: se enseña el del perfil', () => {
    pintar()

    expect(screen.getByText('N3 · Almacén Nivel 3')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Almacén/ })).not.toBeInTheDocument()
  })

  // El código lo asigna el trigger `existencia_asigna_codigo`. Un campo editable
  // aquí invitaría a teclear uno que la base va a ignorar.
  test('el código no se captura: lo pone la base', () => {
    pintar()
    expect(screen.getByLabelText('Código')).toBeDisabled()
  })

  test('un obligatorio vacío frena el envío y dice cuál falta', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.click(screen.getByRole('button', { name: /Guardar existencia/ }))

    expect(await screen.findByText('Artículo es obligatorio')).toBeInTheDocument()
    expect(mutar).not.toHaveBeenCalled()
  })

  test('manda solo los campos del perfil, con el almacén y el tipo', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.type(screen.getByLabelText(/Artículo/), 'Acetona')
    await usuario.type(screen.getByLabelText(/Cantidad/), '4')
    await usuario.type(screen.getByLabelText(/Unidad/), 'L')
    await usuario.click(screen.getByRole('combobox', { name: /Estado físico/ }))
    await usuario.click(screen.getByRole('option', { name: 'Líquido' }))

    await usuario.click(screen.getByRole('button', { name: /Guardar existencia/ }))

    await waitFor(() => expect(mutar).toHaveBeenCalled())

    const [envio] = mutar.mock.calls[0]
    expect(envio.almacenId).toBe(3)
    expect(envio.clasificacion).toBe('reactivo')
    expect(envio.valores).toEqual({
      nombre_articulo: 'Acetona',
      cantidad: '4',
      unidad: 'L',
      estado_fisico: 'liquido',
    })
  })

  // Sin perfil no hay formulario. Un diálogo vacío con su botón de guardar
  // invita a mandar una existencia sin un solo dato.
  test('sin perfil de captura lo dice, en vez de enseñar un formulario vacío', () => {
    perfiles = {}
    pintar()

    expect(screen.getByText(/no tiene un perfil de captura/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar existencia/ })).not.toBeInTheDocument()
  })
})
