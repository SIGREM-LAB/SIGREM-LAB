import { describe, expect, test } from 'vitest'

import { mensajeDeError } from './consultas'

describe('mensajeDeError', () => {
  test('traduce el choque de nombre de laboratorio', () => {
    expect(
      mensajeDeError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "laboratorio_almacen_id_nombre_key"',
      }),
    ).toBe('Ya hay un laboratorio con ese nombre en este almacén')
  })

  test('traduce el choque de clave de motivo', () => {
    expect(
      mensajeDeError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "motivo_observacion_pkey"',
      }),
    ).toBe('Ya existe un motivo con esa clave')
  })

  // 42501 es lo que responde la RLS o un privilegio que falta. Decir «no tienes
  // permiso» es lo unico accionable: el usuario no puede hacer nada con
  // «new row violates row-level security policy».
  test('traduce el rechazo de la RLS', () => {
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe(
      'No tienes permiso para cambiar esto. Revisa que sea de tu almacén.',
    )
  })

  // Lo desconocido pasa con su mensaje original, por lo mismo que en academico:
  // un «algo salio mal» generico esconde justo la pista que hace falta para
  // arreglarlo.
  test('lo desconocido pasa con su mensaje', () => {
    expect(mensajeDeError({ code: 'XX000', message: 'boom' })).toBe('boom')
    expect(mensajeDeError('no es un objeto')).toBe('No se pudo completar la operación')
  })
})
