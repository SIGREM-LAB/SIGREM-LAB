import type { ReactNode } from 'react'
import { Box, Card, LinearProgress, Stack, Typography } from '@mui/material'

type Props = {
  titulo: string
  /** De qué cuelga esta columna: el programa elegido, la asignatura elegida. */
  subtitulo?: string
  cargando: boolean
  /** Qué decir cuando no hay nada que listar. */
  vacio: string
  /** Los botones del pie. */
  acciones?: ReactNode
  children?: ReactNode
}

/**
 * El cascarón de las tres columnas de la cascada.
 *
 * Existe porque las tres comparten exactamente esto —título, subtítulo, lista
 * con scroll propio, estado vacío y pie de acciones— y difieren sólo en el
 * contenido. Copiado tres veces, a la segunda ya habría divergido.
 *
 * El scroll es de la columna y no de la página: con tres listas de largos
 * distintos, un scroll único obligaría a bajar la página entera para ver el pie
 * de la tercera.
 */
export function ColumnaAcademica({ titulo, subtitulo, cargando, vacio, acciones, children }: Props) {
  const sinContenido = children === null || children === undefined

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: { md: '68vh' } }}>
      <Box sx={{ px: 2, pt: 1.75, pb: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h2" sx={{ fontSize: '0.95rem' }}>
          {titulo}
        </Typography>
        {subtitulo === undefined ? null : (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.25 }}>
            {subtitulo}
          </Typography>
        )}
      </Box>

      {/* Barra y no spinner centrado: la columna ya tiene contenido debajo y un
          spinner en medio lo taparía en cada refresco. */}
      {cargando ? <LinearProgress /> : null}

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 160 }}>
        {sinContenido && !cargando ? (
          <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', p: 3 }}>
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', fontSize: '0.85rem' }}>
              {vacio}
            </Typography>
          </Stack>
        ) : (
          children
        )}
      </Box>

      {acciones === undefined ? null : (
        <Stack
          direction="row"
          spacing={1}
          sx={{ p: 1.25, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}
        >
          {acciones}
        </Stack>
      )}
    </Card>
  )
}
