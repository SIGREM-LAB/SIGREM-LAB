import { describe, expect, test } from 'vitest'

import {
  almacenDesdeNavegacion,
  necesitanAtencion,
  repartirAlmacenes,
  type ResumenAlmacen,
} from './menu'

function almacen(cambios: Partial<ResumenAlmacen> = {}): ResumenAlmacen {
  return {
    id: 1,
    clave: 'N3',
    nombre: 'Almacén Nivel 3',
    total: 10,
    disponible: 7,
    stockBajo: 2,
    agotado: 1,
    contaminado: 0,
    mantenimiento: 0,
    ...cambios,
  }
}

const CUATRO = [
  almacen(),
  almacen({ id: 2, clave: 'N4', nombre: 'Almacén Nivel 4', total: 20, disponible: 18, stockBajo: 1, agotado: 1 }),
  almacen({ id: 3, clave: 'LUM', nombre: 'Almacén LUM', total: 5, disponible: 5, stockBajo: 0, agotado: 0 }),
  almacen({ id: 4, clave: 'LE', nombre: 'Lab. de Electrónica', total: 1, disponible: 0, stockBajo: 0, agotado: 0, mantenimiento: 1 }),
]

describe('necesitanAtencion', () => {
  test('suma lo que hay que reponer o mandar a servicio', () => {
    expect(necesitanAtencion({ stockBajo: 2, agotado: 1, mantenimiento: 3 })).toBe(6)
  })

  // Un frasco contaminado esta identificado y quieto: no es una tarea. Si
  // contara, el aviso nunca bajaria a cero y se dejaria de mirar.
  test('lo contaminado no cuenta como pendiente', () => {
    const resumen = almacen({ stockBajo: 0, agotado: 0, mantenimiento: 0, contaminado: 9 })
    expect(necesitanAtencion(resumen)).toBe(0)
  })
})

describe('repartirAlmacenes', () => {
  test('un responsable ve el suyo arriba y los otros tres al lado', () => {
    const { portada, otros } = repartirAlmacenes(CUATRO, 2)

    expect(portada?.clave).toBe('N4')
    expect(portada?.propio).toBe(true)
    expect(otros.map((a) => a.clave)).toEqual(['N3', 'LUM', 'LE'])
  })

  // Admin y consulta no tienen almacen propio. En vez de una pantalla aparte,
  // el bloque grande pasa a ser la suma y la lista los muestra los cuatro.
  test('sin almacen propio, arriba va la suma de la Unidad', () => {
    const { portada, otros } = repartirAlmacenes(CUATRO, null)

    expect(portada?.clave).toBeNull()
    expect(portada?.propio).toBe(false)
    expect(portada?.total).toBe(36)
    expect(portada?.disponible).toBe(30)
    expect(portada?.mantenimiento).toBe(1)
    expect(otros).toHaveLength(4)
  })

  // Un admin con almacen asignado sigue siendo admin: su trabajo es el
  // conjunto, igual que en los filtros del inventario.
  test('un almacen propio que no esta en la lista cae en la suma', () => {
    expect(repartirAlmacenes(CUATRO, 99).portada?.clave).toBeNull()
  })

  test('sin almacenes todavia no hay portada que pintar', () => {
    expect(repartirAlmacenes([], 1).portada).toBeNull()
  })
})

describe('almacenDesdeNavegacion', () => {
  test('lee el almacen que manda el menu', () => {
    expect(almacenDesdeNavegacion({ almacenId: 3 })).toBe(3)
  })

  // El state lo pone quien navega y sobrevive a la recarga: puede llegar
  // cualquier cosa, y de ahi sale el filtro de una pantalla entera.
  test.each([
    ['nada', null],
    ['un texto', 'N3'],
    ['un objeto sin la llave', { otra: 1 }],
    ['un id que no es entero', { almacenId: 1.5 }],
    ['un id que es texto', { almacenId: '3' }],
  ])('descarta %s', (_caso, state) => {
    expect(almacenDesdeNavegacion(state)).toBeNull()
  })
})
