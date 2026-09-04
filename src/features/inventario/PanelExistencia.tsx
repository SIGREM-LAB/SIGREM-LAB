import { Icon } from '@iconify/react'
import { Alert, Box, Divider, Drawer, IconButton, Skeleton, Stack, Typography } from '@mui/material'

import { aspectoDeAlmacen } from '@/app/almacenes'
import { DetalleTipo, type DatosTipo } from './DetalleTipo'
import { aspectoDeEstado, cortarNombre } from './presentacion'
import type { Fila } from './TablaExistencias'

/**
 * El historial que pinta el panel. Se declara aquí, junto a quien lo consume, y
 * no en `consultas.ts`: si viviera allá, este componente tendría que importar el
 * módulo que trae al cliente de Supabase, y dejaría de poder probarse con
 * arreglos planos.
 */
export type Movimiento = {
  id: number
  tipo: string
  cantidad: number
  cantidad_despues: number
  ocurrido_en: string
  motivo: string | null
}

type Props = {
  fila: Fila | null
  almacenPropio: number | null
  movimientos: Movimiento[]
  cargandoMovimientos: boolean
  /** Los campos propios del tipo. `null` mientras su consulta esta en vuelo. */
  datosTipo: DatosTipo | null
  onCerrar: () => void
}

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', width: 104, flexShrink: 0 }}>
        {etiqueta}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {valor}
      </Typography>
    </Stack>
  )
}

export function PanelExistencia({
  fila,
  almacenPropio,
  movimientos,
  cargandoMovimientos,
  datosTipo,
  onCerrar,
}: Props) {
  if (fila === null) return null

  const { cabeza, resto } = cortarNombre(fila.nombre_canonico ?? '')
  const aspecto = aspectoDeAlmacen(fila.almacen_clave)
  const ajeno = almacenPropio !== null && fila.almacen_id !== almacenPropio
  const unidad = fila.unidad_base ?? ''

  return (
    <Drawer
      anchor="right"
      open
      onClose={onCerrar}
      // Drawer ya atrapa el foco y lo devuelve al control que lo abrió, pero no
      // se anuncia como diálogo: su raíz lleva `role="presentation"`, así que un
      // `aria-labelledby` puesto ahí no nombra nada. El rol y el nombre van en
      // el panel, que es lo que de verdad es el diálogo.
      //
      // El nombre es el código, que es el identificador que la gente de almacén
      // lee en la etiqueta del frasco.
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'detalle-titulo',
          sx: { width: { xs: '100%', sm: 380 }, p: 2.5 },
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id="detalle-titulo"
            sx={{
              fontFamily: 'monospace',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'primary.main',
            }}
          >
            {fila.codigo}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {cabeza}
          </Typography>
          {resto !== '' && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {resto}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onCerrar} aria-label="Cerrar el detalle" size="small">
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </Stack>

      {ajeno && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Pertenece a {fila.almacen_clave}. Puedes consultarla, no modificarla.
        </Alert>
      )}

      <Stack spacing={1} sx={{ mb: 2 }}>
        <Dato
          etiqueta="Existencia"
          valor={fila.cantidad === null ? '—' : `${fila.cantidad} ${unidad}`.trim()}
        />
        <Dato etiqueta="Estado" valor={aspectoDeEstado(fila.estado).etiqueta} />
        <Dato etiqueta="Marca" valor={fila.marca ?? '—'} />
        {fila.descripcion !== null && <Dato etiqueta="Descripción" valor={fila.descripcion} />}
        <Dato etiqueta="Ubicación" valor={fila.ubicacion ?? '—'} />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', width: 104, flexShrink: 0 }}>
            Almacén
          </Typography>
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: aspecto.color,
              color: 'common.white',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {fila.almacen_clave}
          </Box>
        </Stack>
      </Stack>

      <DetalleTipo clasificacion={fila.clasificacion} datos={datosTipo} />

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Movimientos
      </Typography>

      {cargandoMovimientos && <Skeleton variant="rounded" height={72} sx={{ mt: 1 }} />}

      {!cargandoMovimientos && movimientos.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Todavía no hay movimientos registrados.
        </Typography>
      )}

      <Stack spacing={1.5} sx={{ mt: 1 }}>
        {movimientos.map((m) => (
          <Box key={m.id}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                {m.tipo.replace('_', ' ')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color: m.cantidad >= 0 ? 'success.main' : 'text.primary',
                }}
              >
                {`${m.cantidad > 0 ? '+' : ''}${m.cantidad} ${unidad}`.trim()}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {FECHA.format(new Date(m.ocurrido_en))}
              {m.motivo !== null && ` · ${m.motivo}`}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Drawer>
  )
}
