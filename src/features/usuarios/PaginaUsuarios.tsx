import { Icon } from '@iconify/react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { aspectoDeAlmacen } from '@/app/almacenes'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type Rol = Tables<'perfil'>['rol']
type EstadoUsuario = 'activo' | 'pendiente' | 'desactivado'
type Usuario = {
  id: string
  correo: string | null
  estado: EstadoUsuario
  nombre: string
  rol: Rol
  almacen_id: number | null
  almacen: Tables<'almacen'> | null
  creado_en: string
}

const roles: { valor: Rol; etiqueta: string }[] = [
  { valor: 'admin', etiqueta: 'Administrador' },
  { valor: 'responsable', etiqueta: 'Responsable' },
  { valor: 'consulta', etiqueta: 'Usuario de consulta' },
]

const esquemaEdicion = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe el nombre completo'),
    rol: z.enum(['admin', 'responsable', 'consulta']),
    almacenId: z.string(),
  })
  .superRefine((valores, contexto) => {
    if (valores.rol === 'responsable' && !valores.almacenId) {
      contexto.addIssue({
        code: 'custom',
        path: ['almacenId'],
        message: 'Un responsable debe tener un almacén asignado',
      })
    }
  })

type ValoresEdicion = z.infer<typeof esquemaEdicion>

const esquemaNuevo = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe el nombre completo'),
    correo: z.string().trim().email('Escribe un correo válido'),
    rol: z.enum(['admin', 'responsable', 'consulta']),
    almacenId: z.string(),
    password: z.string()
      .min(8, 'Debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir una mayúscula')
      .regex(/[a-z]/, 'Debe incluir una minúscula')
      .regex(/[0-9]/, 'Debe incluir un número')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir un carácter especial'),
    confirmacion: z.string(),
  })
  .superRefine((valores, contexto) => {
    if (valores.rol === 'responsable' && !valores.almacenId) {
      contexto.addIssue({ code: 'custom', path: ['almacenId'], message: 'Un responsable debe tener un almacén asignado' })
    }
    if (valores.password !== valores.confirmacion) {
      contexto.addIssue({ code: 'custom', path: ['confirmacion'], message: 'Las contraseñas no coinciden.' })
    }
  })

type ValoresNuevo = z.infer<typeof esquemaNuevo>

function etiquetaRol(rol: Rol) {
  return roles.find((opcion) => opcion.valor === rol)?.etiqueta ?? rol
}

function fechaCreacion(fecha: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(fecha))
}

function colorRol(rol: Rol) {
  return rol === 'admin' ? 'primary' : 'default'
}

const CLAVE_RESTABLECIMIENTOS = 'sigrem-restablecimientos'
const ESPERA_RESTABLECIMIENTO_MS = 60 * 60 * 1000

function leerRestablecimientos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_RESTABLECIMIENTOS) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function minutosDeEspera(usuarioId: string, bloqueos: Record<string, number>) {
  const restante = (bloqueos[usuarioId] ?? 0) - Date.now()
  return restante > 0 ? Math.ceil(restante / 60_000) : 0
}

function marcarRestablecimiento(usuarioId: string) {
  const actual = leerRestablecimientos()
  actual[usuarioId] = Date.now() + ESPERA_RESTABLECIMIENTO_MS
  localStorage.setItem(CLAVE_RESTABLECIMIENTOS, JSON.stringify(actual))
  return actual
}

async function invocarAdministracion<T>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T>('administrar-usuarios', { body: cuerpo })
  const detalle =
    data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : null
  if (error) throw new Error(detalle ?? error.message)
  if (detalle) throw new Error(detalle)
  if (!data) throw new Error('La respuesta de la función está vacía')
  return data
}

