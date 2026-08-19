# Tema claro y oscuro — Plan de implementacion

> **Para quien lo ejecute con agentes:** SUB-SKILL REQUERIDA: usa
> `superpowers:subagent-driven-development` (recomendada) o
> `superpowers:executing-plans` para ir tarea por tarea. Los pasos llevan
> casilla (`- [ ]`) para marcarlos.

**Objetivo:** que SIGREM-LAB tenga paleta clara y oscura, que siga al sistema
operativo por defecto y que el usuario pueda forzar una de las dos desde la
barra lateral y desde el login.

**Arquitectura:** una sola llamada a `createTheme` con `cssVariables` y dos
`colorSchemes`; MUI emite un bloque de variables CSS por esquema y conmuta con
el atributo `data-mui-color-scheme` en `<html>`. La preferencia la guarda el
propio paquete en `localStorage`. Un script en linea en `index.html` pinta el
atributo antes de que cargue el bundle para que la primera pintura ya salga en
el modo correcto. No hay contexto propio ni estado en React.

**Stack:** MUI 9.3.1 (`@mui/material`), `@iconify/react`, Vite 8, Vitest 4,
Testing Library. Sin dependencias nuevas. Sin migraciones.

**Spec:** `docs/specs/2026-08-18-tema-claro-oscuro-design.md` — se lee junto con
este plan; el plan argumenta desde ahi.

## Restricciones globales

- **Colores solo en `src/tema.ts`.** Fuera de ahi y de `src/app/almacenes.ts`
  no se escribe un hex nuevo. Los `rgba(255,255,255,x)` de `Layout.tsx` son la
  excepcion ya existente: la barra sigue guinda en los dos modos (D2).
- **En español.** Identificadores del dominio, comentarios y todo el texto que
  ve el usuario. Los comentarios explican *por que*, no *que*.
- **Nada de `Co-Authored-By` ni firmas de herramientas en los commits.**
- **Antes de dar por terminada cualquier tarea:** `pnpm typecheck && pnpm lint
  && pnpm test`. Los tres en cero. `supabase test db` no aplica: este hito no
  toca la base.
- **Valores exactos de la paleta** (§4 del spec), copiados tal cual:

  | Token | Claro | Oscuro |
  |---|---|---|
  | `background.default` | `#F5F6F8` | `#16181C` |
  | `background.paper` | `#FFFFFF` | `#1E2126` |
  | `text.primary` | `#202226` | `#E8EAED` |
  | `text.secondary` | `#6F6F6E` | `#A2A5AB` |
  | `primary.main` | `#C10230` | `#E85C76` |
  | `secondary.main` | `#ED5E17` | `#FF8300` |
  | `error.main` | `#A21A19` | `#F2635F` |
  | `divider` | `#E4E6EA` | `#2C3037` |
  | `grey.600` | `#6F6F6E` | `#A2A5AB` |
  | `institucional.main` | `#C10230` | `#C10230` |

- **Claves de MUI que no se inventan** (verificadas en
  `node_modules/@mui/material/InitColorSchemeScript/InitColorSchemeScript.d.ts`):
  atributo `data-mui-color-scheme`, modo en `localStorage` bajo `mui-mode`,
  esquema bajo `mui-color-scheme`.

---

## Lo que la verificacion previa cambio respecto al spec

Todo esto se comprobo contra el paquete instalado (MUI 9.3.1) y contra el CSS
que genera, no contra la documentacion. Son las cuatro correcciones que este
plan mete sobre el disenio del 18 de agosto.

1. **El riesgo principal de la §7 ya esta cerrado por el propio MUI.**
   `prepareCssVars.js:128-130` mete `colorScheme: <mode>` dentro de la hoja de
   cada esquema, asi que el CSS generado trae
   `[data-mui-color-scheme="dark"]{ color-scheme: dark; … }` con solo declarar
   `cssVariables` + `colorSchemes`. **No hace falta `<CssBaseline
   enableColorScheme />`** — esa prop (que por cierto viene en `false`) es para
   el camino sin variables CSS. Comprobado renderizando con y sin ella: el CSS
   sale igual. Aun asi el plan lo deja como prueba automatica (Tarea 1), que es
   lo que la §7 pedia.

2. **`src/App.tsx` no se toca.** El spec lo listaba como modificado. Con
   `cssVariables`, el mismo `ThemeProvider` que ya esta ahi resuelve los
   esquemas, y `defaultMode` ya vale `'system'`
   (`createCssVarsProvider.js:67`). Agregar props seria ruido.

