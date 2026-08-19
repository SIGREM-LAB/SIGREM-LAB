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
  /**
   * `createTheme` siempre devuelve el tipo `Theme`, sin importar si le pasas
   * `cssVariables` en tiempo de ejecucion: el tipo de retorno no puede
   * depender de un valor. Esta aumentacion es el interruptor que usa MUI para
   * el caso contrario: sin ella, `tema.colorSchemes` no existe para
   * TypeScript aunque exista en tiempo de ejecucion.
   */
  interface CssThemeVariables {
    enabled: true
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
