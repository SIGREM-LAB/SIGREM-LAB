import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { useAlmacenes } from '@/features/inventario/consultas'
import { normalizarTermino } from '@/features/inventario/presentacion'
import { TablaMinimos } from './TablaMinimos'
import { useArticulosDelAlmacen, useGuardarMinimo } from './consultas'

/**
 * Donde se capturan los minimos de reposicion.
 *
 * Se eligio una tabla editable y no una ida y vuelta por Excel porque el minimo
 * por articulo recorto el volumen un orden de magnitud respecto al minimo por
 * envase: son cientos de renglones por almacen, no las 2,526 existencias. Eso
 * cabe aqui sin abrir la caja de leer archivos, validar y resolver conflictos.
 */
export function PaginaMinimos() {
  const perfil = usePerfil()
  const almacenes = useAlmacenes()
  const guardar = useGuardarMinimo()

  const propio = perfil.data?.almacen ?? null
  const [elegido, setElegido] = useState<number | null>(null)
  const almacenId = propio?.id ?? elegido

  const articulos = useArticulosDelAlmacen(almacenId)

  const [termino, setTermino] = useState('')

  const visibles = useMemo(() => {
    const q = normalizarTermino(termino)
    const todos = articulos.data ?? []
    if (!q) return todos
    return todos.filter((a) => normalizarTermino(a.nombre).includes(q))
  }, [articulos.data, termino])

  const total = articulos.data?.length ?? 0
  const conMinimo = (articulos.data ?? []).filter((a) => a.minimo !== null).length

  return (
    <Stack>
      <EncabezadoPagina
        titulo="Mínimos de reposición"
        descripcion="Cuánto hay que mantener de cada artículo en el almacén"
        acciones={
          <Button
            component={Link}
            to="/reportes"
            startIcon={<Icon icon="mdi:arrow-left" width={18} />}
          >
            Reportes
          </Button>
        }
      />

      <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          {propio === null && (
            <TextField
              select
              label="Almacén"
              value={elegido ?? ''}
              onChange={(e) => setElegido(Number(e.target.value))}
              sx={{ maxWidth: 360 }}
            >
              {(almacenes.data ?? []).map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.clave}
                </MenuItem>
              ))}
            </TextField>
          )}

          {almacenId === null ? (
            <Alert severity="info">Elige un almacén para capturar sus mínimos.</Alert>
          ) : (
            <>
              {/* El progreso a la vista. Es un trabajo incremental y verlo
                  avanzar es lo que hace que se termine: el reporte de compras
                  NO necesita que esten todos. Con treinta ya hay lista. */}
              <Stack spacing={0.75}>
                <Typography sx={{ fontSize: 14 }}>
                  <strong>{conMinimo}</strong> de {total} artículos tienen mínimo definido
                </Typography>

                <LinearProgress
                  variant="determinate"
                  value={total === 0 ? 0 : (conMinimo / total) * 100}
                  sx={{ height: 6, borderRadius: 3, maxWidth: 420 }}
                />

                <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                  {conMinimo === 0
                    ? 'Genera el reporte de reposición: su segunda hoja te dice por cuáles empezar.'
                    : 'El reporte de compras ya funciona con estos; no hace falta capturarlos todos.'}
                </Typography>
              </Stack>

              <TextField
                size="small"
                placeholder="Buscar artículo…"
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                sx={{ maxWidth: 360 }}
              />

              {guardar.isError && (
                <Alert severity="error">
                  No se pudo guardar el mínimo. {(guardar.error as Error).message}
                </Alert>
              )}

              {articulos.isPending ? (
                <Typography sx={{ color: 'text.secondary' }}>Cargando artículos…</Typography>
              ) : visibles.length === 0 ? (
                <Alert severity="info">
                  {termino
                    ? 'Ningún artículo coincide con la búsqueda.'
                    : 'Este almacén todavía no tiene existencias cargadas.'}
                </Alert>
              ) : (
                <TablaMinimos
                  articulos={visibles}
                  onGuardar={(v) =>
                    guardar.mutate({ ...v, almacenId: almacenId })
                  }
                />
              )}
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  )
}
