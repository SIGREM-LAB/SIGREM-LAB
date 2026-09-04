import { Icon } from '@iconify/react'
import { Box, Card, CardContent, Grid, Stack, Typography } from '@mui/material'

import type { ItemMenu } from '@/app/navegacion'

/**
 * Las pantallas que faltan, dichas con todas sus letras.
 *
 * Salen de `menuDeNavegacion`, la misma lista que dibuja la barra lateral: si
 * mañana Prácticas se entrega, basta con marcarla disponible en un sitio y
 * desaparece de aquí sola.
 *
 * No son botones: no hay nada que pulsar todavía, y un control apagado que
 * ocupa media pantalla invita a intentarlo una y otra vez. Son tarjetas que
 * cuentan qué va a haber.
 */
export function AtajosPendientes({ items }: { items: ItemMenu[] }) {
  if (items.length === 0) return null

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid key={item.ruta} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: item.color,
                    color: 'common.white',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    // Apagado como el resto de la tarjeta: la placa de color a
                    // plena intensidad se lee como si la pantalla ya existiera.
                    opacity: 0.72,
                  }}
                >
                  <Icon icon={item.icono} width={22} aria-hidden />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                    {item.etiqueta}
                  </Typography>
                  <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                    {item.descripcion}
                  </Typography>
                </Box>

                <Box
                  component="span"
                  sx={{
                    flexShrink: 0,
                    px: 0.875,
                    py: 0.375,
                    borderRadius: 1.5,
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  PRONTO
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