3. **`institucional` necesita `dark` declarado a mano.** Los colores de paleta
   propios no pasan por `augmentColor`: MUI genera sus canales pero no sus
   variantes. `Button.js:174` usa `palette[color].dark` para el hover del
   `contained`; sin ese valor el boton "Entrar" se queda sin fondo al pasar el
   raton. Se declaran los cuatro valores.

4. **El par `secondary.main` sobre papel se prueba a 3:1, no a 4.5:1.** En
   claro, `#ED5E17` sobre `#FFFFFF` da **3.38:1**: no llega al umbral de texto
   que la §8 daba por hecho. Ese naranja hoy solo pinta la mancha decorativa
   del login al 7% de opacidad (`PantallaAcceso.tsx:127`), nunca texto, asi que
   le aplica el 3:1 de WCAG 1.4.11 para elementos graficos — el mismo criterio
   por el que la §8 deja fuera `divider`. Decision del usuario, 19 de agosto.
   Si alguien lo usa como tinta, sube el umbral en la prueba y el color con el.

**Contrastes calculados** (formula de WCAG 2.1, no estimados). Los ocho pares
de la §8 en los dos esquemas:

| Par | Claro | Oscuro | Umbral |
|---|---|---|---|
| `text.primary` / `background.default` | 14.73 | 14.75 | 4.5 |
| `text.primary` / `background.paper` | 15.93 | 13.39 | 4.5 |
| `text.secondary` / `background.default` | 4.65 | 7.20 | 4.5 |
| `text.secondary` / `background.paper` | 5.03 | 6.54 | 4.5 |
| `primary.main` / `background.paper` | 6.33 | 4.78 | 4.5 |
| `error.main` / `background.paper` | 7.78 | 5.17 | 4.5 |
| `secondary.main` / `background.paper` | 3.38 | 6.53 | **3.0** |
| `institucional.contrastText` / `institucional.main` | 6.33 | 6.33 | 4.5 |

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/tema.ts` *(modificar)* | Unica fuente de color. Declara el token `institucional`, las dos paletas y los dos esquemas. Exporta `tema`, `paletaClara` y `paletaOscura` |
| `src/tema.test.tsx` *(crear)* | Convierte la tabla de contrastes en algo que se rompe solo. Ademas verifica que los dos esquemas definen los mismos tokens y que el CSS generado trae `color-scheme` por esquema |
| `index.html` *(modificar)* | Declara los dos esquemas al navegador y pinta el guardado antes del bundle |
| `src/antiDestello.test.ts` *(crear)* | Guarda de regresion del script en linea: que siga ahi, con las claves de MUI y antes del bundle |
| `src/app/BotonTema.tsx` *(crear)* | El control de tres estados. Sin estado propio: lee y escribe `useColorScheme()` |
| `src/app/BotonTema.test.tsx` *(crear)* | Ciclo, nombre accesible y el caso de esquema sin resolver |
| `src/app/Layout.tsx` *(modificar)* | Barra guinda fija (`institucional`), caption a 0.82 y el control en el pie |
| `src/features/auth/PantallaAcceso.tsx` *(modificar)* | Cabecera guinda fija, iconos de campo con color del tema, logo del pie en blanco cuando el esquema es oscuro, y el control arriba de la tarjeta |
| `src/arranque.ts` *(modificar)* | Fondo explicito: corre fuera de React, sin tema |

`src/index.css` no se toca: solo fija alturas. `src/App.tsx` tampoco (ver
correccion 2).

---

### Task 1: La paleta en dos esquemas

Es el grueso del hito y de lo que cuelga todo lo demas.

**Files:**
- Modify: `src/tema.ts`
- Test: `src/tema.test.tsx` *(crear)*

> **Desviacion del spec:** la §8 lo llamaba `src/tema.test.ts`. Va en `.tsx`
> porque una de las tres pruebas renderiza el `ThemeProvider` para leer el CSS
> generado, y eso necesita JSX.

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export const tema` — sigue llamandose igual; `src/App.tsx` no cambia.
  - `export const paletaClara` / `export const paletaOscura` — los objetos
    literales de cada esquema, para que la prueba de paridad compare tokens sin
    pasar por el tema ya resuelto (MUI rellena huecos al resolver, y eso haria
    la comparacion trivialmente cierta).
  - Aumentacion de modulo: `Palette['institucional']` y
    `ButtonPropsColorOverrides['institucional']`, disponibles en todo `src/`.

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/tema.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm vitest run src/tema.test.tsx
```

Esperado: FALLA. `paletaClara` y `paletaOscura` no existen todavia, asi que ni
llega a importar el modulo.

- [ ] **Step 3: Reescribe `src/tema.ts`**

Deja el archivo asi. La tipografia, `shape` y los overrides de `components` son
los de hoy: no dependen del color y no se tocan, salvo los dos cambios marcados
en `MuiCssBaseline` y `MuiButton`.

```ts
import { createTheme } from '@mui/material/styles'

