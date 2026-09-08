import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { mensajeDeError } from './consultas'
import type { FilaUtilizable } from './esquemas'
import { ETIQUETA_CLASIFICACION } from './metodos'

type Props = {
  abierto: boolean
  termino: string
  onTermino: (termino: string) => void
  /**
   * Ya estrechadas por `useBuscarExistencias`: una fila sin id no se puede
   * registrar, así que no llega hasta aquí.
   */
  filas: FilaUtilizable[]
  cargando: boolean
  /**
   * Lo que falló al consultar, si algo falló. Va explícito porque el modo de
   * fallo natural aquí es el peor: sin él una consulta rota llega como cero
   * filas y se anuncia como "no hay productos que coincidan", que es una
   * afirmación sobre el inventario y no sobre la consulta.
   */
  error: unknown
  /** Los que ya están en la captura: no se ofrecen dos veces. */
  yaAgregados: number[]
  onAgregar: (fila: FilaUtilizable) => void
  onCerrar: () => void
}

export function DialogoBuscar({
  abierto,
  termino,
  onTermino,
  filas,
  cargando,
  error,
  yaAgregados,
  onAgregar,
  onCerrar,
}: Props) {
  const agregados = new Set(yaAgregados)
  const fallo = error !== null && error !== undefined
  const vacio = !cargando && !fallo && filas.length === 0

  return (
    <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle sx={{ color: 'institucional.main' }}>
        Buscar producto
        <IconButton
          aria-label="Cerrar"
          onClick={onCerrar}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Icon icon="mdi:close" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* autoFocus para que un lector físico de código de barras dispare
            directo aquí: se comporta como un teclado y termina con Enter. */}
        <TextField
          autoFocus
          fullWidth
          label="Código o nombre"
          placeholder="N3-00042, etanol…"
          value={termino}
          onChange={(e) => onTermino(e.target.value)}
          sx={{ mt: 1 }}
        />

        {cargando ? <LinearProgress sx={{ mt: 2 }} /> : null}

        {/* El mensaje crudo de PostgREST va incluido a propósito, igual que en
            `mensajeDeError`: quien capture no sabrá qué es un 42703, pero es lo
            único que permite distinguir "falta la migración en el proyecto"
            de "no hay etanol", que desde aquí se veían idénticos. */}
        {fallo ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            No se pudo buscar. {mensajeDeError(error)}
          </Alert>
        ) : null}

        {vacio ? (
          <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
            <Icon icon="mdi:package-variant-remove" width={40} aria-hidden />
            <Typography sx={{ color: 'text.secondary' }}>
              No hay productos que coincidan
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center' }}>
              Sólo se ofrecen los de tu almacén: son los únicos sobre los que puedes registrar.
            </Typography>
          </Stack>
        ) : null}

        <List>
          {filas.map((fila) => {
            const nombre = fila.nombre_canonico ?? 'Sin nombre'
            const yaEsta = agregados.has(fila.id)

            return (
              <ListItem
                key={fila.id}
                divider
                secondaryAction={
                  <IconButton
                    aria-label={`Agregar ${nombre}`}
                    onClick={() => onAgregar(fila)}
                    disabled={yaEsta}
                    color="secondary"
                  >
                    <Icon icon={yaEsta ? 'mdi:check' : 'mdi:plus'} />
                  </IconButton>
                }
              >
                <ListItemText
                  disableTypography
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', color: 'institucional.main' }}
                      >
                        {fila.codigo}
                      </Typography>
                      {fila.clasificacion === null ? null : (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={ETIQUETA_CLASIFICACION[fila.clasificacion]}
                        />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Box>
                      <Typography>{nombre}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {`${fila.almacen_clave ?? ''} · ${fila.cantidad ?? 0} ${fila.unidad_base ?? ''}`}
                      </Typography>
                      {fila.ubicacion === null ? null : (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          {fila.ubicacion}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            )
          })}
        </List>
      </DialogContent>
    </Dialog>
  )
}
