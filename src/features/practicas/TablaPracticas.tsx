import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'

import { mensajeDeError } from './consultas'
import type { EstadoPractica, FilaHistorial } from './historial'

type Props = {
  filas: FilaHistorial[]
  cargando: boolean
  /**
   * Lo que falló al consultar, si algo falló. Explícito por lo mismo que en el
   * diálogo de búsqueda: sin él una consulta rota llega como cero filas y se
   * anuncia como "todavía no hay prácticas", que es una afirmación sobre el
   * almacén y no sobre la consulta.
   */
  error: unknown
  onVer: (practicaId: number) => void
  onContinuar: () => void
  onDescartar: () => void
}

/**
 * El color no es decoración: separa lo que todavía se puede perder de lo que ya
 * es un hecho registrado. Es la misma distinción que en la base separa
 * `practica_borrador` de `practica`.
 */
const ASPECTO: Record<EstadoPractica, { etiqueta: string; color: 'warning' | 'success' }> = {
  en_curso: { etiqueta: 'En curso', color: 'warning' },
  finalizada: { etiqueta: 'Finalizada', color: 'success' },
}

/** `2026-09-08` → `08/09/2026`, sin arrastrar una librería de fechas por esto. */
function comoFecha(iso: string | null): string {
  if (iso === null) return '—'
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

export function TablaPracticas({
  filas,
  cargando,
  error,
  onVer,
  onContinuar,
  onDescartar,
}: Props) {
  const fallo = error !== null && error !== undefined
  const vacio = !cargando && !fallo && filas.length === 0

  return (
    <Box>
      {cargando ? <LinearProgress /> : null}

      {fallo ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudo cargar el historial. {mensajeDeError(error)}
        </Alert>
      ) : null}

      {vacio ? (
        <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
          <Icon icon="mdi:flask-empty-outline" width={40} aria-hidden />
          <Typography sx={{ color: 'text.secondary' }}>Todavía no hay prácticas</Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center' }}>
            Las que registres en tu almacén aparecerán aquí.
          </Typography>
        </Stack>
      ) : null}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Folio</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Asignatura</TableCell>
              <TableCell>Laboratorio</TableCell>
              <TableCell align="right">Productos</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>

          <TableBody>
            {filas.map((fila) => {
              const aspecto = ASPECTO[fila.estado]
              const enCurso = fila.estado === 'en_curso'

              return (
                <TableRow key={fila.clave} hover>
                  <TableCell sx={{ fontFamily: 'monospace', color: 'institucional.main' }}>
                    {fila.folio ?? '—'}
                  </TableCell>
                  <TableCell>{comoFecha(fila.fecha)}</TableCell>
                  <TableCell>{fila.asignatura ?? '—'}</TableCell>
                  <TableCell>{fila.laboratorio ?? '—'}</TableCell>
                  <TableCell align="right">{fila.productos}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" color={aspecto.color} label={aspecto.etiqueta} />
                  </TableCell>

                  <TableCell align="right">
                    {enCurso ? (
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="Continuar esta captura">
                          <IconButton
                            aria-label="Continuar la práctica en curso"
                            onClick={onContinuar}
                            color="secondary"
                          >
                            <Icon icon="mdi:pencil" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Descartar esta captura">
                          <IconButton aria-label="Descartar la práctica en curso" onClick={onDescartar}>
                            <Icon icon="mdi:delete-outline" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ) : (
                      <IconButton
                        aria-label={`Ver práctica ${fila.folio ?? fila.practicaId}`}
                        onClick={() => onVer(fila.practicaId as number)}
                        color="secondary"
                      >
                        <Icon icon="mdi:chevron-right" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
