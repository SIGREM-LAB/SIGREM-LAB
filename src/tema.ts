import { createTheme } from '@mui/material/styles'

/**
 * Paleta institucional de la UAEH y densidad del prototipo aprobado. Los
 * colores viven aqui y solo aqui: en los componentes se usan como
 * `color="primary"` o `sx={{ color: 'primary.main' }}`. Un hex suelto en un
 * componente no se puede cambiar de golpe.
 */
export const tema = createTheme({
  palette: {
    primary:   { main: '#C10230', dark: '#A21A19', light: '#E14A66', contrastText: '#FFFFFF' },
    secondary: { main: '#ED5E17', light: '#FF8300', contrastText: '#FFFFFF' },
    error:     { main: '#A21A19' },
    text:      { primary: '#202226', secondary: '#6F6F6E' },
    divider:   '#E4E6EA',
    grey:      { 600: '#6F6F6E' },
    background: { default: '#F5F6F8', paper: '#FFFFFF' },
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
        // El sistema del usuario puede estar en modo oscuro. Sin esta linea el
        // navegador pinta en oscuro lo que dibuja el, no MUI: barras de scroll,
        // campos autocompletados y menus nativos. Eso fue la pantalla negra.
        ':root': { colorScheme: 'light' },
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
      defaultProps: { disableElevation: true },
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
