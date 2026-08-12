import { describe, expect, test } from 'vitest'

import { menuDeNavegacion } from './navegacion'

describe('menuDeNavegacion', () => {
  // El inventario general cruza los cuatro almacenes: es la unica pantalla que
  // depende del rol, y por eso es la unica logica del menu que se prueba.
  test('el inventario general solo aparece para el admin', () => {
    const rutas = menuDeNavegacion('admin').map((i) => i.ruta)

    expect(rutas).toContain('/inventario-general')
  })

  test('un responsable no ve el inventario general', () => {
    const rutas = menuDeNavegacion('responsable').map((i) => i.ruta)

    expect(rutas).not.toContain('/inventario-general')
  })

  // Mientras carga el perfil no hay rol todavia. Si en ese hueco se colara la
  // pantalla de admin, cualquiera la veria por un instante al entrar.
  test('sin perfil todavia, tampoco se muestra', () => {
    const rutas = menuDeNavegacion(undefined).map((i) => i.ruta)

    expect(rutas).not.toContain('/inventario-general')
  })

  test('ninguna ruta se repite', () => {
    const rutas = menuDeNavegacion('admin').map((i) => i.ruta)

    expect(new Set(rutas).size).toBe(rutas.length)
  })
})
