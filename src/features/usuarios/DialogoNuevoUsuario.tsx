import { Icon } from '@iconify/react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { REGLA_CONTRASENA } from './administracion'
import { CampoAlmacenSiAplica, CampoRol } from './CamposUsuario'
import { esquemaNuevo, type ValoresNuevo } from './esquemas'

const VACIO: ValoresNuevo = {
  nombre: '',
  correo: '',
  rol: 'consulta',
  almacenId: '',
  contrasena: '',
  confirmacion: '',
}

export function DialogoNuevoUsuario({
  abierto,
  guardando,
  error,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean
  guardando: boolean
  error: string | null
  onCerrar: () => void
  onGuardar: (valores: ValoresNuevo) => void
}) {
  const { control, handleSubmit, reset } = useForm<ValoresNuevo>({
    resolver: zodResolver(esquemaNuevo),
    defaultValues: VACIO,
  })
  const [mostrar, setMostrar] = useState(false)

  return (
    <Dialog
      open={abierto}
      onClose={guardando ? undefined : onCerrar}
      maxWidth="sm"
      fullWidth
      // El formulario se limpia cuando el diálogo TERMINA de cerrarse. En un
      // efecto sobre `abierto` esto encadenaba un render de más, y limpiarlo
      // en el onClose vaciaría los campos a la vista mientras se desvanece.
      slotProps={{
        transition: {
          onExited: () => {
            reset(VACIO)
            setMostrar(false)
          },
        },
      }}
    >
      <DialogTitle>Nuevo usuario</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onGuardar)}>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info">
              La contraseña inicial se guarda en Supabase Auth y no se puede volver a consultar.
              Anótala antes de cerrar y entrégasela a la persona por un canal privado.
            </Alert>

            {error ? <Alert severity="error">No se pudo registrar el usuario: {error}</Alert> : null}

            <Controller
              name="nombre"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus
                  label="Nombre completo"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="correo"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Correo electrónico"
                  type="email"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <CampoRol control={control} nombre="rol" id="nuevo-rol" />
            <CampoAlmacenSiAplica
              control={control}
              nombre="almacenId"
              campoRol="rol"
              id="nuevo-almacen"
            />

            <Controller
              name="contrasena"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Contraseña inicial"
                  type={mostrar ? 'text' : 'password'}
                  autoComplete="new-password"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            onClick={() => setMostrar((visible) => !visible)}
                            edge="end"
                          >
                            <Icon icon={mostrar ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} width={20} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            />

            <Controller
              name="confirmacion"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Confirmar contraseña"
                  type="password"
                  autoComplete="new-password"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {REGLA_CONTRASENA}
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Registrando…' : 'Registrar usuario'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