/**
 * `institucional` es un color de paleta propio, asi que hay que declararselo a
 * TypeScript. Es la via que documenta MUI para esto y no contradice la regla
 * "los tipos se generan, no se escriben": esa regla habla del esquema de
 * Postgres (`src/types/database.ts`), no de la paleta.
 */
declare module '@mui/material/styles' {
  interface Palette {
    institucional: Palette['primary']
  }
  interface PaletteOptions {
    institucional?: PaletteOptions['primary']
  }
}
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    institucional: true
  }
}

/**
 * El guinda hace dos trabajos y en oscuro se pelean.
 *
 * Como relleno -barra lateral, cabecera del login, boton de accion primaria-
 * su contraste es interno: el blanco encima da 6.33:1 y eso no depende de lo
 * que haya detras. Por eso `institucional` no cambia con el modo: la identidad
 * no parpadea.
 *
 * Como tinta -un encabezado, un enlace- el contraste es contra la superficie,
 * y `#C10230` sobre el papel oscuro `#1E2126` da 2.55:1. Ilegible. Ese trabajo
 * lo hace `primary`, que si se aclara en el esquema oscuro.
 *
 * `dark` no es decorativo: MUI lo usa para el hover del boton `contained`
 * (`Button.js:174`). Los colores propios no pasan por `augmentColor`, asi que
 * si falta, el boton se queda sin fondo al pasar el raton.
 */
const institucional = {
  main: '#C10230',
  dark: '#A21A19',
  light: '#E14A66',
  contrastText: '#FFFFFF',
} as const

/** La paleta de siempre, mas el token `institucional`. */
export const paletaClara = {
  primary:    { main: '#C10230', dark: '#A21A19', light: '#E14A66', contrastText: '#FFFFFF' },
  secondary:  { main: '#ED5E17', light: '#FF8300', contrastText: '#FFFFFF' },
  error:      { main: '#A21A19' },
  institucional,
  text:       { primary: '#202226', secondary: '#6F6F6E' },
  divider:    '#E4E6EA',
  grey:       { 600: '#6F6F6E' },
  background: { default: '#F5F6F8', paper: '#FFFFFF' },
} as const

/**
 * Ni negro puro ni blanco puro: `#16181C` y `#E8EAED` conservan el sesgo frio
 * que ya tiene la paleta clara. Blanco puro sobre negro puro produce halo y
 * cansa en jornadas largas, que es justo el caso de uso.
 *
 * El guinda aclarado va desaturado a proposito: subirle luminosidad
 * manteniendo el 98% de saturacion da `#FD3565`, que es neon y no se parece al
 * color institucional. `#E85C76` sigue leyendose como guinda.
 *
 * `paper` es mas claro que `default`, igual que en claro: las superficies
 * elevadas se acercan al usuario.
 */
export const paletaOscura = {
  primary:    { main: '#E85C76' },
  // Blanco sobre este naranja da 2.2:1; la tinta oscura de la paleta, 6.45:1.
  secondary:  { main: '#FF8300', contrastText: '#202226' },
  error:      { main: '#F2635F' },
  institucional,
  text:       { primary: '#E8EAED', secondary: '#A2A5AB' },
  divider:    '#2C3037',
  grey:       { 600: '#A2A5AB' },
  background: { default: '#16181C', paper: '#1E2126' },
} as const

/**
 * Los colores viven aqui y solo aqui: en los componentes se usan como
 * `color="primary"` o `sx={{ color: 'primary.main' }}`. Un hex suelto en un
 * componente no se puede cambiar de golpe.
 */
