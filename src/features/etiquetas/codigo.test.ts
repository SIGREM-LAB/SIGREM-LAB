import { describe, expect, test } from 'vitest'

import {
  PAUSA_MAXIMA_MS,
  RAFAGA_VACIA,
  esCodigo,
  interpretarTecla,
  rutaDeCodigo,
  type Rafaga,
} from './codigo'

/** Teclea `texto` con `pausa` ms entre tecla y tecla y remata con Enter. */
function teclear(texto: string, pausa: number): string | null {
  let rafaga: Rafaga = RAFAGA_VACIA
  let t = 1000
  for (const tecla of [...texto, 'Enter']) {
    t += pausa
    const r = interpretarTecla(rafaga, tecla, t)
    rafaga = r.rafaga
    if (tecla === 'Enter') return r.codigo
  }
  return null
}

describe('esCodigo', () => {
  test.each(['N3-00717', 'UCL-N3-01507', 'n4-00001', ' ICSa-00019 '])('acepta %s', (c) => {
    expect(esCodigo(c)).toBe(true)
  })

  test.each(['', 'N3', 'N3-717', 'N3-007170', 'sulfato', 'N3 00717'])('rechaza «%s»', (c) => {
    expect(esCodigo(c)).toBe(false)
  })
})

describe('rutaDeCodigo', () => {
  test('el responsable va a su inventario', () => {
    expect(rutaDeCodigo('n3-00717', true)).toBe('/inventario?codigo=N3-00717')
  })

  test('admin y consulta van al general', () => {
    expect(rutaDeCodigo('N3-00717', false)).toBe('/inventario-general?codigo=N3-00717')
  })
})

describe('interpretarTecla', () => {
  test('una ráfaga de pistola con Enter da el código', () => {
    expect(teclear('N3-00717', 5)).toBe('N3-00717')
  })

  test('alguien tecleando despacio no cuenta como escaneo', () => {
    expect(teclear('N3-00717', PAUSA_MAXIMA_MS + 50)).toBeNull()
  })

  test('una ráfaga que no tiene forma de código se ignora', () => {
    expect(teclear('hola mundo', 5)).toBeNull()
  })

  test('las teclas con nombre (Shift) no rompen la ráfaga', () => {
    let rafaga = RAFAGA_VACIA
    let codigo: string | null = null
    let t = 0
    for (const tecla of ['Shift', 'N', '3', '-', '0', '0', '7', '1', '7', 'Enter']) {
      t += 5
      const r = interpretarTecla(rafaga, tecla, t)
      rafaga = r.rafaga
      codigo = r.codigo
    }
    expect(codigo).toBe('N3-00717')
  })
})
