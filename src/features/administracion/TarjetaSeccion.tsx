import { Icon } from '@iconify/react'
import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material'
import { Link as EnlaceRuta } from 'react-router-dom'

import type { ItemMenu } from '@/app/navegacion'

/**
 * Una sección del índice de Administración.
 *
 * Misma anatomía que las tarjetas del menú principal —placa de color, etiqueta,
 * una línea de qué se hace ahí— pero éstas sí llevan a algún lado, así que la
 * superficie pulsable es la tarjeta entera y no un botón dentro. A plena
 * intensidad y sin la opacidad de `AtajosPendientes`: aquella apaga el color
 * porque la pantalla no existe todavía, y aquí todas existen.
 */
export function TarjetaSeccion({ item }: { item: ItemMenu }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={EnlaceRuta} to={item.ruta} sx={{ height: '100%', p: 2.25 }}>
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
            }}
          >
            <Icon icon={item.icono} width={22} aria-hidden />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>{item.etiqueta}</Typography>
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
              {item.descripcion}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  )
}
