import { Box, Skeleton, Typography } from '@mui/material'

import { REVISION } from './presentacion'

type Cifra = { clave: string; etiqueta: string; valor: number | undefined; color: string }

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
        // Al revés para que el número quede arriba sin invertir el orden del
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
        <Punto color={cifra.color} />
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
        {/* El hueco mide siempre lo mismo: si el número apareciera de golpe, la
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
  resumen: { pendiente: number; resuelto: number; descartado: number } | undefined
}

/**
 * Cuánto queda por revisar, cuánto entró al inventario y cuánto se descartó.
 * Las tres cifras juntas son lo que contesta «¿voy por la mitad?», que en una
 * cola de 337 renglones es la única forma de no perder el hilo.
 */
export function ResumenDepuracion({ resumen }: Props) {
  const cifras: Cifra[] = [
    {
      clave: 'pendiente',
      etiqueta: 'Por revisar',
      valor: resumen?.pendiente,
      color: REVISION.pendiente.color,
    },
    {
      clave: 'resuelto',
      etiqueta: 'Cargados',
      valor: resumen?.resuelto,
      color: REVISION.resuelto.color,
    },
    {
      clave: 'descartado',
      etiqueta: 'Descartados',
      valor: resumen?.descartado,
      color: REVISION.descartado.color,
    },
  ]

  return (
    <Box component="dl" sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 2, m: 0 }}>
      {cifras.map((cifra, i) => (
        <Bloque key={cifra.clave} cifra={cifra} primero={i === 0} />
      ))}
    </Box>
  )
}