export function PaginaUsuarios() {
  const queryClient = useQueryClient()
  const [usuarioEditado, setUsuarioEditado] = useState<Usuario | null>(null)
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [usuarioRestablecer, setUsuarioRestablecer] = useState<Usuario | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [bloqueosRestablecimiento, setBloqueosRestablecimiento] = useState(leerRestablecimientos)
  const minutosEspera = usuarioEditado ? minutosDeEspera(usuarioEditado.id, bloqueosRestablecimiento) : 0
  const minutosEsperaEnvio = usuarioRestablecer ? minutosDeEspera(usuarioRestablecer.id, bloqueosRestablecimiento) : 0

  const usuarios = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const data = await invocarAdministracion<{ usuarios: Usuario[] }>({ accion: 'listar' })
      return data.usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre))
    },
  })

  const actualizacion = useMutation({
    mutationFn: async (valores: ValoresEdicion) => {
      const { error } = await supabase
        .from('perfil')
        .update({
          nombre: valores.nombre,
          rol: valores.rol,
          almacen_id: valores.almacenId ? Number(valores.almacenId) : null,
        })
        .eq('id', usuarioEditado?.id ?? '')
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setUsuarioEditado(null)
    },
  })

  const nuevoUsuario = useMutation({
    mutationFn: async (valores: ValoresNuevo) => {
      const data = await invocarAdministracion<{ ok?: boolean }>({
        accion: 'crear',
        nombre: valores.nombre,
        correo: valores.correo,
        rol: valores.rol,
        almacen_id: valores.almacenId ? Number(valores.almacenId) : null,
        password: valores.password,
      })
      if (!data.ok) throw new Error('No se pudo registrar el usuario')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setNuevoAbierto(false)
      setMensaje('Usuario creado. Ya puede entrar con el correo y la contraseña inicial.')
    },
  })

  const restablecimiento = useMutation({
    mutationFn: async (usuarioId: string) => {
      await invocarAdministracion({ accion: 'restablecer', usuario_id: usuarioId })
    },
    onSuccess: (_datos, usuarioId) => {
      setBloqueosRestablecimiento(marcarRestablecimiento(usuarioId))
      setUsuarioRestablecer(null)
      setUsuarioEditado(null)
      setMensaje('Se envió el enlace de recuperación. Evita repetirlo durante la próxima hora.')
    },
  })

  const titulo = (
    <Stack spacing={0.5}>
      <Typography variant="h1">Administración de usuarios</Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        Gestiona los usuarios, roles y áreas de acceso al sistema.
      </Typography>
    </Stack>
  )

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
      >
        {titulo}
        <Button startIcon={<Icon icon="mdi:plus" width={20} />} onClick={() => setNuevoAbierto(true)}>
          Nuevo usuario
        </Button>
      </Stack>

      {usuarios.error && <Alert severity="error">No se pudo leer la lista de usuarios: {usuarios.error.message}</Alert>}
      {mensaje && <Alert severity="success" onClose={() => setMensaje(null)}>{mensaje}</Alert>}

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 3 }}>
            <Icon icon="mdi:account-group-outline" width={22} color="var(--mui-palette-primary-main)" />
            <Typography variant="h2" sx={{ color: 'primary.main' }}>
              Lista de usuarios registrados
            </Typography>
            {!usuarios.isPending && !usuarios.error && <Typography sx={{ color: 'text.secondary' }}>({usuarios.data.length})</Typography>}
          </Stack>

          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Correo electrónico</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Laboratorio / Área asignada</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usuarios.isPending
                  ? [1, 2, 3].map((fila) => (
                      <TableRow key={fila}>
                        {[1, 2, 3, 4, 5, 6].map((celda) => (
                          <TableCell key={celda}><Skeleton /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : usuarios.data?.map((usuario) => {
                      const aspecto = aspectoDeAlmacen(usuario.almacen?.clave)
                      return (
                        <TableRow key={usuario.id}>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                              <Avatar sx={{ width: 38, height: 38, bgcolor: usuario.rol === 'admin' ? 'primary.main' : 'grey.600' }}>
                                {usuario.nombre.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontWeight: 600 }}>{usuario.nombre}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Creado {fechaCreacion(usuario.creado_en)}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{usuario.correo ?? 'Sin correo'}</TableCell>
                          <TableCell><Chip label={etiquetaRol(usuario.rol)} size="small" color={colorRol(usuario.rol)} /></TableCell>
                          <TableCell>
                            {usuario.almacen ? (
                              <Chip label={usuario.almacen.clave} size="small" sx={{ bgcolor: aspecto.color, color: 'common.white' }} />
                            ) : (
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Sin asignar</Typography>
                            )}
                          </TableCell>
                          <TableCell><Chip label={usuario.estado === 'activo' ? 'Activo' : usuario.estado === 'pendiente' ? 'Pendiente' : 'Desactivado'} size="small" color={usuario.estado === 'activo' ? 'success' : usuario.estado === 'pendiente' ? 'warning' : 'error'} variant={usuario.estado === 'activo' ? 'outlined' : 'filled'} /></TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Icon icon="mdi:pencil-outline" width={18} />}
                                onClick={() => setUsuarioEditado(usuario)}
                              >
                                Editar
                              </Button>
                              <Tooltip title="Se habilitará al definir el mecanismo seguro de Auth">
                                <span>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled
                                    startIcon={<Icon icon="mdi:account-off-outline" width={18} />}
                                  >
                                    Desactivar
                                  </Button>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <DialogoEdicion
        usuario={usuarioEditado}
        guardando={actualizacion.isPending}
        minutosEspera={minutosEspera}
        onClose={() => setUsuarioEditado(null)}
        onReset={() => usuarioEditado && setUsuarioRestablecer(usuarioEditado)}
        onSave={(valores) => actualizacion.mutate(valores)}
      />

      <Dialog open={usuarioRestablecer !== null} onClose={() => setUsuarioRestablecer(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Restablecer contraseña</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              Se enviará un enlace a {usuarioRestablecer?.correo ?? 'este usuario'}. El enlace dura 1 hora y es de un solo uso.
            </Typography>
            <Alert severity="warning">
              Evita repetir el envío: consume la cuota de correos del proyecto. Con el correo integrado de Supabase el límite es de 2 envíos por hora.
            </Alert>
            {minutosEsperaEnvio > 0 && (
              <Alert severity="info">
                Ya se envió un enlace a este usuario. Espera {minutosEsperaEnvio} min antes de pedir otro.
              </Alert>
            )}
            {restablecimiento.error && (
              <Alert severity="error">
                {restablecimiento.error.message.includes('límite')
                  ? 'No se pudo enviar. Se alcanzó el límite de correos. Intenta más tarde.'
                  : restablecimiento.error.message}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsuarioRestablecer(null)} disabled={restablecimiento.isPending}>Cancelar</Button>
          <Button
            onClick={() => usuarioRestablecer && restablecimiento.mutate(usuarioRestablecer.id)}
            disabled={restablecimiento.isPending || minutosEsperaEnvio > 0}
          >
            {restablecimiento.isPending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </DialogActions>
      </Dialog>

      <DialogoNuevoUsuario
        abierto={nuevoAbierto}
        guardando={nuevoUsuario.isPending}
        error={nuevoUsuario.error?.message ?? null}
        onClose={() => setNuevoAbierto(false)}
        onSave={(valores) => nuevoUsuario.mutate(valores)}
      />
    </Stack>
  )
}

function DialogoNuevoUsuario({
  abierto,
  guardando,
  error,
  onClose,
  onSave,
}: {
  abierto: boolean
  guardando: boolean
  error: string | null
  onClose: () => void
  onSave: (valores: ValoresNuevo) => void
}) {
  const almacenes = useQuery({
    queryKey: ['almacenes', 'nuevo-usuario'],
    queryFn: async () => {
      const { data, error } = await supabase.from('almacen').select('id, clave, nombre, activo').eq('activo', true).order('clave')
      if (error) throw error
      return data
    },
  })
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ValoresNuevo>({
    resolver: zodResolver(esquemaNuevo),
    defaultValues: { nombre: '', correo: '', rol: 'consulta', almacenId: '', password: '', confirmacion: '' },
  })
  const [mostrarPassword, setMostrarPassword] = useState(false)

  useEffect(() => {
    if (abierto) reset({ nombre: '', correo: '', rol: 'consulta', almacenId: '', password: '', confirmacion: '' })
  }, [abierto, reset])

  return (
    <Dialog open={abierto} onClose={guardando ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nuevo usuario</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSave)}>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info">
              La contraseña inicial se enviará de forma segura a Supabase Auth. No se guarda en el sistema ni se muestra después de registrar al usuario.
            </Alert>
            {error && <Alert severity="error">No se pudo registrar el usuario: {error}</Alert>}
            <Controller name="nombre" control={control} render={({ field, fieldState }) => <TextField {...field} label="Nombre completo" error={!!fieldState.error} helperText={fieldState.error?.message} />} />
            <Controller name="correo" control={control} render={({ field, fieldState }) => <TextField {...field} label="Correo electrónico" type="email" error={!!fieldState.error} helperText={fieldState.error?.message} />} />
            <Controller
              name="rol"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.rol}>
                  <InputLabel id="nuevo-rol-label">Rol</InputLabel>
                  <Select {...field} labelId="nuevo-rol-label" label="Rol">
                    {roles.map((rol) => <MenuItem key={rol.valor} value={rol.valor}>{rol.etiqueta}</MenuItem>)}
                  </Select>
                  {errors.rol && <FormHelperText>{errors.rol.message}</FormHelperText>}
                </FormControl>
              )}
            />
            <Controller
              name="almacenId"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error}>
                  <InputLabel id="nuevo-almacen-label">Laboratorio / Área asignada</InputLabel>
                  <Select {...field} labelId="nuevo-almacen-label" label="Laboratorio / Área asignada">
                    <MenuItem value="">Sin asignar</MenuItem>
                    {almacenes.data?.map((almacen) => <MenuItem key={almacen.id} value={almacen.id.toString()}>{almacen.clave} · {almacen.nombre}</MenuItem>)}
                  </Select>
                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Contraseña inicial"
                  type={mostrarPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setMostrarPassword((visible) => !visible)} edge="end"><Icon icon={mostrarPassword ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} width={20} /></IconButton></InputAdornment> } }}
                />
              )}
            />
            <Controller
              name="confirmacion"
              control={control}
              render={({ field, fieldState }) => (
                <TextField {...field} label="Confirmar contraseña" type="password" autoComplete="new-password" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" disabled={guardando}>{guardando ? 'Registrando…' : 'Registrar usuario'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

function DialogoEdicion({
  usuario,
  guardando,
  minutosEspera,
  onClose,
  onReset,
  onSave,
}: {
  usuario: Usuario | null
  guardando: boolean
  minutosEspera: number
  onClose: () => void
  onReset: () => void
  onSave: (valores: ValoresEdicion) => void
}) {
  const almacenes = useQuery({
    queryKey: ['almacenes', 'usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('almacen').select('id, clave, nombre, activo').eq('activo', true).order('clave')
      if (error) throw error
      return data
    },
  })
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ValoresEdicion>({
    resolver: zodResolver(esquemaEdicion),
    defaultValues: { nombre: '', rol: 'consulta', almacenId: '' },
  })

  useEffect(() => {
    if (usuario) {
      reset({ nombre: usuario.nombre, rol: usuario.rol, almacenId: usuario.almacen_id?.toString() ?? '' })
    }
  }, [reset, usuario])

  return (
    <Dialog open={usuario !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Editar usuario</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSave)}>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Controller
              name="nombre"
              control={control}
              render={({ field, fieldState }) => (
                <TextField {...field} label="Nombre completo" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )}
            />
            <Controller
              name="rol"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.rol}>
                  <InputLabel id="rol-usuario-label">Rol</InputLabel>
                  <Select {...field} labelId="rol-usuario-label" label="Rol">
                    {roles.map((rol) => <MenuItem key={rol.valor} value={rol.valor}>{rol.etiqueta}</MenuItem>)}
                  </Select>
                  {errors.rol && <FormHelperText>{errors.rol.message}</FormHelperText>}
                </FormControl>
              )}
            />
            <Controller
              name="almacenId"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error}>
                  <InputLabel id="almacen-usuario-label">Laboratorio / Área asignada</InputLabel>
                  <Select {...field} labelId="almacen-usuario-label" label="Laboratorio / Área asignada">
                    <MenuItem value="">Sin asignar</MenuItem>
                    {almacenes.data?.map((almacen) => <MenuItem key={almacen.id} value={almacen.id.toString()}>{almacen.clave} · {almacen.nombre}</MenuItem>)}
                  </Select>
                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
            <Stack spacing={1}>
              <Typography variant="h3">Seguridad</Typography>
              <Button
                variant="outlined"
                startIcon={<Icon icon="mdi:lock-reset" width={20} />}
                sx={{ alignSelf: 'flex-start' }}
                onClick={onReset}
                disabled={minutosEspera > 0}
              >
                {minutosEspera > 0 ? `Restablecer (${minutosEspera} min)` : 'Restablecer contraseña'}
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Se enviará un enlace al correo del usuario. Nunca se muestra su contraseña actual.
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
