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

  // Un item disponible sin ruta registrada en App.tsx es un enlace roto, y una
  // ruta sin item es una pantalla a la que nadie llega. Esta prueba ancla el
  // unico de los cuatro que ya esta construido.
  test('inventario y practicas ya estan disponibles; reportes sigue apagado', () => {
    const items = menuDeNavegacion('responsable')

    expect(items.find((i) => i.ruta === '/inventario')?.disponible).toBe(true)
    expect(items.find((i) => i.ruta === '/practicas')?.disponible).toBe(true)
    expect(items.find((i) => i.ruta === '/reportes')?.disponible).toBe(false)
  })

  test('ninguna ruta se repite', () => {
    const rutas = menuDeNavegacion('admin').map((i) => i.ruta)

    expect(new Set(rutas).size).toBe(rutas.length)
  })
})

describe('el panel académico', () => {
  test('solo lo ve el admin, y ya está disponible', () => {
    const panel = menuDeNavegacion('admin').find((i) => i.ruta === '/administracion/academico')

    expect(panel?.disponible).toBe(true)
  })

  test('un responsable no lo ve', () => {
    const rutas = menuDeNavegacion('responsable').map((i) => i.ruta)

    expect(rutas).not.toContain('/administracion/academico')
  })

  test('sin perfil todavía, tampoco', () => {
    const rutas = menuDeNavegacion(undefined).map((i) => i.ruta)

    expect(rutas).not.toContain('/administracion/academico')
  })
})
