import path from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// El script vive en el HTML, fuera del bundle: ninguna prueba de componentes lo
// alcanza. Esta lee el archivo tal cual para que nadie lo borre sin enterarse, y
// para que si MUI cambiara sus claves el fallo salga aqui y no en forma de
// destello que hay que ver a ojo.
const html = readFileSync(path.join(process.cwd(), 'index.html'), 'utf8')

describe('index.html', () => {
  test('le declara los dos esquemas al navegador', () => {
    expect(html).toMatch(/<meta name="color-scheme" content="light dark"/)
  })

  test('pinta el esquema guardado con las claves de MUI', () => {
    expect(html).toContain('mui-mode')
    expect(html).toContain('data-mui-color-scheme')
    expect(html).toContain('prefers-color-scheme: dark')
  })

  // Si corriera despues del bundle no serviria de nada: la primera pintura ya
  // habria salido en claro.
  test('corre antes de cargar la app', () => {
    expect(html.indexOf('data-mui-color-scheme')).toBeLessThan(html.indexOf('/src/main.tsx'))
  })
})
