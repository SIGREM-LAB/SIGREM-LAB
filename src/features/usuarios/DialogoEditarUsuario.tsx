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
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'

import type { Usuario } from './administracion'
import { CampoAlmacen, CampoRol } from './CamposUsuario'
import { esquemaEdicion, type ValoresEdicion } from './esquemas'

export function DialogoEditarUsuario({
  usuario,
  esMiCuenta,
  guardando,
  error,
  onCerrar,
  onGuardar,
  onContrasena,
}: {
  usuario: Usuario | null
  /**
   * El renglon es el de quien esta editando. Su propio rol queda bloqueado:
   * bajarselo es la unica accion de esta pantalla que puede dejar al sistema
   * sin administradores, y la base la rechaza de todas formas cuando es el
   * ultimo. Mas vale no ofrecerla que explicar el error despues.
   */
  esMiCuenta: boolean
  guardando: boolean
  error: string | null
  onCerrar: () => void
  onGuardar: (valores: ValoresEdicion) => void
  onContrasena: () => void
}) {
  const { control, handleSubmit, reset } = useForm<ValoresEdicion>({
    resolver: zodResolver(esquemaEdicion),
    defaultValues: { nombre: '', rol: 'consulta', almacenId: '' },
  })

  // Se rellena al abrir y NO se vacía al cerrar: con `values` de
  // react-hook-form, pasar de un usuario a null borraría los campos a la vista
  // mientras el diálogo se desvanece.
  useEffect(() => {
    if (usuario) {
      reset({
        nombre: usuario.nombre,
        rol: usuario.rol,
        almacenId: usuario.almacen_id?.toString() ?? '',
      })
    }
  }, [reset, usuario])

  return (
    <Dialog open={usuario !== null} onClose={guardando ? undefined : onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Editar usuario</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onGuardar)}>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {/* El correo no se edita: cambiarlo es cambiar la identidad de la
                cuenta en Auth, no un dato del perfil. Se muestra para saber de
                quién es el renglón que se está tocando. */}
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {usuario?.correo ?? 'Sin correo registrado'}
            </Typography>

            {error ? <Alert severity="error">No se pudieron guardar los cambios: {error}</Alert> : null}

            <Controller
              name="nombre"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nombre completo"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <CampoRol
              control={control}
              nombre="rol"
              id="editar-rol"
              bloqueado={esMiCuenta}
              ayuda={esMiCuenta ? 'Es tu cuenta: tu propio rol lo cambia otro administrador' : undefined}
            />
            <CampoAlmacen control={control} nombre="almacenId" id="editar-almacen" />

            <Stack spacing={1}>
              <Typography variant="h3">Seguridad</Typography>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<Icon icon="mdi:lock-reset" width={20} />}
                sx={{ alignSelf: 'flex-start' }}
                onClick={onContrasena}
              >
                Restablecer contraseña
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Puedes definirla en el momento o enviar un enlace al correo. La contraseña actual no
                se puede consultar.
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
