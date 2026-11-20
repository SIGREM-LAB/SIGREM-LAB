import { describe, expect, test } from 'vitest'

import {
  CLASIFICACIONES,
  conAlmacen,
  filtrosIniciales,
  hayFiltrosActivos,
  mueblesDe,
  ORDENES,
} from './filtros'

describe('filtrosIniciales', () => {
  // Ya no mira el rol. Que almacen se ve lo decide la pantalla: Inventario
  // sobrescribe esto con la bodega del perfil, e Inventario general arranca
  // justo aqui. Mientras dependia del rol, la pantalla tenia que reajustarse
  // sola cuando el perfil aterrizaba.
  test('arranca en todos los almacenes', () => {
    expect(filtrosIniciales().almacenId).toBe('todos')
  })

  test('las bajas se esconden por omision', () => {
    expect(filtrosIniciales().incluirBaja).toBe(false)
  })

  test('los agotados NO se esconden: son justo lo que hay que reponer', () => {
    expect(filtrosIniciales().estado).toBe('todos')
  })

  // El inventario en papel esta numerado por codigo, y ese sigue siendo el
  // orden de arranque: el alfabetico se pide, no se impone.
  test('arranca ordenado por codigo', () => {
    expect(filtrosIniciales().orden).toBe('codigo')
  })
})

describe('ORDENES', () => {
  test('ofrece el codigo y las dos direcciones del nombre', () => {
    expect(ORDENES.map((o) => o.valor)).toEqual(['codigo', 'nombre_asc', 'nombre_desc'])
  })

  test('ninguna etiqueta se repite', () => {
    const etiquetas = ORDENES.map((o) => o.etiqueta)
    expect(new Set(etiquetas).size).toBe(etiquetas.length)
  })
})

describe('CLASIFICACIONES', () => {
  // El prototipo lista cinco y se le olvida `componente`, que es la
  // clasificacion de 15 articulos de LE: con cinco opciones son inalcanzables.
  test('son las seis del enum, con componente incluido', () => {
    expect(CLASIFICACIONES.map((c) => c.valor).sort()).toEqual([
      'componente',
      'equipo',
      'insumo',
      'materia_biologica',
      'material',
      'reactivo',
    ])
  })

  test('ninguna etiqueta se repite', () => {
    const etiquetas = CLASIFICACIONES.map((c) => c.etiqueta)
    expect(new Set(etiquetas).size).toBe(etiquetas.length)
  })
})

describe('hayFiltrosActivos', () => {
  // El arranque de Inventario, tal como lo arma la pantalla: los valores
  // neutros con el almacen anclado encima.
  const iniciales = { ...filtrosIniciales(), almacenId: 3 }

  // Estar anclado a una bodega NO es tener un filtro puesto: es el punto de
  // partida. Si contara, el boton de limpiar aparecería nada mas entrar y
  // "limpiar" no cambiaria nada.
  test('el arranque de la pantalla no cuenta como filtro', () => {
    expect(hayFiltrosActivos(iniciales, iniciales)).toBe(false)
  })

  test('detecta un termino tecleado', () => {
    expect(hayFiltrosActivos({ ...iniciales, termino: 'acetona' }, iniciales)).toBe(true)
  })

  test('detecta un cambio de almacen', () => {
    expect(hayFiltrosActivos({ ...iniciales, almacenId: 'todos' }, iniciales)).toBe(true)
  })

  test('detecta la casilla de bajas', () => {
    expect(hayFiltrosActivos({ ...iniciales, incluirBaja: true }, iniciales)).toBe(true)
  })

  // El orden tambien se limpia: si no contara, "Limpiar filtros" devolveria los
  // filtros al arranque pero dejaria la tabla ordenada por nombre.
  test('detecta el orden alfabetico', () => {
    expect(hayFiltrosActivos({ ...iniciales, orden: 'nombre_asc' }, iniciales)).toBe(true)
  })

  test('detecta un mueble elegido', () => {
    expect(hayFiltrosActivos({ ...iniciales, mueble: 'Anaquel 4' }, iniciales)).toBe(true)
  })
})

describe('conAlmacen', () => {
  test('cambia el almacen y suelta mueble y repisa', () => {
    const antes = { ...filtrosIniciales(), almacenId: 1, mueble: 'Anaquel 4', repisa: '2' }
    expect(conAlmacen(antes, 2)).toEqual({ ...antes, almacenId: 2, mueble: '', repisa: '' })
  })

  test('conserva el resto de los filtros', () => {
    const antes = { ...filtrosIniciales(), termino: 'acetona', almacenId: 1 }
    expect(conAlmacen(antes, 'todos').termino).toBe('acetona')
  })
})

describe('mueblesDe', () => {
  test('agrupa las repisas por mueble, sin repetir', () => {
    expect(
      mueblesDe([
        { mueble: 'Anaquel 4', repisa: '2', fila_cajon: '1' },
        { mueble: 'Anaquel 4', repisa: '2', fila_cajon: '3' },
        { mueble: 'Anaquel 4', repisa: '1' },
      ]),
    ).toEqual([{ nombre: 'Anaquel 4', repisas: ['1', '2'] }])
  })

  // Asi se recorre el almacen: "Anaquel 2" antes que "Anaquel 10".
  test('ordena muebles y repisas como numeros', () => {
    const muebles = mueblesDe([
      { mueble: 'Anaquel 10', repisa: '10' },
      { mueble: 'Anaquel 10', repisa: '9' },
      { mueble: 'Anaquel 2', repisa: '1' },
    ])
    expect(muebles.map((m) => m.nombre)).toEqual(['Anaquel 2', 'Anaquel 10'])
    expect(muebles[1].repisas).toEqual(['9', '10'])
  })

  test('un mueble sin repisas aparece con la lista vacia', () => {
    expect(mueblesDe([{ mueble: 'Refrigerador' }])).toEqual([
      { nombre: 'Refrigerador', repisas: [] },
    ])
  })

  // Una ubicacion con solo sub-ubicacion no tiene mueble que ofrecer; y el
  // jsonb puede traer cualquier cosa.
  test('ignora lo que no trae mueble', () => {
    expect(mueblesDe([{ sub_ubicacion: 'LUM-2' }, null, 'x', [], { mueble: '' }])).toEqual([])
  })

  // El filtro es un `contains` exacto. Unificar aqui "Anaquel 4" con
  // "anaquel 4" ofreceria una opcion que no casa con la mitad de los datos.
  test('no unifica variantes de escritura', () => {
    expect(mueblesDe([{ mueble: 'Anaquel 4' }, { mueble: 'anaquel 4' }])).toHaveLength(2)
  })
})
