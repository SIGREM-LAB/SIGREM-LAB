import { afterEach, describe, expect, test } from 'vitest'

import {
  capturarEnlaceFallido,
  enlaceFallido,
  mensajeDeEnlace,
  olvidarEnlaceFallido,
} from './enlaceDeCorreo'

afterEach(olvidarEnlaceFallido)

/** El fragmento real de un enlace de recuperación caducado. */
const CADUCADO =
  '#error=access_denied&error_code=otp_expired' +
  '&error_description=Email+link+is+invalid+or+has+expired&sb='

describe('mensajeDeEnlace', () => {
  test('una URL limpia no dice nada', () => {
    expect(mensajeDeEnlace('')).toBeNull()
    expect(mensajeDeEnlace('#access_token=abc&type=recovery')).toBeNull()
  })

  /**
   * Un enlace caducado llega como `access_denied` con `otp_expired` dentro. El
   * específico es el que explica qué pasó, así que manda sobre el genérico.
   */
  test('el enlace caducado explica que es de un solo uso', () => {
    const mensaje = mensajeDeEnlace(CADUCADO)

    expect(mensaje).toMatch(/caducó o se abrió una vez antes que tú/)
    expect(mensaje).toMatch(/un solo uso/)
  })

  test('un código que no conocemos cae en la descripción de Supabase', () => {
    expect(mensajeDeEnlace('#error_code=algo_raro&error_description=Something+odd')).toBe(
      'Something odd',
    )
  })

  test('un error sin descripción tampoco se queda mudo', () => {
    expect(mensajeDeEnlace('#error=otra_cosa')).toBe('El enlace del correo no se pudo validar. Pide otro.')
  })
})

describe('capturarEnlaceFallido', () => {
  function ubicacion(hash: string, search = '', pathname = '/'): Location {
    return { hash, search, pathname } as Location
  }

  test('guarda el motivo y limpia el fragmento', () => {
    capturarEnlaceFallido(ubicacion(CADUCADO, '', '/recuperar-contrasena'))

    expect(enlaceFallido()).toMatch(/caducó/)
    expect(window.location.hash).toBe('')
  })

  /**
   * La razón de capturar al arrancar: react-router reescribe la URL al navegar
   * a /entrar y se lleva el fragmento. Lo guardado tiene que sobrevivir a eso.
   */
  test('lo guardado sobrevive a que la URL cambie después', () => {
    capturarEnlaceFallido(ubicacion(CADUCADO))
    window.history.replaceState(null, '', '/entrar')

    expect(enlaceFallido()).toMatch(/caducó/)
  })

  test('sin error en la URL no guarda nada', () => {
    capturarEnlaceFallido(ubicacion('#access_token=abc'))

    expect(enlaceFallido()).toBeNull()
  })

  test('también lo lee de la query, no solo del fragmento', () => {
    capturarEnlaceFallido(ubicacion('', '?error_code=otp_expired'))

    expect(enlaceFallido()).toMatch(/caducó/)
  })
})
