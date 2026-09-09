import { Icon } from '@iconify/react'
import { Alert, Button, Card, CardContent, Snackbar, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { useSesion } from '@/features/auth/contexto'
import { supabase } from '@/lib/supabase'
import {
  invocarAdministracion,
  leerRestablecimientos,
  marcarRestablecimiento,
  minutosDeEspera,
  motivoDelErrorDePerfil,
  type Usuario,
} from './administracion'
import { DialogoContrasena } from './DialogoContrasena'
import { DialogoEditarUsuario } from './DialogoEditarUsuario'
import { DialogoNuevoUsuario } from './DialogoNuevoUsuario'
import type { ValoresEdicion, ValoresNuevo } from './esquemas'
import { TablaUsuarios } from './TablaUsuarios'

export function PaginaUsuarios() {
  const queryClient = useQueryClient()
  const sesion = useSesion()
  const miId = sesion.estado === 'con-sesion' ? sesion.usuarioId : null
  const [usuarioEditado, setUsuarioEditado] = useState<Usuario | null>(null)
  const [usuarioContrasena, setUsuarioContrasena] = useState<Usuario | null>(null)
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [bloqueos, setBloqueos] = useState(leerRestablecimientos)

  const usuarios = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const data = await invocarAdministracion<{ usuarios: Usuario[] }>({ accion: 'listar' })
      return data.usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre))
    },
  })

  /**
   * El perfil se escribe directo contra la tabla y no por la Edge Function: la
   * política `perfil_admin` ya deja al admin escribir cualquier renglón, así
   * que meter un salto de más no compraría nada.
   */
  const actualizacion = useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: ValoresEdicion }) => {
      const { error } = await supabase
        .from('perfil')
        .update({
          nombre: valores.nombre,
          rol: valores.rol,
          almacen_id: valores.almacenId ? Number(valores.almacenId) : null,
        })
        .eq('id', id)
      if (error) throw new Error(motivoDelErrorDePerfil(error))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setUsuarioEditado(null)
      setAviso('Los cambios quedaron guardados.')
    },
  })

  const nuevoUsuario = useMutation({
    mutationFn: async (valores: ValoresNuevo) => {
      await invocarAdministracion<{ ok?: boolean }>({
        accion: 'crear',
        nombre: valores.nombre,
        correo: valores.correo,
        rol: valores.rol,
        almacen_id: valores.almacenId ? Number(valores.almacenId) : null,
        password: valores.contrasena,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setNuevoAbierto(false)
      setAviso('Usuario creado. Ya puede entrar con su correo y la contraseña inicial.')
    },
  })

  /** La vía sin correo: el admin teclea la contraseña y la entrega él mismo. */
  const contrasenaDirecta = useMutation({
    mutationFn: async ({ id, contrasena }: { id: string; contrasena: string }) => {
      await invocarAdministracion({ accion: 'establecer_password', usuario_id: id, password: contrasena })
    },
    onSuccess: () => {
      setUsuarioContrasena(null)
      setAviso('Contraseña cambiada. Entrégasela a la persona por un canal privado.')
    },
  })

  const enlaceCorreo = useMutation({
    mutationFn: async (usuarioId: string) => {
      await invocarAdministracion({ accion: 'restablecer', usuario_id: usuarioId })
    },
    onSuccess: (_datos, usuarioId) => {
      setBloqueos(marcarRestablecimiento(usuarioId))
      setUsuarioContrasena(null)
      setAviso('Se envió el enlace de recuperación. Evita repetirlo durante la próxima hora.')
    },
  })

  /**
   * Cerrar un diálogo tiene que limpiar el error de su mutación. Sin esto, el
   * fallo del intento anterior seguía puesto al volver a abrirlo, hablando de
   * algo que ya no estaba pasando.
   */
  function cerrarNuevo() {
    setNuevoAbierto(false)
    nuevoUsuario.reset()
  }

  function cerrarEdicion() {
    setUsuarioEditado(null)
    actualizacion.reset()
  }

  function cerrarContrasena() {
    setUsuarioContrasena(null)
    contrasenaDirecta.reset()
    enlaceCorreo.reset()
  }

  function abrirContrasena(usuario: Usuario) {
    // Los diálogos no se apilan: el de contraseña reemplaza al de edición.
    setUsuarioEditado(null)
    actualizacion.reset()
    contrasenaDirecta.reset()
    enlaceCorreo.reset()
    setUsuarioContrasena(usuario)
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Administración de usuarios"
        descripcion="Gestionar usuarios, roles y accesos del sistema"
        acciones={
          <Button
            variant="contained"
            startIcon={<Icon icon="mdi:plus" width={20} />}
            onClick={() => setNuevoAbierto(true)}
          >
            Nuevo usuario
          </Button>
        }
      />

      <CuerpoPagina>
        {usuarios.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            No se pudo leer la lista de usuarios: {usuarios.error.message}
          </Alert>
        ) : null}

        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <Icon icon="mdi:account-group-outline" width={22} color="var(--mui-palette-primary-main)" />
              <Typography variant="h2" sx={{ color: 'primary.main' }}>
                Usuarios registrados
              </Typography>
              {usuarios.data ? (
                <Typography sx={{ color: 'text.secondary' }}>({usuarios.data.length})</Typography>
              ) : null}
            </Stack>

            <TablaUsuarios
              usuarios={usuarios.data ?? []}
              cargando={usuarios.isPending}
              onEditar={setUsuarioEditado}
              onContrasena={abrirContrasena}
            />
          </CardContent>
        </Card>
      </CuerpoPagina>

      <DialogoNuevoUsuario
        abierto={nuevoAbierto}
        guardando={nuevoUsuario.isPending}
        error={nuevoUsuario.error?.message ?? null}
        onCerrar={cerrarNuevo}
        onGuardar={(valores) => nuevoUsuario.mutate(valores)}
      />

      <DialogoEditarUsuario
        usuario={usuarioEditado}
        esMiCuenta={usuarioEditado !== null && usuarioEditado.id === miId}
        guardando={actualizacion.isPending}
        error={actualizacion.error?.message ?? null}
        onCerrar={cerrarEdicion}
        onGuardar={(valores) => {
          if (usuarioEditado) actualizacion.mutate({ id: usuarioEditado.id, valores })
        }}
        onContrasena={() => {
          if (usuarioEditado) abrirContrasena(usuarioEditado)
        }}
      />

      <DialogoContrasena
        usuario={usuarioContrasena}
        minutosEspera={usuarioContrasena ? minutosDeEspera(usuarioContrasena.id, bloqueos) : 0}
        guardando={contrasenaDirecta.isPending}
        enviando={enlaceCorreo.isPending}
        errorDirecta={contrasenaDirecta.error?.message ?? null}
        errorCorreo={enlaceCorreo.error?.message ?? null}
        onCerrar={cerrarContrasena}
        onEstablecer={(contrasena) => {
          if (usuarioContrasena) contrasenaDirecta.mutate({ id: usuarioContrasena.id, contrasena })
        }}
        onEnviarEnlace={() => {
          if (usuarioContrasena) enlaceCorreo.mutate(usuarioContrasena.id)
        }}
      />

      <Snackbar
        open={aviso !== null}
        autoHideDuration={6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      </Snackbar>
    </>
  )
}
