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
