import { describe, expect, test } from 'vitest'

import { menuDeNavegacion } from './navegacion'

describe('menuDeNavegacion', () => {
  // El responsable trabaja solo su bodega. Admin y consulta no tienen ninguna,
  // asi que la general es su inventario.
  test('el inventario general lo ven admin y consulta, no el responsable', () => {
    expect(menuDeNavegacion('admin', false).map((i) => i.ruta)).toContain('/inventario-general')
    expect(menuDeNavegacion('consulta', false).map((i) => i.ruta)).toContain('/inventario-general')
    expect(menuDeNavegacion('responsable', true).map((i) => i.ruta)).not.toContain(
      '/inventario-general',
    )
  })

  // Dejo de ser una pantalla administrativa cuando dejo de ser solo del admin.
  test('el inventario general vive en operacion, no en administracion', () => {
    const item = menuDeNavegacion('consulta', false).find((i) => i.ruta === '/inventario-general')

    expect(item?.grupo).toBe('operacion')
  })

  // Inventario es la pantalla de UNA bodega: la de quien entra. Sin almacen
  // asignado no hay ninguna que ensenar, y el menu no la ofrece.
  test('inventario solo aparece con almacen propio', () => {
    expect(menuDeNavegacion('responsable', true).map((i) => i.ruta)).toContain('/inventario')
    expect(menuDeNavegacion('admin', false).map((i) => i.ruta)).not.toContain('/inventario')
  })

  test('la administracion de usuarios sigue siendo solo del admin', () => {
    expect(menuDeNavegacion('admin', false).map((i) => i.ruta)).toContain('/usuarios')

    for (const rol of ['responsable', 'consulta'] as const) {
      expect(menuDeNavegacion(rol, true).map((i) => i.ruta)).not.toContain('/usuarios')
    }
  })

  // Mientras carga el perfil no hay rol todavia. Si en ese hueco se colara una
  // pantalla de admin, cualquiera la veria por un instante al entrar.
  test('sin perfil todavia, las administrativas no se cuelan', () => {
    const rutas = menuDeNavegacion(undefined, false).map((i) => i.ruta)

    expect(rutas).not.toContain('/usuarios')
    expect(rutas).not.toContain('/administracion/educativo')
  })

  // Un item disponible sin ruta registrada en App.tsx es un enlace roto, y una
  // ruta sin item es una pantalla a la que nadie llega.
  test('inventario, general y practicas estan disponibles; reportes sigue apagado', () => {
    const responsable = menuDeNavegacion('responsable', true)
    const admin = menuDeNavegacion('admin', false)

    expect(responsable.find((i) => i.ruta === '/inventario')?.disponible).toBe(true)
    expect(responsable.find((i) => i.ruta === '/inventario-general')).toBeUndefined()
    expect(responsable.find((i) => i.ruta === '/practicas')?.disponible).toBe(true)
    expect(admin.find((i) => i.ruta === '/inventario-general')?.disponible).toBe(true)
    expect(admin.find((i) => i.ruta === '/reportes')?.disponible).toBe(false)
  })

  test('ninguna ruta se repite', () => {
    const rutas = menuDeNavegacion('admin', true).map((i) => i.ruta)

    expect(new Set(rutas).size).toBe(rutas.length)
  })
})

describe('el panel del programa educativo', () => {
  test('solo lo ve el admin, y ya está disponible', () => {
    const panel = menuDeNavegacion('admin', false).find(
      (i) => i.ruta === '/administracion/educativo',
    )

    expect(panel?.disponible).toBe(true)
  })

  test('un responsable no lo ve', () => {
    const rutas = menuDeNavegacion('responsable', true).map((i) => i.ruta)

    expect(rutas).not.toContain('/administracion/educativo')
  })

  test('sin perfil todavía, tampoco', () => {
    const rutas = menuDeNavegacion(undefined, false).map((i) => i.ruta)

    expect(rutas).not.toContain('/administracion/educativo')
  })
})
