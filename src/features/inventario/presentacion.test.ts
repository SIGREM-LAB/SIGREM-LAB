import { describe, expect, test } from 'vitest'

import { aspectoDeEstado, cortarNombre, ESTADO, normalizarTermino } from './presentacion'

describe('cortarNombre', () => {
  test('separa la sustancia de sus caracteristicas', () => {
    expect(
      cortarNombre('Acetona, líquido, grado A.C.S., pureza 99.5%, presentación 4 L, CAS: 67-64-1'),
    ).toEqual({
      cabeza: 'Acetona',
      resto: 'líquido · grado A.C.S. · pureza 99.5% · presentación 4 L',
    })
  })

  // El caso que rompe la version ingenua: la coma de "1,10" viene antes que la
  // que de verdad separa, asi que cortar en la primera coma daria la cabeza "1".
  // Es la primera fila real de la base, no un caso inventado.
  test('no parte el nombre quimico por sus propias comas', () => {
    expect(
      cortarNombre('1,10-Fenantrolina monohidrato, sólido, pureza 99%, CAS: 5144-89-8'),
    ).toEqual({
      cabeza: '1,10-Fenantrolina monohidrato',
      resto: 'sólido · pureza 99%',
    })
  })

  test('deja intacto un nombre sin comas', () => {
    expect(cortarNombre('Matraz volumétrico')).toEqual({
      cabeza: 'Matraz volumétrico',
      resto: '',
    })
  })

  test('tira el CAS, que ya sale en el panel de detalle', () => {
    expect(cortarNombre('Etanol, líquido, CAS: 64-17-5').resto).toBe('líquido')
  })

  // La vista devuelve todas sus columnas anulables, asi que esto llega.
  test('sobrevive a un nombre vacio', () => {
    expect(cortarNombre('')).toEqual({ cabeza: '', resto: '' })
  })
})

describe('normalizarTermino', () => {
  // Los tres casos estan verificados contra public.norm_texto() en la base: si
  // dejan de coincidir, buscar "acido" deja de encontrar "Ácido".
  test.each([
    ['Ácido clorhídrico', 'acido clorhidrico'],
    ['Ñandú', 'nandu'],
    ['ÜBER', 'uber'],
  ])('normaliza %s igual que norm_texto', (entrada, esperado) => {
    expect(normalizarTermino(entrada)).toBe(esperado)
  })

  // PostgREST separa los argumentos de or() por comas y agrupa con parentesis.
  // Quien teclea "acido, (99%)" no pide nada raro; sin limpiar, la consulta sale
  // malformada.
  test('quita los caracteres que romperian el filtro or() de PostgREST', () => {
    expect(normalizarTermino('acido, (99%)*')).toBe('acido 99%')
  })

  test('recorta los espacios de los extremos', () => {
    expect(normalizarTermino('  acetona  ')).toBe('acetona')
  })
})

describe('ESTADO', () => {
  test('cubre los seis estados del enum', () => {
    expect(Object.keys(ESTADO).sort()).toEqual([
      'agotado',
      'baja',
      'contaminado',
      'disponible',
      'mantenimiento',
      'stock_bajo',
    ])
  })

  // El guinda institucional (#C10230) esta por toda la interfaz. Si "Agotado"
  // usara un rojo parecido, el estado mas importante de la pantalla se
  // confundiria con el color de la marca.
  test('el rojo de agotado no es el guinda institucional', () => {
    expect(ESTADO.agotado.color.toUpperCase()).not.toBe('#C10230')
    expect(ESTADO.agotado.color.toUpperCase()).not.toBe('#A21A19')
  })
})

describe('aspectoDeEstado', () => {
  test('traduce el valor del enum a su etiqueta', () => {
    expect(aspectoDeEstado('stock_bajo').etiqueta).toBe('Stock bajo')
  })

  // En la tabla `estado` es not null, pero la vista lo expone anulable y el tipo
  // generado lo refleja. Se resuelve en un solo lugar, no con un `?.` regado.
  test('sin estado devuelve un aspecto neutro en vez de reventar', () => {
    expect(aspectoDeEstado(null).etiqueta).toBe('—')
  })
})