export const tema = createTheme({
  // Sin `colorSchemeSelector` el modo lo decide la media query del sistema y
  // `setMode` no tiene efecto: el usuario no podria forzar claro ni oscuro.
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    light: { palette: paletaClara },
    dark: { palette: paletaOscura },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2,  letterSpacing: '-0.02em' },
    h2: { fontSize: '1.2rem',  fontWeight: 700, lineHeight: 1.3,  letterSpacing: '-0.01em' },
    h3: { fontSize: '1rem',    fontWeight: 700, lineHeight: 1.35 },
    overline: { fontWeight: 700, letterSpacing: '0.09em' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Aqui vivia `':root': { colorScheme: 'light' }`, que apagaba el modo
        // oscuro del navegador para que no pintara en negro lo que dibuja el
        // -barras de scroll, campos autocompletados, menus nativos- sobre una
        // interfaz clara. Eso fue la pantalla negra. Ya no hay que forzarlo:
        // con `cssVariables`, MUI emite `color-scheme: light|dark` dentro del
        // bloque de cada esquema, asi que el navegador pinta lo suyo en el
        // modo que toca. Comprobado en el CSS generado, no en la
        // documentacion: lo cubre `src/tema.test.tsx`.
        body: { WebkitFontSmoothing: 'antialiased' },
      },
    },
    // Las tarjetas del prototipo: borde fino, esquinas amplias, sin sombra.
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 14 } },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 24, '&:last-child': { paddingBottom: 24 } } },
    },
    MuiButton: {
      // Los botones de accion primaria son guinda en los dos modos. Va aqui y
      // no boton por boton: asi el "Entrar" del login y cualquier boton futuro
      // salen guinda sin que nadie tenga que acordarse de la regla.
      defaultProps: { disableElevation: true, color: 'institucional' },
      styleOverrides: { root: { borderRadius: 8 }, sizeLarge: { height: 44 } },
    },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
    // Las maquinas de los almacenes son de ~1024 px: densidad alta por defecto.
    MuiTextField:  { defaultProps: { size: 'small', fullWidth: true } },
    MuiTable:      { defaultProps: { size: 'small' } },
    MuiAppBar:     { defaultProps: { elevation: 0, color: 'primary' } },
  },
})
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm vitest run src/tema.test.tsx
```

Esperado: PASA, 19 pruebas (8 pares × 2 esquemas + 2 de paridad + 1 de CSS).

- [ ] **Step 5: Corre todo lo demas**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Las pruebas que ya existian tienen que seguir en verde. Si `PantallaAcceso`
falla aqui, mira el `color` por defecto del boton: el "Entrar" ahora sale
`institucional`. Esas pruebas lo buscan por nombre accesible, no por color, asi
que no deberia.

- [ ] **Step 6: Commit**

```bash
git add src/tema.ts src/tema.test.tsx
git commit -m "feat(tema): paleta clara y oscura con el token institucional

Separa el guinda en dos tokens: institucional para los rellenos de marca, que
no cambia con el modo, y primary como tinta, que si. Sin esa separacion,
color=primary sobre texto da 2.55:1 en oscuro.

Los contrastes quedan como prueba, calculados con la formula de WCAG 2.1. El
par de secondary va a 3:1 porque hoy es relleno decorativo, no tinta."
```

---

### Task 2: Sin destello en la primera pintura

**Files:**
- Modify: `index.html`
- Test: `src/antiDestello.test.ts` *(crear)*

**Interfaces:**
- Consumes: el atributo y la clave de `localStorage` de la Tarea 1
  (`data-mui-color-scheme`, `mui-mode`).
- Produces: nada que importe otro modulo. El contrato es con el navegador.

**Por que un script a mano.** Esta app es Vite en cliente puro: no hay render
en servidor. El componente `InitColorSchemeScript` de MUI esta pensado para
frameworks con SSR, donde el script sale ya escrito en el HTML; aqui React
monta despues de que el navegador parsea el documento, asi que renderizarlo
desde React no llega a tiempo y la primera pintura saldria en claro para saltar
a oscuro un instante despues. Tampoco sirve importar sus constantes: el entry
publico `@mui/material/InitColorSchemeScript` solo exporta el componente, no el
`defaultConfig` que declara su `.d.ts` (comprobado). Por eso las claves van
literales, con el comentario que dice de donde salen.

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/antiDestello.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// El script vive en el HTML, fuera del bundle: ninguna prueba de componentes lo
// alcanza. Esta lee el archivo tal cual para que nadie lo borre sin enterarse, y
// para que si MUI cambiara sus claves el fallo salga aqui y no en forma de
// destello que hay que ver a ojo.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

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
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm vitest run src/antiDestello.test.ts
```

Esperado: FALLAN las tres. El meta dice `content="light"` y no hay script.

