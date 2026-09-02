import { describe, expect, test } from 'vitest'

import { mensajeDeError } from './consultas'

describe('mensajeDeError', () => {
  test('un nombre de asignatura repetido se explica', () => {
    const mensaje = mensajeDeError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "asignatura_nombre_norm_idx"',
    })

    expect(mensaje).toBe('Ya existe una asignatura con ese nombre')
  })

  test('un número de práctica repetido se explica', () => {
    const mensaje = mensajeDeError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "practica_catalogo_asignatura_id_numero_key"',
    })

    expect(mensaje).toBe('Ya hay una práctica con ese número en esta asignatura')
  })

  test('una asignatura ya vinculada se explica', () => {
    const mensaje = mensajeDeError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "programa_asignatura_pkey"',
    })

    expect(mensaje).toBe('Esta asignatura ya está en el programa')
  })

  test('un borrado que rompe una referencia se explica', () => {
    expect(mensajeDeError({ code: '23503', message: 'violates foreign key constraint' })).toBe(
      'No se puede borrar: hay prácticas registradas que lo usan',
    )
  })

  test('un semestre fuera de rango se explica', () => {
    expect(mensajeDeError({ code: '23514', message: 'violates check constraint' })).toBe(
      'El semestre va del 1 al 12',
    )
  })

  // El caso que importa que NO se rompa: un error que no conocemos tiene que
  // llegar al usuario con su texto, no con un "algo salió mal" que esconde la
  // pista. Y algo que no es un error de Postgres tampoco puede reventar aquí.
  test('un error desconocido conserva su mensaje', () => {
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe(
      'permission denied',
    )
  })

  test('algo que no es un error de Postgres no revienta', () => {
    expect(mensajeDeError(null)).toBe('No se pudo completar la operación')
    expect(mensajeDeError('vaya')).toBe('No se pudo completar la operación')
  })
})
