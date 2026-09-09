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
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { REGLA_CONTRASENA, type Usuario } from './administracion'
import { esquemaContrasena, type ValoresContrasena } from './esquemas'

type Via = 'directa' | 'correo'

type Props = {
  usuario: Usuario | null
  /** Lo que falta del freno de una hora para volver a mandar correo. */
  minutosEspera: number
  guardando: boolean
  enviando: boolean
  errorDirecta: string | null
  errorCorreo: string | null
  onCerrar: () => void
  onEstablecer: (contrasena: string) => void
  onEnviarEnlace: () => void
}

/**
 * Restablecer la contraseña de alguien, por dos vías.
 *
 * La de en medio —definirla ahí mismo— es la que se usa: el admin la teclea y
 * se la entrega a la persona por donde ya habla con ella. El correo depende de
 * que la cuenta tenga uno vivo y de una cuota de dos envíos por hora, así que
 * queda como la segunda pestaña y no como el único camino.
 */
export function DialogoContrasena({
  usuario,
  minutosEspera,
  guardando,
  enviando,
  errorDirecta,
  errorCorreo,
  onCerrar,
  onEstablecer,
  onEnviarEnlace,
}: Props) {
  const [via, setVia] = useState<Via>('directa')
  const [mostrar, setMostrar] = useState(false)
  const { control, handleSubmit, reset } = useForm<ValoresContrasena>({
    resolver: zodResolver(esquemaContrasena),
    defaultValues: { contrasena: '', confirmacion: '' },
  })

  const sinCorreo = usuario?.correo === null || usuario?.correo === undefined
  const ocupado = guardando || enviando

  return (
    <Dialog
      open={usuario !== null}
      onClose={ocupado ? undefined : onCerrar}
      maxWidth="xs"
      fullWidth
      // Se limpia al terminar de cerrarse: lo tecleado para un usuario no puede
      // seguir ahí cuando el diálogo se abra sobre otro.
      slotProps={{
        transition: {
          onExited: () => {
            reset({ contrasena: '', confirmacion: '' })
            setVia('directa')
            setMostrar(false)
          },
        },
      }}
    >
      <DialogTitle>Restablecer contraseña</DialogTitle>

      <Typography variant="body2" sx={{ px: 3, pb: 1.5, color: 'text.secondary' }}>
        {usuario?.nombre}
        {sinCorreo ? '' : ` · ${usuario?.correo}`}
      </Typography>

      <Tabs value={via} onChange={(_evento, valor: Via) => setVia(valor)} sx={{ px: 3 }}>
        <Tab value="directa" label="Definirla ahora" />
        <Tab value="correo" label="Enviar enlace" />
      </Tabs>

      {via === 'directa' ? (
        <Box component="form" onSubmit={handleSubmit((valores) => onEstablecer(valores.contrasena))}>
          <DialogContent>
            <Stack spacing={2.5}>
              <Alert severity="info">
                La contraseña se guarda en Supabase Auth y no se puede volver a consultar. Anótala antes
                de cerrar y entrégasela a la persona por un canal privado.
              </Alert>

              {errorDirecta ? <Alert severity="error">{errorDirecta}</Alert> : null}

              <Controller
                name="contrasena"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    autoFocus
                    label="Nueva contraseña"
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
              {guardando ? 'Cambiando…' : 'Cambiar contraseña'}
            </Button>
          </DialogActions>
        </Box>
      ) : (
        <>
          <DialogContent>
            <Stack spacing={2}>
              {sinCorreo ? (
                <Alert severity="warning">
                  Esta cuenta no tiene correo registrado. La única vía es definir la contraseña aquí
                  mismo.
                </Alert>
              ) : (
                <Typography>
                  Se enviará un enlace a {usuario?.correo}. Dura una hora y es de un solo uso.
                </Typography>
              )}

              <Alert severity="warning">
                Evita repetir el envío: consume la cuota de correos del proyecto. Con el correo
                integrado de Supabase el límite es de 2 envíos por hora.
              </Alert>

              {minutosEspera > 0 ? (
                <Alert severity="info">
                  Ya se envió un enlace a este usuario. Espera {minutosEspera} min antes de pedir otro.
                </Alert>
              ) : null}

              {errorCorreo ? <Alert severity="error">{errorCorreo}</Alert> : null}
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={onEnviarEnlace} disabled={enviando || minutosEspera > 0 || sinCorreo}>
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
