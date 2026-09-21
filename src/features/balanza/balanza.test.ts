import { describe, expect, test } from 'vitest'

import { parsearTramaOptika } from './balanza'

/**
 * Tramas reales, capturadas de la balanza del laboratorio por COM4 a 9600 8N1.
 * No son ejemplos inventados: son los bytes que salieron, y son la razon por la
 * que el indicador de estabilidad se lee como `S`.
 */
const ESTABLE_CERO = '     0.00 g S\r\n'
const INESTABLE_CERO = '     0.00 g  \r\n'
const ESTABLE_483 = '   483.96 g S\r\n'
const INESTABLE_483 = '   483.96 g  \r\n'
const NEGATIVA = '-    2.50 g S\r\n'

describe('parsearTramaOptika', () => {
  test('lee el peso, la unidad y la estabilidad de una trama real', () => {
    expect(parsearTramaOptika(ESTABLE_483)).toEqual({
      valor: 483.96,
      unidad: 'g',
      estable: true,
    })
  })

  test('un espacio en la posicion de estabilidad es "no estable"', () => {
    expect(parsearTramaOptika(INESTABLE_483)).toEqual({
      valor: 483.96,
      unidad: 'g',
      estable: false,
    })
  })

  test('el cero tambien se lee', () => {
    expect(parsearTramaOptika(ESTABLE_CERO)).toEqual({ valor: 0, unidad: 'g', estable: true })
    expect(parsearTramaOptika(INESTABLE_CERO)).toEqual({ valor: 0, unidad: 'g', estable: false })
  })

  test('el signo menos del primer caracter vuelve negativo el peso', () => {
    expect(parsearTramaOptika(NEGATIVA)?.valor).toBe(-2.5)
  })

  test('acepta otra unidad y la recorta', () => {
    // El campo de unidad son tres caracteres: aqui `ct` viene con relleno.
    expect(parsearTramaOptika('     1.50ct S\r\n')?.unidad).toBe('ct')
  })

  // El manual ingles marca la estabilidad como propia del modo continuo; una
  // trama sin ella no puede darse por estable.
  test('sin indicador de estabilidad no esta estable', () => {
    expect(parsearTramaOptika('     0.00 g \r\n')?.estable).toBe(false)
  })

  test.each([
    ['vacia', ''],
    ['sin terminador', '     0.00 g S'],
    ['basura', 'hola\r\n'],
    ['corta', '0.00\r\n'],
    ['peso no numerico', '      abc g S\r\n'],
  ])('devuelve null con una trama %s', (_caso, trama) => {
    expect(parsearTramaOptika(trama)).toBeNull()
  })
})
