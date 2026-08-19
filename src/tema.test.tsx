import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { paletaClara, paletaOscura, tema } from './tema'

/**
 * Luminancia relativa y razon de contraste de WCAG 2.1 (criterio 1.4.3). Se
 * calculan aqui a proposito: asi la tabla del disenio deja de ser una
 * anotacion que envejece y pasa a ser algo que se rompe si alguien mete un
 * color que no contrasta.
 */
function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
  const [r, g, b] = canales.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/** Lee la paleta ya resuelta por MUI, que es la que acaba en el CSS. */
function paletaDe(esquema: 'light' | 'dark') {
  const sistema = tema.colorSchemes[esquema]
  if (!sistema) throw new Error(`El tema no define el esquema "${esquema}"`)
  return sistema.palette
}

type Paleta = ReturnType<typeof paletaDe>

/**
 * Los ocho pares de la §8 del disenio. El umbral es 4.5:1 -texto normal- salvo
 * en `secondary`: ese naranja hoy solo pinta la mancha decorativa del login,
 * nunca texto, asi que le toca el 3:1 de WCAG 1.4.11 para elementos graficos,
 * el mismo criterio por el que `divider` no entra en esta lista. Si alguien lo
 * usa como tinta, sube el umbral aqui y el color con el.
 */
const PARES: Array<[string, (p: Paleta) => [string, string], number]> = [
  ['text.primary sobre background.default', (p) => [p.text.primary, p.background.default], 4.5],
  ['text.primary sobre background.paper', (p) => [p.text.primary, p.background.paper], 4.5],
  ['text.secondary sobre background.default', (p) => [p.text.secondary, p.background.default], 4.5],
  ['text.secondary sobre background.paper', (p) => [p.text.secondary, p.background.paper], 4.5],
  ['primary.main sobre background.paper', (p) => [p.primary.main, p.background.paper], 4.5],
  ['error.main sobre background.paper', (p) => [p.error.main, p.background.paper], 4.5],
  ['secondary.main sobre background.paper', (p) => [p.secondary.main, p.background.paper], 3],
  [
    'institucional.contrastText sobre institucional.main',
    (p) => [p.institucional.contrastText, p.institucional.main],
    4.5,
  ],
]

for (const esquema of ['light', 'dark'] as const) {
  describe(`esquema ${esquema}`, () => {
    for (const [etiqueta, par, minimo] of PARES) {
      test(`${etiqueta} contrasta al menos ${minimo}:1`, () => {
        const [frente, fondo] = par(paletaDe(esquema))

        expect(contraste(frente, fondo)).toBeGreaterThanOrEqual(minimo)
      })
    }
  })
}

describe('los dos esquemas', () => {
  // El fallo que esto atrapa es el de olvidarse un token en uno de los dos: un
  // esquema sin `divider` no truena, solo se ve mal.
  test('definen los mismos tokens', () => {
    expect(Object.keys(paletaOscura).sort()).toEqual(Object.keys(paletaClara).sort())
  })

  test('cada color trae su main', () => {
    for (const paleta of [paletaClara, paletaOscura]) {
      for (const color of ['primary', 'secondary', 'error', 'institucional'] as const) {
        expect(paleta[color]).toHaveProperty('main')
      }
    }
  })
})

// La §7 del disenio: "no se cierra leyendo documentacion, se verifica en el CSS
// generado". Es el incidente de la pantalla negra: si el navegador no sabe en
// que modo esta, pinta en oscuro lo que dibuja el -barras de scroll, campos
// autocompletados, menus nativos- sobre una interfaz clara.
test('el CSS generado declara color-scheme por esquema', () => {
  render(
    <ThemeProvider theme={tema}>
      <CssBaseline />
    </ThemeProvider>,
  )

  const hoja = Array.from(document.querySelectorAll('style'))
    .map((etiqueta) => etiqueta.textContent ?? '')
    .join('\n')

  expect(hoja).toMatch(/\[data-mui-color-scheme="light"\][^}]*color-scheme:\s*light/)
  expect(hoja).toMatch(/\[data-mui-color-scheme="dark"\][^}]*color-scheme:\s*dark/)
})
