import { Icon } from '@iconify/react'
import {
  Avatar,
  Box,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { Link as EnlaceRuta, Outlet, useLocation } from 'react-router-dom'

import { LogoUAEH } from '@/app/LogoUAEH'
import { aspectoDeAlmacen } from '@/app/almacenes'
import { menuDeNavegacion, type ItemMenu } from '@/app/navegacion'
import { usePerfil } from '@/features/auth/usePerfil'
import { supabase } from '@/lib/supabase'

// Ancho de la barra lateral. En pantallas angostas se queda solo la columna de
// iconos: las maquinas del almacen son de ~1024 px, pero nadie merece una
// pantalla rota si abre el sistema en una laptop chica.
const ANCHO = { xs: 68, md: 248 }
const SOLO_ANCHO = { xs: 'none', md: 'block' } as const

const BORDE = '1px solid rgba(255,255,255,0.18)'

const ESTILO_ITEM = {
  mx: 1,
  my: 0.25,
  px: 1.5,
  minHeight: 44,
  color: 'rgba(255,255,255,0.88)',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.10)' },
  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
  '&.Mui-disabled': { opacity: 0.5 },
}

function ItemNavegacion({ item, activo }: { item: ItemMenu; activo: boolean }) {
  const contenido = (
    <>
      <ListItemIcon sx={{ color: 'inherit', minWidth: 0, mr: { xs: 0, md: 2 } }}>
        <Icon icon={item.icono} width={22} />
      </ListItemIcon>
      <ListItemText
        primary={item.etiqueta}
        slotProps={{ primary: { noWrap: true, sx: { fontWeight: 500 } } }}
        sx={{ display: SOLO_ANCHO, m: 0 }}
      />
    </>
  )

  if (!item.disponible) {
    return (
      // Tooltip necesita un elemento que reciba eventos; un boton deshabilitado
      // no los emite, de ahi el span.
      <Tooltip title={`${item.etiqueta}: se entrega en un hito posterior`} placement="right">
        <span>
          <ListItemButton disabled sx={ESTILO_ITEM}>
            {contenido}
          </ListItemButton>
        </span>
      </Tooltip>
    )
  }

  return (
    <ListItemButton component={EnlaceRuta} to={item.ruta} selected={activo} sx={ESTILO_ITEM}>
      {contenido}
    </ListItemButton>
  )
}

export function Layout() {
  const { data: perfil } = usePerfil()
  const qc = useQueryClient()
  const { pathname } = useLocation()

  const almacen = aspectoDeAlmacen(perfil?.almacen?.clave)

  async function salir() {
    await supabase.auth.signOut()
    // Sin esto, el siguiente usuario que entre en la misma pestana ve por un
    // instante los datos en cache del anterior.
    qc.clear()
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        component="nav"
        aria-label="Secciones del sistema"
        sx={{
          width: ANCHO,
          flexShrink: 0,
          bgcolor: 'primary.main',
          color: 'common.white',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100dvh',
        }}
      >
        <Stack spacing={1.25} sx={{ p: { xs: 1, md: 2 }, borderBottom: BORDE }}>
          {/* Monograma blanco, sin placa: asi el logo se integra en el guinda
              en vez de vivir en un parche que ocupaba los 216 px de la barra
              para dibujar 83. Los 16 px de padding de la cabecera ya son mas
              resguardo del que la marca pide. En xs mide 46 px de ancho y
              cabe en los 52 utiles de la barra angosta. */}
          <LogoUAEH
            variante="marca"
            blanco
            alto={{ xs: 18, md: 30 }}
            sx={{ alignSelf: { xs: 'center', md: 'flex-start' } }}
          />
          <Box sx={{ display: SOLO_ANCHO }}>
            <Typography component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              SIGREM-LAB
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              Unidad Central de Laboratorios
            </Typography>
          </Box>
        </Stack>

        {/* component="div": los items deshabilitados van envueltos en un span
            para el Tooltip, y un span no es hijo valido de <ul>. */}
        <List component="div" sx={{ py: 1.5 }}>
          {menuDeNavegacion(perfil?.rol).map((item) => (
            <ItemNavegacion key={item.ruta} item={item} activo={pathname === item.ruta} />
          ))}
        </List>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ p: 1.5, borderTop: BORDE }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 0.5, pb: 1 }}>
            <Avatar
              sx={{ width: 34, height: 34, bgcolor: 'rgba(255,255,255,0.2)', color: 'common.white' }}
            >
              <Icon icon="mdi:account" width={20} />
            </Avatar>
            <Box sx={{ display: SOLO_ANCHO, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {perfil?.nombre ?? '—'}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: almacen.color, flexShrink: 0 }}
                />
                <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  {perfil?.almacen?.clave ?? '—'} · {perfil?.rol ?? ''}
                </Typography>
              </Stack>
            </Box>
          </Stack>

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
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
        <Outlet />
      </Box>
    </Box>
  )
}
