import path from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

import { menuDeNavegacion } from '@/app/navegacion'

// La tabla de rutas vive en JSX dentro de App.tsx y no se exporta, asi que
// ninguna prueba de componentes la alcanza: las de RutaProtegida montan su
// propio MemoryRouter con sus propios <Route>, y siguen en verde aunque la ruta
// de verdad diga otra cosa. Esta lee el archivo tal cual.
//
// El fallo que viene a evitar: renombrar la ruta en el menu y olvidarla en el
// router. No hay <Route path="*">, asi que React Router no pinta nada -ni la
// barra lateral, porque Layout cuelga de la ruta que no caso-: pantalla en
// blanco, sin error en consola.
const app = readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8')

// Un admin CON almacen asignado es el menu mas grande que existe, y los demas
// casos son un subconjunto suyo. El almacen importa desde que Inventario dejo de
// ser universal: sin el, un admin no lo ve, y esta prueba dejaria de comprobar
// que su ruta existe.
const DISPONIBLES = menuDeNavegacion('admin', true).filter((item) => item.disponible)

describe('App.tsx', () => {
  test.each(DISPONIBLES.map((item) => [item.etiqueta, item.ruta]))(
    'la ruta de %s existe en el router',
    (_etiqueta, ruta) => {
      expect(app).toContain(`path="${ruta}"`)
    },
  )

  // Al reves: una entrada apagada que ya tuviera ruta esta mal marcada, y el
  // menu la dibujaria muerta teniendo pantalla.
  test('las pantallas pendientes no tienen ruta todavia', () => {
    for (const item of menuDeNavegacion('admin', true).filter((i) => !i.disponible)) {
      expect(app).not.toContain(`path="${item.ruta}"`)
    }
  })
})
