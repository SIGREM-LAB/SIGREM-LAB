import { describe, expect, test } from 'vitest'

import { CLASIFICACIONES, filtrosIniciales } from './filtros'

describe('filtrosIniciales', () => {
  test('un responsable arranca en su propio almacen', () => {
    expect(filtrosIniciales({ rol: 'responsable', almacenId: 3 }).almacenId).toBe(3)
  })

  test('un admin arranca viendo los cuatro', () => {
    expect(filtrosIniciales({ rol: 'admin', almacenId: null }).almacenId).toBe('todos')
  })

  // Un admin con almacen asignado sigue viendo todo: su trabajo es el conjunto.
  test('un admin con almacen asignado tambien arranca en todos', () => {
    expect(filtrosIniciales({ rol: 'admin', almacenId: 1 }).almacenId).toBe('todos')
  })

  test('un consulta arranca viendo los cuatro', () => {
    expect(filtrosIniciales({ rol: 'consulta', almacenId: null }).almacenId).toBe('todos')
  })

  // El esquema permite un consulta con almacen -solo `responsable` lo tiene
  // prohibido por restriccion-, y ese usuario no deja de ser de solo lectura.
  test('un consulta con almacen asignado tambien arranca en todos', () => {
    expect(filtrosIniciales({ rol: 'consulta', almacenId: 2 }).almacenId).toBe('todos')
  })

  // Mientras carga el perfil no hay rol, y la pantalla ya se esta pintando.
  test('sin perfil todavia, arranca en todos y no revienta', () => {
    expect(filtrosIniciales(undefined).almacenId).toBe('todos')
  })

  test('las bajas se esconden por omision', () => {
    expect(filtrosIniciales(undefined).incluirBaja).toBe(false)
  })

  test('los agotados NO se esconden: son justo lo que hay que reponer', () => {
    expect(filtrosIniciales(undefined).estado).toBe('todos')
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
