import { Icon } from '@iconify/react'
import {
  Box,
  Card,
  CardContent,
  List,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/material'
import { Link as EnlaceRuta } from 'react-router-dom'

import { aspectoDeAlmacen } from '@/app/almacenes'
import type { ResumenAlmacen } from './menu'

type Props = {
  almacenes: ResumenAlmacen[]
  titulo: string
  subtitulo: string
}

/**
 * La lista de al lado del bloque grande.
 *
 * Cada renglón lleva al inventario ya filtrado por ese almacén: es un enlace de
 * verdad, así que se abre en pestaña nueva con el clic de en medio y se recorre
 * con Tab, cosa que un `div` con `onClick` no hace.
 */
export function OtrosAlmacenes({ almacenes, titulo, subtitulo }: Props) {
  return (
    <Card sx={{ height: '100%' }}>
      {/* El relleno de abajo va con el mismo selector que usa el tema
          (`&:last-child`, 24 px): un `pb` suelto tiene menos especificidad y se
          ignora sin avisar. Aquí se recorta porque el último renglón de la
          lista ya trae su propio aire. */}
      <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
        <Typography variant="h3">{titulo}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {subtitulo}
        </Typography>

        <List sx={{ mt: 1, py: 0 }}>
          {almacenes.map((almacen) => {
            const aspecto = aspectoDeAlmacen(almacen.clave)

            return (
              <ListItemButton
                key={almacen.id}
                component={EnlaceRuta}
                to="/inventario"
                state={{ almacenId: almacen.id }}
                sx={{ px: 1, py: 1.25, gap: 1.25 }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: aspecto.color,
                    flexShrink: 0,
                  }}
                />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {almacen.clave}
                  </Typography>
                  <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary' }}>
                    {almacen.nombre}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
                  <Typography
                    sx={{ fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {almacen.total.toLocaleString('es-MX')}
                  </Typography>
                  <Box sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                    <Icon icon="mdi:chevron-right" width={18} aria-hidden />
                  </Box>
                </Stack>
              </ListItemButton>
            )
          })}
        </List>
      </CardContent>
    </Card>
  )
}
