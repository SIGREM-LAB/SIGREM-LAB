import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Divider,
  Drawer,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'

import { mensajeDeError, type DetallePractica, type ElementoDetalle } from './consultas'
import type { Funcionamiento } from './esquemas'

type Props = {
  detalle: DetallePractica | undefined
  cargando: boolean
  error: unknown
  onCerrar: () => void
}

const ESTADO_EQUIPO: Record<Funcionamiento, string> = {
  correcto: 'correcto',
  presenta_fallas: 'presenta fallas',
}

/** Un número de la base sin los ceros que arrastra `numeric(14,4)`. */
function comoNumero(valor: number | null): string {
  if (valor === null) return '—'
  return String(Number(valor))
}

/**
 * Qué se dice de un producto depende de su método, y de nada más.
 *
 * Recorrer el método en vez de volcar todos los campos es la misma propiedad que
 * hace que el payload de `registrar_practica` no lleve campos de otro método: un
 * reactivo no tiene cantidades que enseñar, y enseñarlas como "—" sería inventar
 * una columna vacía en lugar de omitir la que no aplica.
 */
function loQuePaso(elemento: ElementoDetalle, unidad: string): string {
  if (elemento.metodo_control === 'peso') {
    return `Consumió ${comoNumero(elemento.consumo)} ${unidad}`
  }

  if (elemento.metodo_control === 'cantidad') {
    const entregó = comoNumero(elemento.cantidad_entregada)
    const devolvió = comoNumero(elemento.cantidad_devuelta)
    const dañó = comoNumero(elemento.cantidad_danada)
    return `Entregó ${entregó}, devolvió ${devolvió}, dañó ${dañó}`
  }

  const salida = elemento.estado_salida === null ? '—' : ESTADO_EQUIPO[elemento.estado_salida]
  const vuelta =
    elemento.estado_devolucion === null ? '—' : ESTADO_EQUIPO[elemento.estado_devolucion]
  return `Salió ${salida}, volvió ${vuelta}`
}

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

export function PanelPractica({ detalle, cargando, error, onCerrar }: Props) {
  const fallo = error !== null && error !== undefined

  return (
    <Drawer
      anchor="right"
      open
      onClose={onCerrar}
      // El rol y el nombre van en el papel y no en la raíz, por lo mismo que en
      // PanelExistencia: la raíz del Drawer lleva role="presentation", así que
      // un aria-labelledby ahí no nombra nada.
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'practica-titulo',
          sx: { width: { xs: '100%', sm: 420 }, p: 2.5 },
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 2 }}>
        <Typography
          id="practica-titulo"
          sx={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'primary.main',
          }}
        >
          {detalle?.folio ?? 'Práctica'}
        </Typography>
        <IconButton aria-label="Cerrar" onClick={onCerrar}>
          <Icon icon="mdi:close" />
        </IconButton>
      </Stack>

      {fallo ? (
        <Alert severity="error">No se pudo cargar la práctica. {mensajeDeError(error)}</Alert>
      ) : null}

      {cargando ? <Skeleton variant="rounded" height={220} /> : null}

      {detalle === undefined ? null : (
        <Box>
          <Stack spacing={0.5}>
            <Dato etiqueta="Fecha" valor={detalle.fecha} />
            <Dato etiqueta="Programa" valor={detalle.programa?.nombre ?? '—'} />
            <Dato etiqueta="Asignatura" valor={detalle.asignatura?.nombre ?? '—'} />
            <Dato
              etiqueta="Práctica"
              valor={
                detalle.catalogo === null
                  ? '—'
                  : `${detalle.catalogo.numero} · ${detalle.catalogo.nombre}`
              }
            />
            <Dato etiqueta="Laboratorio" valor={detalle.laboratorio.nombre} />
            <Dato etiqueta="Registró" valor={detalle.responsable.nombre} />
          </Stack>

          {detalle.observaciones === null ? null : (
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              {detalle.observaciones}
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h2" sx={{ color: 'institucional.main', mb: 1 }}>
            {`Productos (${detalle.practica_elemento.length})`}
          </Typography>

          <Stack spacing={1.5}>
            {detalle.practica_elemento.map((elemento) => {
              const articulo = elemento.existencia.articulo
              return (
                <Box key={elemento.id}>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: 'monospace', color: 'institucional.main' }}
                  >
                    {elemento.existencia.codigo}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {articulo.nombre_canonico}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {loQuePaso(elemento, articulo.unidad_base)}
                  </Typography>
                  {elemento.observaciones === null ? null : (
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      {elemento.observaciones}
                    </Typography>
                  )}
                </Box>
              )
            })}
          </Stack>
        </Box>
      )}
    </Drawer>
  )
}
