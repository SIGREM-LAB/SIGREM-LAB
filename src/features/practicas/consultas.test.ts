import { describe, expect, test } from 'vitest'

import { mensajeDeError, motivosDeMetodo, type Motivo } from './consultas'

const MOTIVOS: Motivo[] = [
  { clave: 'no_tenemos', etiqueta: 'No tenemos', metodos: ['peso', 'cantidad'] },
  { clave: 'material_daniado', etiqueta: 'Material dañado', metodos: ['cantidad'] },
  { clave: 'equipo_daniado', etiqueta: 'Equipo dañado', metodos: ['prestamo'] },
  { clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] },
]

describe('motivosDeMetodo', () => {
  test('el panel de préstamo no ofrece "Material dañado"', () => {
    expect(motivosDeMetodo(MOTIVOS, 'prestamo').map((m) => m.clave)).toEqual([
      'equipo_daniado',
      'otro',
    ])
  })

  test('el de cantidad ofrece los consumibles y su propio dañado', () => {
    expect(motivosDeMetodo(MOTIVOS, 'cantidad').map((m) => m.clave)).toEqual([
      'no_tenemos',
      'material_daniado',
      'otro',
    ])
  })

  test('conserva el orden en que vinieron, que es el de la consulta', () => {
    expect(motivosDeMetodo(MOTIVOS, 'peso').map((m) => m.clave)).toEqual(['no_tenemos', 'otro'])
  })
})

describe('mensajeDeError', () => {
  test('42501 explica que el almacén no es el suyo, no "permission denied"', () => {
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe(
      'No puedes registrar prácticas en este almacén. Revisa el laboratorio elegido.',
    )
  })

  test('el check de los pesos se traduce', () => {
    expect(
      mensajeDeError({
        code: '23514',
        message: 'violates check constraint "practica_elemento_peso_coherente"',
      }),
    ).toBe('El peso final no puede ser mayor que el inicial')
  })

  test('el check de la devolución se traduce', () => {
    expect(
      mensajeDeError({
        code: '23514',
        message: 'violates check constraint "practica_elemento_devolucion_coherente"',
      }),
    ).toBe('Lo devuelto y lo dañado no pueden sumar más de lo entregado')
  })

  // La excepción de aplicar_movimiento cuando el consumo deja la existencia en
  // negativo. No es un código: es un raise exception con texto, y ese texto ya
  // dice lo que hay que decir.
  test('un saldo negativo se muestra tal cual lo dice la base', () => {
    const mensaje =
      'El movimiento dejaria la existencia 12 en -3; la cantidad no puede ser negativa'

    expect(mensajeDeError({ code: 'P0001', message: mensaje })).toBe(mensaje)
  })

  test('la práctica sin productos se traduce', () => {
    expect(
      mensajeDeError({ code: 'P0001', message: 'Una practica necesita al menos un producto' }),
    ).toBe('Agrega al menos un producto antes de finalizar')
  })

  // Lo desconocido pasa con su mensaje original a propósito: un "algo salió mal"
  // genérico esconde justo la pista que hace falta para arreglarlo.
  test('lo desconocido conserva su mensaje', () => {
    expect(mensajeDeError({ code: '23999', message: 'algo raro' })).toBe('algo raro')
  })

  test('lo que ni siquiera es un objeto tiene su propio mensaje', () => {
    expect(mensajeDeError('vaya')).toBe('No se pudo completar la operación')
    expect(mensajeDeError(null)).toBe('No se pudo completar la operación')
  })
})
