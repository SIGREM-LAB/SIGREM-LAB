import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { useAlmacenes } from '@/features/inventario/consultas'
import { DialogoParametros } from './DialogoParametros'
import { REPORTES, type Reporte } from './registro'

/**
 * La rejilla de reportes.
 *
 * Una tarjeta por entrada de `REPORTES`: agregar el de equipos con fallas no
 * toca este archivo.
 */
export function PaginaReportes() {
  const perfil = usePerfil()
  const almacenes = useAlmacenes()
  const [abierto, setAbierto] = useState<Reporte | null>(null)

  // El responsable tiene bodega y no elige. El admin no tiene ninguna y entra
  // igual -la guardia se lo permite-, asi que tiene que decir cual antes de
  // generar nada: el formato unificado es UN LIBRO POR ALMACEN, y los demas
  // reportes tampoco significan nada sumados entre bodegas.
  const propio = perfil.data?.almacen ?? null
  const [elegido, setElegido] = useState<number | null>(null)

  const almacenId = propio?.id ?? elegido
  const almacenClave =
    propio?.clave ?? almacenes.data?.find((a) => a.id === elegido)?.clave ?? null

  return (
    <Stack>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Exporta a Excel lo que necesitas para decidir"
      />

      <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          {propio === null && (
            <TextField
              select
              label="Almacén"
              value={elegido ?? ''}
              onChange={(e) => setElegido(Number(e.target.value))}
              helperText="Los reportes son de un almacén a la vez."
              sx={{ maxWidth: 360 }}
            >
              {(almacenes.data ?? []).map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.clave}
                </MenuItem>
              ))}
            </TextField>
          )}

          {almacenId === null && propio === null && (
            <Alert severity="info">Elige un almacén para generar sus reportes.</Alert>
          )}

          <Grid container spacing={2}>
            {REPORTES.map((reporte) => (
              <Grid key={reporte.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardActionArea
                    disabled={almacenId === null}
                    onClick={() => setAbierto(reporte)}
                    sx={{ p: 2, alignItems: 'flex-start' }}
                  >
                    <Stack spacing={1}>
                      <Icon icon={reporte.icono} width={28} />

                      <Typography sx={{ fontWeight: 600 }}>{reporte.titulo}</Typography>

                      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                        {reporte.descripcion}
                      </Typography>
                    </Stack>
                  </CardActionArea>

                  {/* El responsable llega a los minimos desde «quiero saber que
                      comprar», no desde el inventario. Por eso el enlace vive
                      en esta tarjeta y no en otra pantalla. */}
                  {reporte.id === 'reposicion' && (
                    <Button
                      component={Link}
                      to="/reportes/minimos"
                      size="small"
                      startIcon={<Icon icon="mdi:target" />}
                      sx={{ m: 1 }}
                    >
                      Definir mínimos
                    </Button>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Box>

      {abierto && almacenId !== null && almacenClave !== null && (
        <DialogoParametros
          reporte={abierto}
          almacenId={almacenId}
          almacenClave={almacenClave}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </Stack>
  )
}