- [ ] **Step 3: Cambia `index.html`**

Sustituye el bloque del `<meta name="color-scheme">` por esto, dejando el resto
del `<head>` igual:

```html
    <!-- Los dos: el navegador ya no tiene que adivinar en cual esta. -->
    <meta name="color-scheme" content="light dark" />
    <script>
      // React monta despues de que el navegador pinta, asi que esto no puede
      // vivir en un componente: la primera pintura saldria en claro y saltaria
      // a oscuro. El atributo y la clave son los que usa InitColorSchemeScript
      // de MUI (su defaultConfig, en el .d.ts del paquete); van literales
      // porque el entry publico no los exporta.
      ;(function () {
        try {
          var modo = localStorage.getItem('mui-mode') || 'system'
          var esquema =
            modo === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : modo
          document.documentElement.setAttribute('data-mui-color-scheme', esquema)
        } catch (error) {
          // Navegador con el almacenamiento bloqueado: se queda en claro, que
          // es lo que MUI aplica en `:root` cuando no hay atributo.
        }
      })()
    </script>
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm vitest run src/antiDestello.test.ts
```

Esperado: PASA, 3 pruebas.

- [ ] **Step 5: Compruebalo en el navegador**

```bash
pnpm dev
```

Con Windows en modo oscuro y sin nada en `localStorage` (Application → Local
Storage → borra `mui-mode`), recarga: la app tiene que aparecer oscura de una
vez, sin un fogonazo claro previo. El control para cambiarlo todavia no existe;
para probar el otro lado, escribe `localStorage.setItem('mui-mode','light')` en
la consola y recarga.

- [ ] **Step 6: Commit**

```bash
git add index.html src/antiDestello.test.ts
git commit -m "feat(tema): pintar el esquema guardado antes de cargar la app

Vite en cliente puro: InitColorSchemeScript de MUI no llega a tiempo porque
React monta despues de la primera pintura. Seis lineas en el HTML con las
claves del propio paquete."
```

---

### Task 3: El control de tema

**Files:**
- Create: `src/app/BotonTema.tsx`
- Test: `src/app/BotonTema.test.tsx`

**Interfaces:**
- Consumes: `tema` de la Tarea 1 (la prueba lo usa como proveedor).
- Produces: `export function BotonTema({ sx }: { sx?: SxProps<Theme> })`. La
  Tarea 4 lo coloca en dos sitios y le pasa `sx` solo en la barra, donde el
  fondo guinda pide tinta blanca.

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/app/BotonTema.test.tsx`:

```tsx
import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'

import { BotonTema } from './BotonTema'
import { tema } from '@/tema'

/** El unico boton cuyo nombre empieza por "Tema:". */
function control() {
  return screen.getByRole('button', { name: /^Tema:/ })
}

beforeEach(() => {
  // La preferencia vive en localStorage y el esquema resuelto en un atributo de
  // <html>: sin limpiarlos, cada prueba arrancaria donde termino la anterior.
  localStorage.clear()
  document.documentElement.removeAttribute('data-mui-color-scheme')
})

describe('BotonTema', () => {
  test('cicla automatico, claro, oscuro y vuelve', async () => {
    const usuario = userEvent.setup()
    render(
      <ThemeProvider theme={tema}>
        <BotonTema />
      </ThemeProvider>,
    )

    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')

    await usuario.click(control())
    expect(control()).toHaveAttribute('aria-label', 'Tema: claro')

    await usuario.click(control())
    expect(control()).toHaveAttribute('aria-label', 'Tema: oscuro')

    await usuario.click(control())
    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')
  })

  test('guarda la preferencia y marca el esquema en el documento', async () => {
    const usuario = userEvent.setup()
    render(
      <ThemeProvider theme={tema}>
        <BotonTema />
      </ThemeProvider>,
    )

    await usuario.click(control())
    expect(localStorage.getItem('mui-mode')).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-mui-color-scheme', 'light')

    await usuario.click(control())
    expect(document.documentElement).toHaveAttribute('data-mui-color-scheme', 'dark')
  })

  // Sin proveedor, useColorScheme devuelve el contexto vacio de MUI: mode
  // undefined y setMode sin efecto. Es la misma forma que tiene el primer
  // render antes de montar, y la que ven las pruebas de pantallas que no
  // envuelven en el tema. No puede parpadear ni tronar.
  test('aguanta el esquema sin resolver', async () => {
    const usuario = userEvent.setup()
    render(<BotonTema />)

    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')

    await usuario.click(control())

    expect(control()).toHaveAttribute('aria-label', 'Tema: automático')
  })
})
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm vitest run src/app/BotonTema.test.tsx
```

Esperado: FALLA. No existe `./BotonTema`.

- [ ] **Step 3: Escribe el componente**

Crea `src/app/BotonTema.tsx`:

```tsx
import { Icon } from '@iconify/react'
import { IconButton, Tooltip } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'

