import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link as EnlaceRuta } from 'react-router-dom'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'

const esquema = z.object({ correo: z.string().trim().email('Escribe un correo válido') })
type Valores = z.infer<typeof esquema>

export function PantallaRecuperarContrasena() {
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { correo: '' },
  })

  const enviar = handleSubmit(async ({ correo }) => {
    setError(null)
    const { error: errorSolicitud } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/recuperar-contrasena`,
    })
    if (errorSolicitud) {
      setError('No se pudo enviar el correo de recuperación. Intenta nuevamente.')
      return
    }
    setEnviado(true)
  })

  return (
    <Stack sx={{ minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 430, p: 4 }}>
        <Stack spacing={2.5} component="form" onSubmit={enviar} noValidate>
          <Stack spacing={0.5}>
            <Typography variant="h1">Recuperar contraseña</Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              Recibirás un enlace para establecer una nueva contraseña.
            </Typography>
          </Stack>
          {enviado ? (
            <Alert severity="success">Si el correo está registrado, recibirás un enlace de recuperación.</Alert>
          ) : (
            <>
              <Controller
                name="correo"
                control={control}
                render={({ field, fieldState }) => <TextField {...field} label="Correo electrónico" type="email" autoComplete="username" error={!!fieldState.error} helperText={fieldState.error?.message} />}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Enviando…' : 'Enviar enlace'}</Button>
            </>
          )}
          <Button component={EnlaceRuta} to="/entrar" variant="text">Volver a iniciar sesión</Button>
        </Stack>
      </Paper>
    </Stack>
  )
}
