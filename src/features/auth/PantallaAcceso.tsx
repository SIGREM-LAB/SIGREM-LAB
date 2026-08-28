import { Icon } from '@iconify/react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { useState, ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { BotonTema } from '@/app/BotonTema'
import { LogoUAEH } from '@/app/LogoUAEH'
import { supabase } from '@/lib/supabase'

export type AuthAcceso = {
  signInWithPassword(credenciales: { email: string; password: string }): Promise<{
    error: { message: string } | null
  }>
}

const esquema = z.object({
  correo: z
    .string()
    .min(1, 'Escribe tu correo')
    .refine((v) => v.includes('@'), 'Eso no parece un correo'),
  contrasena: z.string().min(1, 'Escribe tu contraseña'),
})
type Valores = z.infer<typeof esquema>

/** Supabase contesta en ingles; el responsable del almacen no. */
function traducir(mensaje: string): string {
  if (mensaje.includes('Invalid login credentials')) {
    return 'El correo o la contraseña no coinciden.'
  }
  if (mensaje.includes('Email not confirmed')) {
    return 'La cuenta todavía no está confirmada. Avisa al administrador.'
  }
  if (mensaje.includes('fetch')) {
    return 'No se pudo contactar al servidor. Revisa tu conexión.'
  }
  return 'No se pudo entrar. Intenta otra vez o avisa al administrador.'
}

/** Icono a la izquierda del campo, como en el prototipo. */
function adorno(icono: string, fin?: ReactNode) {
  return {
    input: {
      startAdornment: (
        <InputAdornment position="start">
          {/* Sin esto el icono se pierde sobre la superficie oscura: ese gris
              estaba clavado a la paleta clara. */}
          <Box component="span" sx={{ display: 'flex', color: 'text.secondary' }}>
            <Icon icon={icono} width={18} />
          </Box>
        </InputAdornment>
      ),
      ...(fin && {
        endAdornment: <InputAdornment position="end">{fin}</InputAdornment>,
      }),
    },
  }
}

/**
 * Una de las dos figuras del fondo, a un costado de la tarjeta.
 *
 * El ancho se calcula en vez de fijarse porque la figura tiene que caber en la
 * franja que queda libre a su lado: 215 px es la mitad de la tarjeta y 20 px
 * el aire que se le deja a cada lado, de ahi el 255. Asi nunca la tapa ni se
 * sale del lienzo, que era el problema de anclarla a la esquina. Por debajo de
 * `md` esa franja ya no da para nada y las dos desaparecen.
 *
 * El trazo va a 1 y no a los 2 que trae Tabler: ese grosor esta pensado para
 * un lienzo de 24 px y, escalado, se lee como mancha en vez de como dibujo.
 * Con CSS se puede bajar porque una regla le gana al atributo `stroke-width`
 * del `path`.
 */
function FiguraFondo({
  icono,
  color,
  lado,
  giro,
}: {
  icono: string
  color: string
  lado: 'izquierda' | 'derecha'
  /** Grados de inclinacion; ninguna de las dos va recta. */
  giro: number
}) {
  const izquierda = lado === 'izquierda'
  return (
    <Box
      aria-hidden
      sx={(tema) => ({
        position: 'absolute',
        [izquierda ? 'right' : 'left']: 'calc(50% + 235px)',
        [izquierda ? 'top' : 'bottom']: '12%',
        width: 'min(340px, calc(50vw - 255px))',
        aspectRatio: '1',
        display: { xs: 'none', md: 'flex' },
        color,
        transform: `rotate(${giro}deg)`,
        // Caen donde no hay nada que pulsar, pero no hay razon para que una
        // decoracion se coma un clic.
        pointerEvents: 'none',
        '& path': { strokeWidth: 1 },
        // Sube en oscuro: la misma tinta rinde menos contra `#16181C` de lo
        // que rinde contra el papel claro.
        opacity: 0.13,
        ...tema.applyStyles('dark', { opacity: 0.16 }),
      })}
    >
      <Icon icon={icono} width="100%" height="100%" />
    </Box>
  )
}

