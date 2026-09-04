import { Icon } from '@iconify/react'
import {
  Avatar,
  Box,
  Button,
  Divider,
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

import { BotonTema } from '@/app/BotonTema'
import { LogoUAEH } from '@/app/LogoUAEH'
import { aspectoDeAlmacen } from '@/app/almacenes'
import { GRUPOS, menuDeNavegacion, type ItemMenu } from '@/app/navegacion'
import { usePerfil } from '@/features/auth/usePerfil'
import { supabase } from '@/lib/supabase'

// Ancho de la barra lateral. En pantallas angostas se queda solo la columna de
// iconos: las maquinas del almacen son de ~1024 px, pero nadie merece una
// pantalla rota si abre el sistema en una laptop chica.
const ANCHO = { xs: 68, md: 248 }
const SOLO_ANCHO = { xs: 'none', md: 'block' } as const

const BORDE = '1px solid rgba(255,255,255,0.18)'

/**
 * El item activo se pinta en blanco con el texto en guinda, no con un velo
 * blanco encima del guinda: sobre un fondo de color, un `rgba` al 18% se lee
 * desde cerca y desaparece desde la silla de al lado. Invertido no hay duda de
 * en que pantalla estas.
 */
const ESTILO_ITEM = {
  mx: 1,
  my: 0.25,
  px: 1.5,
  minHeight: 44,
  color: 'rgba(255,255,255,0.88)',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.10)' },
  '&.Mui-selected, &.Mui-selected:hover': {
    bgcolor: 'common.white',
    color: 'institucional.main',
    fontWeight: 600,
  },
  '&.Mui-disabled': { opacity: 0.62 },
}

/** Marca de "esta pantalla llega despues", al final del renglon. */
function EtiquetaPronto() {
  return (
    <Box
      component="span"
      sx={{
        display: SOLO_ANCHO,
        flexShrink: 0,
        ml: 1,
        px: 0.75,
        py: 0.25,
        borderRadius: 1.5,
        bgcolor: 'rgba(255,255,255,0.2)',
        fontSize: '0.625rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        lineHeight: 1.6,
      }}
    >
      PRONTO
    </Box>
  )
}

/**
 * Una pantalla que cuelga de otra deja marcada a la madre. Con la comparacion
 * exacta que habia antes, estar en `/inventario/depuracion` apagaba la barra
 * entera y no quedaba ni un item senalado: al volver la vista a la izquierda no
 * habia forma de saber en que seccion se esta.
 *
 * El `/` final del prefijo es lo que impide que `/inventario` marque tambien a
 * un hipotetico `/inventario-general`, que es otra seccion.
 */
function esActivo(pathname: string, ruta: string): boolean {
  return pathname === ruta || pathname.startsWith(`${ruta}/`)
}

function ItemNavegacion({ item, activo }: { item: ItemMenu; activo: boolean }) {
  const contenido = (
    <>
      <ListItemIcon sx={{ color: 'inherit', minWidth: 0, mr: { xs: 0, md: 2 } }}>
        <Icon icon={item.icono} width={22} />
      </ListItemIcon>
      <ListItemText
        primary={item.etiqueta}
        slotProps={{ primary: { noWrap: true, sx: { fontWeight: activo ? 600 : 500 } } }}
        sx={{ display: SOLO_ANCHO, m: 0 }}
      />
      {item.disponible ? null : <EtiquetaPronto />}
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
    <ListItemButton
      component={EnlaceRuta}
      to={item.ruta}
      selected={activo}
      // `selected` pinta, pero no dice nada: sin aria-current un lector de
      // pantalla anuncia cinco enlaces iguales.
      aria-current={activo ? 'page' : undefined}
      sx={ESTILO_ITEM}
    >
      {contenido}
    </ListItemButton>
  )
}