/** Tres estados, en el orden en que la gente espera encontrarlos. */
const SIGUIENTE = { system: 'light', light: 'dark', dark: 'system' } as const

const ASPECTO = {
  system: { icono: 'mdi:theme-light-dark', etiqueta: 'Tema: automático' },
  light: { icono: 'mdi:weather-sunny', etiqueta: 'Tema: claro' },
  dark: { icono: 'mdi:weather-night', etiqueta: 'Tema: oscuro' },
} as const

/**
 * Cicla entre seguir al sistema, claro y oscuro. No guarda estado propio: la
 * preferencia la persiste MUI en `localStorage`, y por eso sobrevive a la
 * recarga y funciona antes de iniciar sesion.
 */
export function BotonTema({ sx }: { sx?: SxProps<Theme> }) {
  const { mode, setMode } = useColorScheme()

  // En el primer render `mode` llega undefined: MUI no resuelve el modo hasta
  // que monta en el cliente. 'system' es el valor por defecto del proveedor,
  // asi que el boton dibuja lo mismo que va a dibujar un instante despues.
  const actual = mode ?? 'system'
  const { icono, etiqueta } = ASPECTO[actual]

  return (
    <Tooltip title={etiqueta}>
      {/* El estado va en el aria-label y no solo en el icono: sin nombre
          accesible, un lector de pantalla anuncia "boton" y nada mas. */}
      <IconButton aria-label={etiqueta} onClick={() => setMode(SIGUIENTE[actual])} sx={sx}>
        <Icon icon={icono} width={20} />
      </IconButton>
    </Tooltip>
  )
}
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm vitest run src/app/BotonTema.test.tsx
```

Esperado: PASA, 3 pruebas.

- [ ] **Step 5: Corre todo**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/app/BotonTema.tsx src/app/BotonTema.test.tsx
git commit -m "feat(tema): control de tres estados para el tema

Sistema, claro y oscuro. El estado va en el aria-label porque el control no
tiene texto visible, y aguanta el primer render con el esquema sin resolver."
```

---

### Task 4: Colocar el control y arreglar lo que arrastra

Los dos archivos van juntos porque comparten la decision D2 -la barra y la
cabecera del login siguen guinda en los dos modos- y separarlos dejaria la app a
medias entre dos paletas.

**Files:**
- Modify: `src/app/Layout.tsx`
- Modify: `src/features/auth/PantallaAcceso.tsx`
- Test: `src/features/auth/PantallaAcceso.test.tsx` *(agregar un caso)*

**Interfaces:**
- Consumes: `BotonTema` de la Tarea 3, `institucional` de la Tarea 1.
- Produces: nada nuevo.

- [ ] **Step 1: Escribe la prueba que falla**

Agrega este caso dentro del `describe('PantallaAcceso', …)` de
`src/features/auth/PantallaAcceso.test.tsx`, sin tocar los que ya estan:

```tsx
  // El login es una pantalla completa donde alguien se puede quedar un rato, y
  // la unica que se ve sin haber entrado: el control tiene que estar aqui
  // tambien, no solo dentro de la app.
  test('ofrece el control de tema', () => {
    render(<PantallaAcceso auth={authQue({ error: null })} />)

    expect(screen.getByRole('button', { name: /^Tema:/ })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm vitest run src/features/auth/PantallaAcceso.test.tsx
```

Esperado: FALLA el caso nuevo, "Unable to find an accessible element with the
role button and name /^Tema:/". Los otros tres siguen pasando.

- [ ] **Step 3: Cambia `PantallaAcceso.tsx`**

Cinco cambios puntuales:

1. Importaciones nuevas, junto a las que ya estan:

```tsx
import { useColorScheme } from '@mui/material/styles'

import { BotonTema } from '@/app/BotonTema'
```

2. El icono de los campos deja de llevar hex fijo. En `adorno()`, sustituye el
   `<InputAdornment position="start">` entero por:

