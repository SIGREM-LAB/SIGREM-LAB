import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

/**
 * Logo institucional de la UAEH.
 *
 * El archivo (`public/logo-uaeh.webp`, 860 x 392) trae dos piezas: el
 * monograma en las filas 0-334 y la firma "Universidad Autonoma del Estado de
 * Hidalgo" en las 355-391, que son apenas el 9.4% del alto. Por debajo de unos
 * 105 px de alto total esa firma se pinta a menos de 10 px y deja de leerse:
 * el logo completo solo sirve en grande. En chico va el monograma solo, que se
 * recorta de este mismo archivo cortando en la fila 335.
 *
 * El arte toca los cuatro bordes del archivo: no trae margen propio. La zona
 * de resguardo -un tercio del alto del monograma- la da quien lo coloca.
 */

/** Relacion del logo completo. */
const COMPLETO = '860 / 392'
/** Relacion del monograma solo: 335 es la fila donde termina. */
const MARCA = '860 / 335'

const ARCHIVO = '/logo-uaeh.webp'
const NOMBRE = 'Universidad Autónoma del Estado de Hidalgo'

type Props = {
  /** Alto en px. Acepta el objeto responsivo de MUI: `{ xs: 18, md: 30 }`. */
  alto: number | Record<string, number>
  /** `marca` recorta la firma; `completo` la conserva. */
  variante?: 'marca' | 'completo'
  /** Tine el logo de blanco, para fondos de color donde su guinda no contrasta. */
  blanco?: boolean
  /** Sin nombre accesible, para cuando la pantalla ya anuncia el logo en otro lado. */
  decorativo?: boolean
  sx?: SxProps<Theme>
}

/**
 * `width` y `height` intrinsecos: sin ellos el navegador no reserva el hueco y
 * la pantalla salta cuando la imagen termina de cargar.
 */
function Imagen({ alt, sx }: { alt: string; sx: SxProps<Theme> }) {
  return <Box component="img" src={ARCHIVO} width={860} height={392} alt={alt} sx={sx} />
}

export function LogoUAEH({ alto, variante = 'completo', blanco, decorativo, sx }: Props) {
  const alt = decorativo ? '' : NOMBRE
  const tinte = blanco ? { filter: 'brightness(0) invert(1)' } : {}
  // Sin esto se estira: dentro de un Stack en columna el `align-items: stretch`
  // de flex le gana al ancho que sale de la relacion de aspecto.
  const propio = { alignSelf: 'flex-start', flexShrink: 0 } as const
  const extra = Array.isArray(sx) ? sx : [sx]

  if (variante === 'completo') {
    return (
      <Imagen
        alt={alt}
        sx={[
          { display: 'block', height: alto, width: 'auto', aspectRatio: COMPLETO, ...propio, ...tinte },
          ...extra,
        ]}
      />
    )
  }

  return (
    <Box sx={[{ height: alto, aspectRatio: MARCA, overflow: 'hidden', ...propio }, ...extra]}>
      <Imagen
        alt={alt}
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top',
          ...tinte,
        }}
      />
    </Box>
  )
}
