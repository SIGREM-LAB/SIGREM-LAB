import { describe, expect, test } from 'vitest'

import { CLASIFICACIONES, filtrosIniciales, hayFiltrosActivos, ORDENES } from './filtros'

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
})
