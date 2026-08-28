import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { PanelPendiente } from './PanelPendiente'
import type { Pendiente } from './pendientes'
import type { Fila } from './TablaExistencias'

function pendiente(cambios: Partial<Pendiente> = {}): Pendiente {
  return {
    id: 1,
    almacen_id: 1,
    carga_id: 3,
    archivo: 'Inventario final.xlsx',
    hoja: 'Insumos',
    fila: 70,
    motivo: 'regla',
    renglon: {
      articulo: 'Papel filtro Whatman No. 3',
      especificacion: '125 mm',
      marca: 'Sin marca',
      unidad: 'paquete',
      cantidad: 1,
      sub_ubicacion: 'N3',
      mueble: 'Gabinete 309',
    },
    problemas: [
      {
        regla: 'Regla 2 · la cantidad va en la unidad más pequeña que se consume',
        columna: 'G',
        valor: 'paquete',
        detalle: '«paquete» es un empaque, no una unidad de consumo',
      },
    ],
    existencia_id: null,
    existencia_resuelta_id: null,
    estado: 'pendiente',
    nota: null,
    revisado_por: null,
    revisado_en: null,
    creado_en: '2026-08-26T10:00:00Z',
    ...cambios,
  }
}

function existencia(cambios: Partial<Fila> = {}): Fila {
  return {
    id: 15,
    codigo: 'N3-00015',
    marca: 'SIGMA',
    cantidad: 96.27,
    estado: 'disponible',
    almacen_id: 1,
    ubicacion_id: 7,
    fecha_caducidad: null,
    creado_en: '2026-08-01T10:00:00Z',
    articulo_id: 5,
    nombre_canonico: 'Ergosterol, sólido, pureza 95%',
    descripcion: null,
    clasificacion: 'reactivo',
    unidad_base: 'g',
    almacen_clave: 'N3',
    ubicacion: 'N3 · Gaveta 4',
    nombre_norm: 'ergosterol, solido, pureza 95%',
    marca_norm: 'sigma',
    ...cambios,
  }
}

function pintar(props: Partial<Parameters<typeof PanelPendiente>[0]> = {}) {
  const onResolver = vi.fn()
  const onGuardar = vi.fn()
  const resultado = render(
    <PanelPendiente
      pendiente={pendiente()}
      almacenPropio={1}
      choque={undefined}
      resuelta={undefined}
      trabajando={false}
      error={null}
      onResolver={onResolver}
      onGuardar={onGuardar}
      onCerrar={vi.fn()}
      {...props}
    />,
  )
  return { onResolver, onGuardar, ...resultado }
}