export function PantallaAcceso({ auth = supabase.auth }: { auth?: AuthAcceso }) {
  const [fallo, setFallo] = useState<string | null>(null)
  const [verContrasena, setVerContrasena] = useState(false)

  // `colorScheme`, no `mode`: `mode` vale 'system' cuando el usuario no ha
  // forzado nada, asi que compararlo con 'dark' daria falso justo en el caso
  // mas comun -sistema en oscuro y preferencia en automatico-. Vale undefined
  // en el primer render, y ahi el logo sale a color, que es el lado seguro.
  const { colorScheme } = useColorScheme()

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { correo: '', contrasena: '' },
  })

  const enviar = handleSubmit(async (valores) => {
    setFallo(null)
    const { error } = await auth.signInWithPassword({
      email: valores.correo.trim(),
      password: valores.contrasena,
    })
    // El proveedor de sesion se entera solo por onAuthStateChange; aqui no hay
    // que navegar a ningun lado.
    if (error) setFallo(traducir(error.message))
  })

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      {/* Un matraz y un microscopio, enormes y tenues, en vez de dos circulos:
          el fondo dice de que va el sistema sin robarle atencion al
          formulario. Decorativos: no los lee un lector de pantalla. */}
      <FiguraFondo icono="tabler:flask-2" color="primary.main" lado="izquierda" giro={-10} />
      <FiguraFondo icono="tabler:microscope" color="secondary.main" lado="derecha" giro={7} />

      <Box sx={{ position: 'relative', width: '100%', maxWidth: 430 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <BotonTema />
        </Box>

        <Paper
          elevation={0}
          sx={{ overflow: 'hidden', borderRadius: 3, boxShadow: '0 18px 44px rgba(20,22,26,0.12)' }}
        >
          <Stack spacing={1.75} sx={{ bgcolor: 'institucional.main', color: 'common.white', px: 4, py: 3.5 }}>
            {/* El monograma solo, en blanco: sobre el guinda no hace falta la
                placa, y a este tamano la firma no se leeria. */}
            <LogoUAEH variante="marca" blanco alto={30} />

            <Box>
              <Typography variant="h1" component="h1" sx={{ fontSize: '1.5rem' }}>
                SIGREM-LAB
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                Unidad Central de Laboratorios
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ px: 4, py: 3.5 }}>
            <Typography variant="h2" component="h2" sx={{ color: 'primary.main' }}>
              Iniciar sesión
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Escribe tus datos para entrar al sistema
            </Typography>

            <Stack component="form" onSubmit={enviar} spacing={2.5} noValidate>
              <Controller
                name="correo"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Correo"
                    type="email"
                    size="medium"
                    autoComplete="username"
                    autoFocus
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={adorno('mdi:account-outline')}
                  />
                )}
              />

              <Controller
                name="contrasena"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Contraseña"
                    type={verContrasena ? 'text' : 'password'}
                    size="medium"
                    autoComplete="current-password"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={adorno(
                      'mdi:lock-outline',
                      <IconButton
                      type="button"
                      aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setVerContrasena((v) => !v)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      >
                        <Icon icon={verContrasena ? 'mdi:eye-outline' : 'mdi:eye-off-outline'} width={20} />
                      </IconButton>
                    )}
                  />
                )}
              />

              {fallo && (
                <Alert severity="error" icon={<Icon icon="mdi:alert-circle-outline" width={20} />}>
                  {fallo}
                </Alert>
              )}

              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </Stack>

            <Divider sx={{ mt: 3, mb: 2 }} />

            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}
            >
              El almacén asignado se detecta automáticamente a partir de tu usuario
            </Typography>
          </Box>
        </Paper>

        {/* Aqui si va el logo completo: sobre el fondo claro su version a
            color se ve como debe, y a 105 px de alto la firma por fin se lee.
            Decorativo porque el monograma de la cabecera ya anuncio a la
            universidad; anunciarla dos veces no agrega nada. */}
        <Stack spacing={1.25} sx={{ alignItems: 'center', mt: 3 }}>
          <LogoUAEH alto={105} decorativo blanco={colorScheme === 'dark'} sx={{ alignSelf: 'center' }} />
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}
          >
            Sistema Integral de Gestión de Reactivos, Materiales, Insumos, Equipos y Materia Biológica
          </Typography>
        </Stack>
      </Box>
    </Box>
  )
}