```tsx
        <InputAdornment position="start">
          {/* Sin esto el icono se pierde sobre la superficie oscura: ese gris
              estaba clavado a la paleta clara. */}
          <Box component="span" sx={{ display: 'flex', color: 'text.secondary' }}>
            <Icon icon={icono} width={18} />
          </Box>
        </InputAdornment>
```

3. Dentro del componente, junto a los otros hooks, lee el esquema resuelto:

```tsx
  // `colorScheme`, no `mode`: `mode` vale 'system' cuando el usuario no ha
  // forzado nada, asi que compararlo con 'dark' daria falso justo en el caso
  // mas comun -sistema en oscuro y preferencia en automatico-. Vale undefined
  // en el primer render, y ahi el logo sale a color, que es el lado seguro.
  const { colorScheme } = useColorScheme()
```

4. El control, arriba a la derecha de la tarjeta y fuera del `Paper`. Justo
   despues de `<Box sx={{ position: 'relative', width: '100%', maxWidth: 430 }}>`
   y antes del `<Paper …>`:

```tsx
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <BotonTema />
        </Box>
```

5. La cabecera deja de seguir al modo y el logo del pie se adapta:

```tsx
          <Stack spacing={1.75} sx={{ bgcolor: 'institucional.main', color: 'common.white', px: 4, py: 3.5 }}>
```

```tsx
          <LogoUAEH alto={105} decorativo blanco={colorScheme === 'dark'} sx={{ alignSelf: 'center' }} />
```

El `color: 'primary.main'` del encabezado "Iniciar sesión" se queda como esta:
ahora `primary` si se adapta al modo, que era justo el punto.

- [ ] **Step 4: Cambia `Layout.tsx`**

Cuatro cambios:

1. Importa el control:

```tsx
import { BotonTema } from '@/app/BotonTema'
```

2. La barra sigue guinda en los dos modos. En el `Box component="nav"`:

```tsx
          bgcolor: 'institucional.main',
```

3. Los dos captions blancos suben de `0.75` a `0.82` — la linea de "Unidad
   Central de Laboratorios" y la del almacen con el rol:

```tsx
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.82)' }}>
```

   A `0.75` sobre el guinda daban 3.95:1 y WCAG pide 4.5:1 para 12 px. Los
   otros `rgba(255,255,255,x)` de este archivo se quedan como estan: siguen
   siendo validos porque la barra sigue guinda.

4. El control, en el pie junto a "Cerrar sesión". Envuelve el `<Button …>` que
   ya esta ahi:

```tsx
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.5} sx={{ alignItems: 'center' }}>
            <Button
              fullWidth
              onClick={salir}
              startIcon={<Icon icon="mdi:logout" width={20} />}
              sx={{
                color: 'rgba(255,255,255,0.9)',
                justifyContent: { xs: 'center', md: 'flex-start' },
                minWidth: 0,
                '& .MuiButton-startIcon': { mr: { xs: 0, md: 1 }, ml: 0 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.10)' },
              }}
            >
              <Box component="span" sx={{ display: SOLO_ANCHO }}>
                Cerrar sesión
              </Box>
            </Button>

            {/* En la barra angosta los dos controles se apilan: 52 px utiles no
                dan para ponerlos en fila. */}
            <BotonTema
              sx={{
                color: 'rgba(255,255,255,0.9)',
                flexShrink: 0,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.10)' },
              }}
            />
          </Stack>
```

   El "Cerrar sesión" no cambia de color al pasar el tema a `institucional`: ya
   fijaba los suyos en `sx`.

- [ ] **Step 5: Corre las pruebas y comprueba que pasan**

```bash
pnpm vitest run src/features/auth/PantallaAcceso.test.tsx
```

Esperado: PASA, 4 pruebas.

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

- [ ] **Step 6: Compruebalo a ojo, que es donde se ve**

```bash
pnpm dev
```

Con el sistema en oscuro, entra como `n3@uaeh.local` / `sigrem2026`. La barra
lateral tiene que seguir guinda, no aclararse; el logo del pie del login tiene
que verse en blanco y no apagado sobre el fondo oscuro; y el boton "Entrar",
guinda en los dos modos.

- [ ] **Step 7: Commit**

```bash
git add src/app/Layout.tsx src/features/auth/PantallaAcceso.tsx src/features/auth/PantallaAcceso.test.tsx
git commit -m "feat(tema): colocar el control y fijar la identidad en los dos modos

La barra y la cabecera del login pasan a institucional: el guinda de marca no
parpadea al cambiar de tema. El caption blanco sube a 0.82 porque a 0.75 daba
3.95:1 sobre el guinda."
```