describe('PanelPendiente', () => {
  test('se nombra por hoja y fila, que es como se localiza en el archivo', () => {
    pintar()
    expect(screen.getByRole('dialog', { name: 'Insumos · fila 70' })).toBeInTheDocument()
    expect(screen.getByText('Inventario final.xlsx')).toBeInTheDocument()
  })

  test('la cabecera dice qué es y cuánta hay, con su unidad', () => {
    pintar()
    expect(screen.getByText('Papel filtro Whatman No. 3 · 1 paquete')).toBeInTheDocument()
  })

  test('enseña la regla rota con su columna y el valor que traía', () => {
    pintar()
    expect(
      screen.getByText('Regla 2 · la cantidad va en la unidad más pequeña que se consume'),
    ).toBeInTheDocument()
    expect(screen.getByText('Columna G · dice «paquete»')).toBeInTheDocument()
  })

  test('pinta un control por campo del renglón, con el título de su columna', () => {
    pintar()
    expect(screen.getByLabelText('Unidad')).toHaveValue('paquete')
    expect(screen.getByLabelText('Cantidad')).toHaveValue('1')
    expect(screen.getByLabelText('Mueble')).toHaveValue('Gabinete 309')
  })

  test('manda el renglón corregido, con la cantidad de vuelta como número', async () => {
    const { onResolver } = pintar()

    await userEvent.clear(screen.getByLabelText('Unidad'))
    await userEvent.type(screen.getByLabelText('Unidad'), 'pieza')
    await userEvent.clear(screen.getByLabelText('Cantidad'))
    await userEvent.type(screen.getByLabelText('Cantidad'), '100')
    await userEvent.click(screen.getByRole('button', { name: /Cargar al inventario/ }))

    // «Sin marca» viaja tal cual y NO se convierte aquí en null: el renglón es
    // lo que decía el Excel más lo que corrigió la persona, y traducir las
    // formas de decir «no tiene» es trabajo de la base, que tiene la lista del
    // contrato. Reescribirlo aquí sería cambiarle a alguien lo que escribió.
    expect(onResolver).toHaveBeenCalledWith({
      veredicto: 'nueva',
      nota: null,
      renglon: expect.objectContaining({ unidad: 'pieza', cantidad: 100, marca: 'Sin marca' }),
    })
  })

  test('un número mal escrito no llega a la base: lo para el formulario', async () => {
    const { onResolver } = pintar()

    await userEvent.clear(screen.getByLabelText('Cantidad'))
    await userEvent.type(screen.getByLabelText('Cantidad'), 'como veinte')
    await userEvent.click(screen.getByRole('button', { name: /Cargar al inventario/ }))

    expect(onResolver).not.toHaveBeenCalled()
    expect(await screen.findByText('Tiene que ser un número')).toBeInTheDocument()
  })

  test('descartar no carga nada: cierra el renglón por el otro camino', async () => {
    const { onGuardar, onResolver } = pintar()
    await userEvent.click(screen.getByRole('button', { name: /Descartar/ }))

    expect(onResolver).not.toHaveBeenCalled()
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'descartado' }))
  })

  test('un posible duplicado se pinta al lado de la existencia con la que choca', () => {
    pintar({
      pendiente: pendiente({
        motivo: 'posible_duplicado',
        existencia_id: 15,
        renglon: { sustancia: 'Ergosterol, sólido, pureza 95%', unidad: 'g', cantidad: 98.97 },
      }),
      choque: existencia(),
    })

    expect(screen.getByText('Lo que dice el Excel')).toBeInTheDocument()
    expect(screen.getByText('La existencia con la que choca')).toBeInTheDocument()
    expect(screen.getByText('98.97 g')).toBeInTheDocument()
    expect(screen.getByText('96.27 g')).toBeInTheDocument()
    expect(screen.getByText('N3-00015')).toBeInTheDocument()
  })

  test('el botón de sumar nombra la existencia a la que le va a sumar', async () => {
    const { onResolver } = pintar({
      pendiente: pendiente({ motivo: 'posible_duplicado', existencia_id: 15 }),
      choque: existencia(),
    })

    await userEvent.click(screen.getByRole('button', { name: /Es la misma: suma a N3-00015/ }))
    expect(onResolver).toHaveBeenCalledWith(expect.objectContaining({ veredicto: 'duplicado' }))
  })

  test('sin existencia con la que chocar no se ofrece sumar a ninguna', () => {
    pintar()
    expect(screen.queryByRole('button', { name: /Es la misma/ })).not.toBeInTheDocument()
  })

  test('un renglón de otro almacén se consulta, no se revisa', () => {
    pintar({ pendiente: pendiente({ almacen_id: 2 }), almacenPropio: 1 })

    expect(
      screen.getByText('Este renglón es de otro almacén. Puedes consultarlo, no revisarlo.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cargar al inventario/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Unidad')).toBeDisabled()
  })

  test('un renglón ya cargado dice en qué existencia se convirtió', () => {
    pintar({
      pendiente: pendiente({ estado: 'resuelto', existencia_resuelta_id: 15 }),
      resuelta: existencia(),
    })
    expect(screen.getByText('Ya está en el inventario como N3-00015.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cargar al inventario/ })).not.toBeInTheDocument()
  })

  test('la ficha NOM del reactivo va plegada: son trece campos entre medias', () => {
    pintar({
      pendiente: pendiente({
        hoja: 'Reactivos',
        renglon: {
          sustancia: 'Acetona, líquido',
          unidad: 'mL',
          cantidad: 500,
          color: 'Rojo',
          riesgo_salud: 'Grado 2: Riesgo moderado',
        },
      }),
    })
    expect(screen.getByText('Ficha NOM del reactivo (2 campos)')).toBeInTheDocument()
  })

  test('un fallo al guardar se explica, no deja la pantalla muda', () => {
    pintar({ error: new Error('El pendiente 2 es de otro almacen') })
    expect(
      screen.getByText('No se pudo guardar: El pendiente 2 es de otro almacen'),
    ).toBeInTheDocument()
  })
})