export function Layout() {
  const { data: perfil } = usePerfil()
  const qc = useQueryClient()
  const { pathname } = useLocation()

  const almacen = aspectoDeAlmacen(perfil?.almacen?.clave)
  const menu = menuDeNavegacion(perfil?.rol)

  async function salir() {
    await supabase.auth.signOut()
    // Sin esto, el siguiente usuario que entre en la misma pestana ve por un
    // instante los datos en cache del anterior.
    qc.clear()
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* Saltar la navegacion: son cinco enlaces que se repiten en cada
          pantalla, y quien anda con teclado los recorre completos cada vez. */}
      <Box
        component="a"
        href="#contenido"
        sx={{
          position: 'absolute',
          left: 8,
          top: -64,
          zIndex: 'tooltip',
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: 'background.paper',
          color: 'primary.main',
          fontWeight: 600,
          textDecoration: 'none',
          '&:focus': { top: 8 },
        }}
      >
        Ir al contenido
      </Box>

      <Box
        component="nav"
        aria-label="Secciones del sistema"
        sx={{
          width: ANCHO,
          flexShrink: 0,
          bgcolor: 'institucional.main',
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
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.82)' }}>
              Unidad Central de Laboratorios
            </Typography>
          </Box>
        </Stack>

        {/* component="div": los items deshabilitados van envueltos en un span
            para el Tooltip, y un span no es hijo valido de <ul>. */}
        <List component="div" sx={{ py: 1.5 }}>
          {GRUPOS.map((grupo, i) => {
            const items = menu.filter((item) => item.grupo === grupo.id)
            if (items.length === 0) return null

            return (
              <Box key={grupo.id}>
                <Typography
                  component="p"
                  variant="overline"
                  sx={{
                    display: SOLO_ANCHO,
                    px: 2.5,
                    mt: i === 0 ? 0.5 : 2,
                    mb: 0.5,
                    fontSize: '0.6875rem',
                    lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.82)',
                  }}
                >
                  {grupo.etiqueta}
                </Typography>

                {/* En la barra angosta no cabe el rotulo; la raya hace el mismo
                    trabajo de separar los dos bloques. */}
                {i === 0 ? null : (
                  <Divider
                    sx={{ display: { xs: 'block', md: 'none' }, mx: 1.5, my: 1, borderColor: 'rgba(255,255,255,0.18)' }}
                  />
                )}

                {items.map((item) => (
                  <ItemNavegacion key={item.ruta} item={item} activo={esActivo(pathname, item.ruta)} />
                ))}
              </Box>
            )
          })}
        </List>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ p: 1.5, borderTop: BORDE }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              alignItems: 'center',
              p: { xs: 0.5, md: 0.875 },
              borderRadius: 2,
              bgcolor: { xs: 'transparent', md: 'rgba(255,255,255,0.10)' },
            }}
          >
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
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: almacen.color,
                    // El guinda de N3 es el mismo color de la barra: sin este
                    // aro, el punto de su propio almacen no se ve.
                    boxShadow: '0 0 0 1.5px rgba(255,255,255,0.7)',
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.82)' }}>
                  {perfil?.almacen?.clave ?? '—'} · {perfil?.rol ?? ''}
                </Typography>
              </Stack>
            </Box>
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={0.5}
            sx={{ alignItems: 'center', mt: 1 }}
          >
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

            {/* En la barra angosta los dos controles se apilan: 52 px utiles no
                dan para ponerlos en fila. */}
            <BotonTema
              sx={{
                color: 'rgba(255,255,255,0.9)',
                flexShrink: 0,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.10)' },
              }}
            />
          </Stack>
        </Box>
      </Box>

      {/* Sin padding: la cabecera de cada pantalla va a sangre contra la barra,
          y el respiro lo pone `CuerpoPagina`. tabIndex -1 es lo que deja que el
          enlace de salto aterrice aqui. */}
      <Box component="main" id="contenido" tabIndex={-1} sx={{ flex: 1, minWidth: 0, outline: 'none' }}>
        <Outlet />
      </Box>
    </Box>
  )
}
