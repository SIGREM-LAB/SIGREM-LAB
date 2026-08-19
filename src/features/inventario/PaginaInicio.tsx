import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'

import { aspectoDeAlmacen } from '@/app/almacenes'
import { usePerfil } from '@/features/auth/usePerfil'
import { supabase } from '@/lib/supabase'

/**
 * Provisional. Existe para comprobar de punta a punta que la sesion, la RLS y
 * las consultas funcionan juntas: los numeros que salen aqui son los que el
 * usuario tiene permitido ver.
 */
export function PaginaInicio() {
  const { data: perfil } = usePerfil()

  const resumen = useQuery({
    queryKey: ['resumen-almacenes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('almacen')
        .select('id, clave, nombre, existencia (id)')
        .order('clave')
      if (error) throw error
      return data.map((a) => ({ ...a, total: a.existencia.length }))
    },
  })

  const encabezado = (
    <Stack spacing={0.5}>
      <Typography variant="h1">Hola, {perfil?.nombre ?? ''}</Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        Sistema Integral de Gestión de Reactivos, Materiales, Insumos, Equipos y Materia Biológica
      </Typography>
    </Stack>
  )

  if (resumen.isPending) {
    return (
      <Stack spacing={3}>
        {encabezado}
        <Grid container spacing={2}>
          {[0, 1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rounded" height={116} />
            </Grid>
          ))}
        </Grid>
      </Stack>
    )
  }

  if (resumen.error) {
    return (
      <Stack spacing={3}>
        {encabezado}
        <Alert severity="error">No se pudo leer el inventario: {resumen.error.message}</Alert>
      </Stack>
    )
  }

  const vacio = resumen.data.every((a) => a.total === 0)

  return (
    <Stack spacing={3}>
      {encabezado}

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'baseline' }, mb: 2.5 }}
          >
            <Typography variant="h3">Existencias por almacén</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Ves los cuatro almacenes; solo puedes editar el tuyo
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            {resumen.data.map((almacen) => {
              const aspecto = aspectoDeAlmacen(almacen.clave)
              const propio = almacen.id === perfil?.almacen?.id

              return (
                <Grid key={almacen.id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box
                    sx={{
                      height: '100%',
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'background.default',
                      border: '1px solid',
                      borderColor: propio ? 'primary.main' : 'transparent',
                    }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: aspecto.color,
                          color: 'common.white',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon icon={aspecto.icono} width={22} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="h2"
                          sx={{ fontSize: '1.6rem', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {almacen.total}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          existencias
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', mt: 1.5, minWidth: 0 }}
                    >
                      <Typography variant="body2" noWrap title={almacen.nombre} sx={{ flex: 1 }}>
                        {almacen.clave}
                      </Typography>
                      {propio && <Chip label="Tu almacén" size="small" color="primary" />}
                    </Stack>
                  </Box>
                </Grid>
              )
            })}
          </Grid>
        </CardContent>
      </Card>

      {vacio && (
        <Alert severity="info" icon={<Icon icon="mdi:database-import-outline" width={20} />}>
          Los almacenes están dados de alta, pero todavía no se cargan las existencias de los
          Excel: esa migración entra después de la reunión, cuando quede claro qué columnas se
          conservan.
        </Alert>
      )}
    </Stack>
  )
}
