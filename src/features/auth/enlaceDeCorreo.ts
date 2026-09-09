/**
 * Lo que Supabase deja en la URL cuando un enlace de correo no sirve.
 *
 * El caso real que motivó esto: un enlace de recuperación caducado aterriza en
 *
 *   https://sigrem-lab.vercel.app/#error=access_denied&error_code=otp_expired&…
 *
 * y ahí se perdía. `RutaProtegida` ve que no hay sesión y navega a `/entrar`;
 * react-router reescribe la URL sin fragmento, así que para cuando cualquier
 * pantalla podría leerlo, el motivo ya no existe. La persona se queda mirando
 * un formulario de acceso que no le dice nada.
 *
 * De ahí que la captura sea a la carga del módulo y no dentro de un componente:
 * es el único momento garantizado antes de que el enrutador toque la URL.
 * supabase-js tampoco estorba —en la rama de error NO limpia el fragmento, solo
 * lo hace cuando el enlace trae una sesión válida—.
 */

/** Los códigos que vale la pena explicar con nuestras palabras. */
const MENSAJES: Record<string, string> = {
  otp_expired:
    'El enlace ya no sirve: caducó o se abrió una vez antes que tú. Pide otro y ábrelo enseguida, ' +
    'sin reenviar el correo: el enlace es de un solo uso y cualquier cosa que lo visite lo gasta.',
  access_denied: 'El enlace no es válido. Pide otro desde «¿Olvidaste tu contraseña?».',
  server_error: 'Supabase no pudo validar el enlace. Espera un momento y pide otro.',
}

/**
 * El aviso que toca, o `null` si el fragmento no habla de ningún error.
 *
 * Puro a propósito: la parte que toca `window` va aparte y esta se prueba sola.
 */
export function mensajeDeEnlace(fragmento: string): string | null {
  const parametros = new URLSearchParams(fragmento.replace(/^[#?]/, ''))
  const codigo = parametros.get('error_code')
  const descripcion = parametros.get('error_description')

  if (!codigo && !descripcion && !parametros.get('error')) return null

  // `error_code` primero: un enlace caducado llega como `access_denied` con
  // `otp_expired` dentro, y el específico es el que explica qué pasó.
  return (
    (codigo ? MENSAJES[codigo] : undefined) ??
    (parametros.get('error') ? MENSAJES[parametros.get('error') as string] : undefined) ??
    descripcion ??
    'El enlace del correo no se pudo validar. Pide otro.'
  )
}

let capturado: string | null = null

/**
 * Se llama una sola vez, al cargar la app, y deja la URL limpia: sin eso una
 * recarga repetiría el aviso de un enlace que ya nadie va a usar.
 */
export function capturarEnlaceFallido(ubicacion: Location = window.location): void {
  const enElFragmento = mensajeDeEnlace(ubicacion.hash)
  capturado = enElFragmento ?? mensajeDeEnlace(ubicacion.search)
  if (capturado === null) return

  // Si el error venía en la query, la query se va con él; si venía en el
  // fragmento, lo que sobra es solo el fragmento.
  window.history.replaceState(
    null,
    '',
    enElFragmento === null ? ubicacion.pathname : ubicacion.pathname + ubicacion.search,
  )
}

/** El aviso capturado al arrancar, para la pantalla que acabe mostrándolo. */
export function enlaceFallido(): string | null {
  return capturado
}

/** Solo para las pruebas: devuelve el módulo a su estado de arranque. */
export function olvidarEnlaceFallido(): void {
  capturado = null
}
