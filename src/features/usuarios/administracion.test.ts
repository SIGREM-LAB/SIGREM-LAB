import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'

import { minutosDeEspera, motivoDelError, motivoDelErrorDePerfil } from './administracion'

/** Lo que `functions.invoke` guarda en `error.context`: la respuesta sin leer. */
function respuesta(cuerpo: unknown, status = 400) {
  return new FunctionsHttpError(
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('motivoDelError', () => {
  /**
   * El caso que rompía la pantalla: `error.message` es siempre la misma frase
   * en inglés, y el motivo real viaja en el cuerpo de la respuesta.
   */
  test('saca el motivo del cuerpo de la respuesta', async () => {
    const error = respuesta({ error: 'Ya existe una cuenta con ese correo electrónico' }, 409)

    expect(await motivoDelError(error)).toBe('Ya existe una cuenta con ese correo electrónico')
  })

  test('un cuerpo sin campo error deja el mensaje de la librería', async () => {
    const error = respuesta({ mensaje: 'otra cosa' })

    expect(await motivoDelError(error)).toBe(error.message)
  })

  test('un cuerpo que no es JSON no revienta', async () => {
    const error = new FunctionsHttpError(new Response('<html>502</html>', { status: 502 }))

    expect(await motivoDelError(error)).toBe(error.message)
  })

  test('un fallo de red no tiene cuerpo que leer', async () => {
    const error = new FunctionsFetchError({ requestId: 'abc' })

    expect(await motivoDelError(error)).toBe(error.message)
  })
})

describe('motivoDelErrorDePerfil', () => {
  /** El candado del ultimo admin llega desde un trigger, en el idioma del servidor. */
  test('traduce el candado del último administrador a algo accionable', () => {
    const error = { code: 'P0001', message: 'El sistema se quedaria sin administradores' }

    expect(motivoDelErrorDePerfil(error)).toBe(
      'Eres el último administrador. Nombra a otro antes de quitarte el rol.',
    )
  })

  test('traduce el check de responsable sin almacén', () => {
    const error = {
      code: '23514',
      message: 'new row violates check constraint "perfil_responsable_con_almacen"',
    }

    expect(motivoDelErrorDePerfil(error)).toBe('Un responsable necesita un almacén asignado.')
  })

  test('un error que no conoce lo deja pasar tal cual', () => {
    expect(motivoDelErrorDePerfil({ code: 'XX000', message: 'algo raro' })).toBe('algo raro')
  })

  test('lo que no es un error tiene su propio texto', () => {
    expect(motivoDelErrorDePerfil(null)).toBe('No se pudieron guardar los cambios')
  })
})

describe('minutosDeEspera', () => {
  test('sin envío previo no hay espera', () => {
    expect(minutosDeEspera('u-1', {})).toBe(0)
  })

  test('un bloqueo ya vencido tampoco frena', () => {
    expect(minutosDeEspera('u-1', { 'u-1': Date.now() - 1000 })).toBe(0)
  })

  test('redondea hacia arriba: quedan 2 min, no 1', () => {
    expect(minutosDeEspera('u-1', { 'u-1': Date.now() + 90_000 })).toBe(2)
  })
})
