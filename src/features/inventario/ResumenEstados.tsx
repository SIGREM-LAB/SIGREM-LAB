import { Box, Skeleton, Typography } from '@mui/material'

import { ESTADO } from './presentacion'

type Cifra = { clave: string; etiqueta: string; valor: number | undefined; color?: string }

/**
 * El numero va en la tinta del tema y el color del estado se pinta como punto,
 * no como color del numero. Es la misma decision que ya esta razonada en
 * `presentacion.ts`: `#2E7D32` sobre el papel oscuro da 2.8:1 e ilegible, y
 * mantener el par de colores por estado y por modo cuesta mas de lo que aporta.
 */
function Punto({ color }: { color: string }) {
  return (
    <Box
      component="span"
      sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }}
    />
  )
}

function Bloque({ cifra, primero }: { cifra: Cifra; primero: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        // Al reves para que el numero quede arriba sin invertir el orden del
        // documento: un lector de pantalla sigue leyendo etiqueta y luego dato.
        flexDirection: 'column-reverse',
        pr: { xs: 2.5, md: 3.5 },
        pl: primero ? 0 : { xs: 2.5, md: 3.5 },
        borderLeft: primero ? undefined : '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        component="dt"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          mt: 0.25,
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1.6,
          color: 'text.secondary',
          whiteSpace: 'nowrap',
        }}
      >
        {cifra.color === undefined ? null : <Punto color={cifra.color} />}
        {cifra.etiqueta}
      </Typography>

      <Typography
        component="dd"
        sx={{
          m: 0,
          fontSize: '1.375rem',
          fontWeight: 700,
          lineHeight: '26px',
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* El hueco mide siempre lo mismo: si el numero apareciera de golpe, la
            cabecera crecería y empujaría la tabla al terminar de cargar. */}
        {cifra.valor === undefined ? (
          <Skeleton variant="text" width={52} sx={{ fontSize: '1.375rem' }} />
        ) : (
          cifra.valor.toLocaleString('es-MX')
        )}
      </Typography>
    </Box>
  )
}

type Props = {
  resumen:
    | { total: number; disponible: number; stockBajo: number; agotado: number; mantenimiento: number }
    | undefined
}

/**
 * La franja de cifras de la cabecera. `resumen` en `undefined` dibuja los cinco
 * huecos con su medida final, asi que la pantalla no se mueve cuando llegan.
 */
export function ResumenEstados({ resumen }: Props) {
  const cifras: Cifra[] = [
    { clave: 'total', etiqueta: 'Existencias', valor: resumen?.total },
    {
      clave: 'disponible',
      etiqueta: 'Disponibles',
      valor: resumen?.disponible,
      color: ESTADO.disponible.color,
    },
    {
      clave: 'stock_bajo',
      etiqueta: 'Stock bajo',
      valor: resumen?.stockBajo,
      color: ESTADO.stock_bajo.color,
    },
    {
      clave: 'agotado',
      etiqueta: 'Agotadas',
      valor: resumen?.agotado,
      color: ESTADO.agotado.color,
    },
    {
      clave: 'mantenimiento',
      etiqueta: 'Mantenimiento',
      valor: resumen?.mantenimiento,
      color: ESTADO.mantenimiento.color,
    },
  ]

  return (
    <Box
      component="dl"
      sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 2, m: 0 }}
    >
      {cifras.map((cifra, i) => (
        <Bloque key={cifra.clave} cifra={cifra} primero={i === 0} />
      ))}
    </Box>
  )
}