---

### Task 5: La pantalla de arranque

Es la pantalla que existe para explicar fallos: no puede ser la que falle. Corre
fuera de React, sin tema y sin el CSS del bundle, asi que hereda del navegador.

**Files:**
- Modify: `src/arranque.ts`
- Test: `src/arranque.test.ts` *(agregar un caso)*

**Interfaces:**
- Consumes: nada. Los colores van literales a proposito: este HTML se escribe
  cuando el modulo del tema puede ni haber cargado.
- Produces: nada nuevo. `mensajeDeArranque(error)` mantiene su firma.

- [ ] **Step 1: Escribe la prueba que falla**

Agrega este caso al final del `describe('mensajeDeArranque', …)` de
`src/arranque.test.ts`:

```ts
  // Corre fuera de React y sin tema: si solo fijara el color del texto, con el
  // sistema en oscuro el navegador pintaria el fondo oscuro y quedaria texto
  // casi negro sobre negro. Justo la pantalla que no puede fallar.
  test('fija su propio fondo, no solo el color del texto', () => {
    const html = mensajeDeArranque(new Error('Algo raro exploto'))

    expect(html).toContain('background:#F5F6F8')
    expect(html).toContain('color:#202226')
  })
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm vitest run src/arranque.test.ts
```

Esperado: FALLA el caso nuevo. Hoy el HTML solo trae `color:#1A1416`.

- [ ] **Step 3: Cambia el `return` de `mensajeDeArranque`**

```ts
  // Fondo y color explicitos, y el contenedor cubre la ventana: con
  // <meta color-scheme="light dark"> el navegador pinta su propio fondo segun
  // el sistema, y esta pantalla no tiene tema del que sacar el suyo. Los hex
  // son los de `paletaClara`, copiados a mano a proposito: aqui no se puede
  // importar nada que pueda no haber cargado.
  return `<div style="min-height:100dvh;background:#F5F6F8;color:#202226;font:16px/1.6 system-ui,sans-serif">
      <div style="max-width:34rem;margin:0 auto;padding:12vh 1.5rem 0">
        <h1 style="font-size:1.4rem;margin:0 0 .5rem">SIGREM-LAB no pudo arrancar</h1>
        <p style="color:#6F6F6E;margin:0 0 1.25rem">${detalle}</p>
        ${instrucciones}
      </div>
    </div>`
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm vitest run src/arranque.test.ts
```

Esperado: PASA, 4 pruebas.

- [ ] **Step 5: Compruebalo con el stack apagado**

```bash
supabase stop
pnpm dev
```

Con el sistema en oscuro y con el sistema en claro, la pantalla tiene que
leerse en los dos casos. Despues, `supabase start`.

- [ ] **Step 6: Commit**

```bash
git add src/arranque.ts src/arranque.test.ts
git commit -m "fix(tema): fondo explicito en la pantalla de arranque

Corre fuera de React, sin tema. Con los dos esquemas declarados, el navegador
pinta su fondo segun el sistema y el texto quedaba casi negro sobre negro."
```

---

## Cierre del hito

Con las cinco tareas hechas, corre la lista completa:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Y la comprobacion a mano de la §8 del spec, que es lo que las pruebas no
alcanzan:

- [ ] Windows en modo oscuro, sin preferencia guardada → arranca en oscuro, sin
      destello claro previo.
- [ ] Forzar claro con el boton y recargar con F5 → sigue en claro.
- [ ] Con `supabase stop`, recargar → la pantalla de arranque se lee en los dos
      modos del sistema.
- [ ] Cambiar el modo del sistema con la app abierta y el boton en automatico →
      la app cambia sola.
- [ ] Entrar como `n3@` en oscuro → la barra sigue guinda; el logo del pie del
      login se ve en blanco.
- [ ] Recorrer el login con Tab en los dos modos → el anillo de foco se ve en
      ambos.

## Fuera de alcance

Lo de la §9 del spec, mas dos cosas que aparecieron al verificar:

- `secondary.contrastText` en claro es `#FFFFFF` sobre `#ED5E17`: 3.38:1. Hoy
  no se usa como relleno con texto encima, asi que no rompe nada. Si alguien
  pone texto sobre ese naranja, hay que cambiarlo.
- El punto de color del almacen N3 es `#C10230` sobre la barra `#C10230`:
  invisible. Preexistente, reportado, no se arregla aqui.
