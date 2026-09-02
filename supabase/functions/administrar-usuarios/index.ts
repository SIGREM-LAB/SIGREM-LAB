import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Rol = 'admin' | 'responsable' | 'consulta'
type Accion = 'listar' | 'crear' | 'restablecer'

type Solicitud = {
  accion?: unknown
  nombre?: unknown
  correo?: unknown
  rol?: unknown
  almacen_id?: unknown
  usuario_id?: unknown
  password?: unknown
}

function respuesta(cuerpo: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorCliente(mensaje: string, status = 400) {
  return respuesta({ error: mensaje }, status)
}

function urlRedireccion() {
  const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '')
  return appUrl ? `${appUrl}/recuperar-contrasena` : undefined
}

function estadoUsuario(usuario: { email_confirmed_at: string | null; banned_until?: string | null; deleted_at?: string | null }) {
  const bloqueado = usuario.deleted_at !== null && usuario.deleted_at !== undefined
  const baneado = usuario.banned_until !== null && usuario.banned_until !== undefined
    && new Date(usuario.banned_until).getTime() > Date.now()
  if (bloqueado || baneado) return 'desactivado'
  return usuario.email_confirmed_at ? 'activo' : 'pendiente'
}

Deno.serve(async (solicitud) => {
  if (solicitud.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (solicitud.method !== 'POST') return errorCliente('Método no permitido', 405)

  const token = solicitud.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorCliente('La sesión es obligatoria', 401)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) {
    console.error('Faltan secretos de Supabase en la Edge Function')
    return errorCliente('El servicio no está configurado', 500)
  }

  const cliente = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const admin = createClient(url, serviceRoleKey)
  const { data: autenticacion, error: errorAutenticacion } = await admin.auth.getUser(token)
  if (errorAutenticacion || !autenticacion.user) return errorCliente('La sesión no es válida', 401)

  const { data: perfil, error: errorPerfil } = await admin
    .from('perfil')
    .select('rol')
    .eq('id', autenticacion.user.id)
    .single()
  if (errorPerfil || perfil?.rol !== 'admin') return errorCliente('No tienes permisos para administrar usuarios', 403)

  let datos: Solicitud
  try {
    datos = await solicitud.json()
  } catch {
    return errorCliente('El cuerpo de la solicitud no es válido')
  }

  const accion = datos.accion as Accion
  if (accion === 'listar') {
    const perPage = 1000
    const usuariosAuth = []
    for (let pagina = 1; ; pagina += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage })
      if (error) {
        console.error('Error al listar usuarios:', error.message)
        return errorCliente('No se pudo leer la lista de usuarios', 500)
      }
      usuariosAuth.push(...data.users)
      if (data.users.length < perPage) break
    }

    const [{ data: perfiles, error: errorPerfiles }, { data: almacenes, error: errorAlmacenes }] = await Promise.all([
      admin.from('perfil').select('id, nombre, rol, almacen_id, creado_en'),
      admin.from('almacen').select('id, clave, nombre, activo'),
    ])
    if (errorPerfiles || errorAlmacenes) {
      console.error('Error al combinar usuarios:', errorPerfiles?.message ?? errorAlmacenes?.message)
      return errorCliente('No se pudo completar la lista de usuarios', 500)
    }

    const perfilesPorId = new Map((perfiles ?? []).map((perfil) => [perfil.id, perfil]))
    const almacenesPorId = new Map((almacenes ?? []).map((almacen) => [almacen.id, almacen]))
    return respuesta({
      usuarios: usuariosAuth.map((usuario) => {
        const perfil = perfilesPorId.get(usuario.id)
        const almacen = perfil?.almacen_id ? almacenesPorId.get(perfil.almacen_id) ?? null : null
        return {
          id: usuario.id,
          correo: usuario.email ?? null,
          estado: estadoUsuario(usuario),
          nombre: perfil?.nombre ?? usuario.user_metadata?.nombre ?? usuario.email?.split('@')[0] ?? 'Sin nombre',
          rol: perfil?.rol ?? 'consulta',
          almacen_id: perfil?.almacen_id ?? null,
          almacen,
          creado_en: perfil?.creado_en ?? usuario.created_at,
        }
      }),
    })
  }

  if (accion === 'restablecer') {
    if (typeof datos.usuario_id !== 'string' || !datos.usuario_id) return errorCliente('El usuario no es válido')
    const { data: usuario, error: errorUsuario } = await admin.auth.admin.getUserById(datos.usuario_id)
    if (errorUsuario || !usuario.user?.email) return errorCliente('No se encontró el correo del usuario', 404)

    const { error } = await cliente.auth.resetPasswordForEmail(usuario.user.email, {
      ...(urlRedireccion() ? { redirectTo: urlRedireccion() } : {}),
    })
    if (error) {
      const detalle = error.message.toLowerCase()
      if (detalle.includes('rate limit') || detalle.includes('over_email_send_rate_limit') || detalle.includes('429')) {
        return errorCliente('Se alcanzó el límite de correos. Intenta más tarde.', 429)
      }
      console.error('Error al enviar recuperación:', error.message)
      return errorCliente('No se pudo enviar el correo de recuperación', 500)
    }
    return respuesta({ ok: true })
  }

  if (accion !== 'crear') return errorCliente('La operación no es válida')

  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : ''
  const correo = typeof datos.correo === 'string' ? datos.correo.trim().toLowerCase() : ''
  const password = typeof datos.password === 'string' ? datos.password : ''
  const rol = datos.rol as Rol
  const almacenId = datos.almacen_id === null || datos.almacen_id === '' ? null : Number(datos.almacen_id)

  if (!nombre) return errorCliente('El nombre completo es obligatorio')
  if (!correo || !correo.includes('@')) return errorCliente('El correo electrónico no es válido')
  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return errorCliente('La contraseña no cumple los requisitos de seguridad')
  }
  if (!['admin', 'responsable', 'consulta'].includes(rol)) return errorCliente('El rol no es válido')
  if (almacenId !== null && (!Number.isInteger(almacenId) || almacenId <= 0)) return errorCliente('El almacén no es válido')
  if (rol === 'responsable' && almacenId === null) return errorCliente('Un responsable debe tener un almacén asignado')

  if (almacenId !== null) {
    const { data: almacen, error } = await admin.from('almacen').select('id').eq('id', almacenId).eq('activo', true).maybeSingle()
    if (error || !almacen) return errorCliente('El almacén seleccionado no existe o está inactivo')
  }

  const { data: creado, error: errorCreacion } = await admin.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  })
  if (errorCreacion) {
    if (errorCreacion.message.toLowerCase().includes('already') || errorCreacion.message.toLowerCase().includes('registered')) {
      return errorCliente('Ya existe una cuenta con ese correo electrónico', 409)
    }
    console.error('Error al crear usuario:', errorCreacion.message)
    return errorCliente('No se pudo crear la cuenta del usuario', 500)
  }
  if (!creado.user) return errorCliente('Supabase no devolvió la cuenta creada', 500)

  const { error: errorActualizacion } = await admin
    .from('perfil')
    .update({ nombre, rol, almacen_id: almacenId })
    .eq('id', creado.user.id)
  if (errorActualizacion) {
    await admin.auth.admin.deleteUser(creado.user.id)
    console.error('Error al completar el perfil:', errorActualizacion.message)
    return errorCliente('No se pudo completar el perfil del usuario', 500)
  }

  return respuesta({ ok: true, usuario: { id: creado.user.id, nombre, rol, almacen_id: almacenId } })
})
