import type { ReactNode } from 'react'
import { Icon } from '@iconify/react'
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material'
import { Link as EnlaceRuta } from 'react-router-dom'

type Props = {
  titulo: string
  descripcion?: string
  /** La pantalla de la que cuelga esta. Si falta, no se dibuja la migaja. */
  padre?: { etiqueta: string; ruta: string }
  /** Botones de la esquina derecha. */
  acciones?: ReactNode
  /** Franja de datos bajo el título: las cifras del inventario, por ejemplo. */
  children?: ReactNode
}

/**
 * La cabecera de cada pantalla, a sangre contra la barra lateral.
 *
 * Va en papel y no sobre el fondo de la página a proposito: asi el titulo se
 * apoya en una superficie y no flota, que era justo lo que hacia ver simple al
 * encabezado anterior. El borde inferior es lo unico que la separa del cuerpo;
 * sin sombra, igual que las tarjetas del tema.
 *
 * `<main>` ya no trae padding: lo pone cada pantalla con `CuerpoPagina`. Sin
 * eso la cabecera no podria llegar a los bordes.
 */
export function EncabezadoPagina({ titulo, descripcion, padre, acciones, children }: Props) {
  return (
    <Box
      component="header"
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: { xs: 2, md: 4 },
        pt: { xs: 2, md: 2.5 },
        pb: { xs: 2, md: 2.25 },
      }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          {padre === undefined ? null : (
            <Breadcrumbs
              aria-label="Ruta de la pantalla"
              separator={<Icon icon="mdi:chevron-right" width={14} aria-hidden />}
              sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.75 }}
            >
              <Box
                component={EnlaceRuta}
                to={padre.ruta}
                sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {padre.etiqueta}
              </Box>
              {/* aria-current="page" es lo que hace que un lector de pantalla
                  diga "pagina actual" en vez de leer un enlace mas. */}
              <Typography
                component="span"
                aria-current="page"
                sx={{ fontSize: 'inherit', fontWeight: 600, color: 'text.primary' }}
              >
                {titulo}
              </Typography>
            </Breadcrumbs>
          )}

          <Typography variant="h1">{titulo}</Typography>

          {descripcion === undefined ? null : (
            <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{descripcion}</Typography>
          )}
        </Box>

        {acciones === undefined ? null : (
          <Stack
            direction="row"
            spacing={1}
            sx={{ ml: 'auto', flexShrink: 0, alignItems: 'center', pt: { xs: 1, sm: 0 } }}
          >
            {acciones}
          </Stack>
        )}
      </Stack>

      {children === undefined ? null : <Box sx={{ mt: 2.25 }}>{children}</Box>}
    </Box>
  )
}

/**
 * El cuerpo de la pantalla, con el respiro que antes ponia `<main>`. Existe
 * para que ese numero viva en un solo sitio y las dos pantallas respiren igual.
 */
export function CuerpoPagina({ children }: { children: ReactNode }) {
  return <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>{children}</Box>
}
