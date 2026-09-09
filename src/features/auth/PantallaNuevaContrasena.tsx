import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Stack, Typography, TextField } from '@mui/material'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link as EnlaceRuta, Navigate } from 'react-router-dom'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'
import { useSesion } from './contexto'
import { enlaceFallido } from './enlaceDeCorreo'

const esquema = z
  .object({
    contrasena: z.string()
      .min(8, 'Debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir una mayúscula')
      .regex(/[a-z]/, 'Debe incluir una minúscula')
      .regex(/[0-9]/, 'Debe incluir un número')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir un carácter especial'),
    confirmacion: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((valores) => valores.contrasena === valores.confirmacion, {
    path: ['confirmacion'],
    message: 'Las contraseñas no coinciden',
  })

type Valores = z.infer<typeof esquema>

export function PantallaNuevaContrasena() {
  const sesion = useSesion()
  const [error, setError] = useState<string | null>(null)
  const [completada, setCompletada] = useState(false)
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { contrasena: '', confirmacion: '' },
  })

  if (sesion.estado === 'cargando') return null

  if (sesion.estado === 'sin-sesion') {
    // Llegar aquí sin sesión y con un enlace roto detrás es el caso normal de
    // un correo caducado. Mandar a /entrar sin decir nada dejaba a la persona
    // frente a un formulario de acceso que no explicaba por qué está ahí.
    const enlaceMuerto = enlaceFallido()
    if (enlaceMuerto === null) return <Navigate to="/entrar" replace />

    return (
      <Stack spacing={2.5} sx={{ maxWidth: 440, mx: 'auto', mt: 8, px: 2 }}>
        <Typography variant="h1">Este enlace ya no sirve</Typography>
        <Alert severity="warning">{enlaceMuerto}</Alert>
        <Button component={EnlaceRuta} to="/solicitar-recuperacion">
          Pedir otro enlace
        </Button>
        <Button component={EnlaceRuta} to="/entrar" variant="text">
          Volver a iniciar sesión
        </Button>
      </Stack>
    )
  }

  const enviar = handleSubmit(async ({ contrasena }) => {
    setError(null)
    const { error: errorActualizacion } = await supabase.auth.updateUser({ password: contrasena })
    if (errorActualizacion) {
      setError('No se pudo establecer la contraseña. Solicita una nueva invitación.')
      return
    }
    setCompletada(true)
  })

  if (completada) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 440, mx: 'auto', mt: 8 }}>
        <Typography variant="h1">Contraseña configurada</Typography>
        <Alert severity="success">Ya puedes entrar a SIGREM-LAB con tu correo y tu nueva contraseña.</Alert>
        <Button href="/">Continuar</Button>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 440, mx: 'auto', mt: 8 }}>
      <Stack spacing={0.5}>
        <Typography variant="h1">Establecer contraseña</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Define una contraseña para completar el acceso a SIGREM-LAB.
        </Typography>
      </Stack>
      <Stack component="form" onSubmit={enviar} spacing={2} noValidate>
        <Controller
          name="contrasena"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Nueva contraseña" type="password" autoComplete="new-password" error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        <Controller
          name="confirmacion"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Confirmar contraseña" type="password" autoComplete="new-password" error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Establecer contraseña'}</Button>
      </Stack>
    </Stack>
  )
}
