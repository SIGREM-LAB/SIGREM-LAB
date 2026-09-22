import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'

import { usePerfil } from '@/features/auth/usePerfil'
import { useGenerarReporte } from './consultas'
import type { Reporte } from './registro'

/**
 * Los parametros de un reporte y el boton que lo genera.
 *
 * Dibuja un control por cada entrada de `reporte.parametros`, sin saber cual es
 * cual: agregar un reporte con un parametro nuevo se resuelve agregando una
 * rama aqui, no un dialogo entero.
 */
export function DialogoParametros({
  reporte,
  almacenId,
  almacenClave,
  onCerrar,
}: {
  reporte: Reporte
  almacenId: number
  almacenClave: string
  onCerrar: () => void
}) {
  const perfil = usePerfil()
  const generar = useGenerarReporte()

  // Los valores de arranque salen del propio registro. Un `useState` por
  // parametro obligaria a tocar este componente cada vez que se agregue un
  // reporte, que es justo lo que el registro existe para evitar.
  const [valores, setValores] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      reporte.parametros.map((p) => [
        p.clave,
        p.tipo === 'almacen' ? almacenId : p.porDefecto,
      ]),
    ),
  )

  const etiquetas = () => [
    { etiqueta: 'Almacén', valor: almacenClave },
    ...reporte.parametros
      .filter((p) => p.tipo !== 'almacen')
      .map((p) => ({
        etiqueta: p.etiqueta,
        valor:
          p.tipo === 'casilla'
            ? valores[p.clave]
              ? 'Sí'
              : 'No'
            : `${valores[p.clave]} días`,
      })),
    { etiqueta: 'Generado', valor: new Date().toLocaleString('es-MX') },
    { etiqueta: 'Por', valor: perfil.data?.nombre ?? '' },
  ]

  return (
    <Dialog open onClose={generar.isPending ? undefined : onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>{reporte.titulo}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {reporte.parametros.map((p) => {
            if (p.tipo === 'almacen') {
              return (
                <TextField
                  key={p.clave}
                  label={p.etiqueta}
                  value={almacenClave}
                  disabled
                  helperText="La RLS no deja generar el reporte de otro almacén."
                />
              )
            }

            if (p.tipo === 'dias') {
              return (
                <TextField
                  key={p.clave}
                  select
                  label={p.etiqueta}
                  value={valores[p.clave]}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [p.clave]: Number(e.target.value) }))
                  }
                >
                  {p.opciones.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d} días
                    </MenuItem>
                  ))}
                </TextField>
              )
            }

            return (
              <Stack key={p.clave}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(valores[p.clave])}
                      onChange={(e) =>
                        setValores((v) => ({ ...v, [p.clave]: e.target.checked }))
                      }
                    />
                  }
                  label={p.etiqueta}
                />

                {p.ayuda && (
                  <Typography sx={{ color: 'text.secondary', fontSize: 13, pl: 4 }}>
                    {p.ayuda}
                  </Typography>
                )}
              </Stack>
            )
          })}

          {/* La mitad visible de la regla de `traerTodo`: si algo falla se ve el
              error y NO se descarga nada. Nunca un .xlsx a medias, y nunca uno
              en blanco que parezca un inventario sano. */}
          {generar.isError && (
            <Alert severity="warning">{(generar.error as Error).message}</Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar} disabled={generar.isPending}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          loading={generar.isPending}
          onClick={() =>
            generar.mutate(
              {
                reporte,
                parametros: valores,
                almacenClave,
                etiquetas: etiquetas(),
              },
              { onSuccess: onCerrar },
            )
          }
        >
          Generar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
