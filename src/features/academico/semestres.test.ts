import { describe, expect, test } from 'vitest'

import { agruparPorSemestre, etiquetaSemestre, SEMESTRES } from './semestres'

describe('etiquetaSemestre', () => {
  test('un número se muestra con el símbolo de grado', () => {
    expect(etiquetaSemestre(3)).toBe('3°')
  })

  // NULL no es "sin semestre" ni un hueco: es una optativa, que es una cosa que
  // el plan de estudios sí tiene.
  test('sin semestre es una optativa', () => {
    expect(etiquetaSemestre(null)).toBe('Optativa')
  })
})

describe('SEMESTRES', () => {
  test('ofrece del 1 al 12 más la optativa', () => {
    expect(SEMESTRES).toHaveLength(13)
    expect(SEMESTRES[0]).toEqual({ valor: 1, etiqueta: '1°' })
    expect(SEMESTRES[12]).toEqual({ valor: null, etiqueta: 'Optativa' })
  })
})

describe('agruparPorSemestre', () => {
  test('agrupa y ordena de menor a mayor', () => {
    const grupos = agruparPorSemestre([
      { semestre: 3, nombre: 'Química Analítica' },
      { semestre: 1, nombre: 'Química General' },
      { semestre: 3, nombre: 'Fisicoquímica I' },
    ])

    expect(grupos.map((g) => g.etiqueta)).toEqual(['1°', '3°'])
    expect(grupos[1].filas.map((f) => f.nombre)).toEqual([
      'Química Analítica',
      'Fisicoquímica I',
    ])
  })

  // La que de verdad importa. Un `order by semestre` ingenuo pone los nulos
  // primero, y entonces lo primero que se ve del plan de estudios son las
  // optativas en vez del primer semestre.
  test('la optativa va al final, no al principio', () => {
    const grupos = agruparPorSemestre([
      { semestre: null, nombre: 'Bromatología' },
      { semestre: 5, nombre: 'Análisis de Alimentos' },
      { semestre: 1, nombre: 'Química General' },
    ])

    expect(grupos.map((g) => g.etiqueta)).toEqual(['1°', '5°', 'Optativa'])
  })

  test('sin filas no hay grupos', () => {
    expect(agruparPorSemestre([])).toEqual([])
  })
})
