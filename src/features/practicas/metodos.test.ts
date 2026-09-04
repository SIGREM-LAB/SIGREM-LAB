import { describe, expect, test } from 'vitest'

import { aspectoDeMetodo, ASPECTO_METODO, ETIQUETA_CLASIFICACION } from './metodos'

describe('aspectoDeMetodo', () => {
  test('cada método tiene etiqueta, título, icono y color', () => {
    for (const metodo of ['peso', 'cantidad', 'prestamo'] as const) {
      const aspecto = aspectoDeMetodo(metodo)

      expect(aspecto.etiqueta.length).toBeGreaterThan(0)
      expect(aspecto.titulo.length).toBeGreaterThan(0)
      expect(aspecto.icono).toMatch(/^mdi:/)
      expect(aspecto.color.length).toBeGreaterThan(0)
    }
  })

  test('el título es el del Panel de Control, con el método dentro', () => {
    expect(aspectoDeMetodo('peso').titulo).toBe('Control por Peso')
    expect(aspectoDeMetodo('cantidad').titulo).toBe('Control por Cantidad')
    expect(aspectoDeMetodo('prestamo').titulo).toBe('Control por Préstamo')
  })

  // La columna metodo_control de la vista sale anulable en los tipos generados
  // aunque la expresión no pueda serlo. Que un null no reviente la tabla.
  test('un método nulo devuelve un aspecto neutro en vez de reventar', () => {
    const aspecto = aspectoDeMetodo(null)

    expect(aspecto.etiqueta).toBe('Sin método')
    expect(aspecto.icono).toMatch(/^mdi:/)
  })

  test('no se le olvida ningún método del enum', () => {
    expect(Object.keys(ASPECTO_METODO).sort()).toEqual(['cantidad', 'peso', 'prestamo'])
  })
})

describe('ETIQUETA_CLASIFICACION', () => {
  test('cubre las seis clasificaciones del formato unificado', () => {
    expect(Object.keys(ETIQUETA_CLASIFICACION).sort()).toEqual([
      'componente',
      'equipo',
      'insumo',
      // Antes que 'material': el guion bajo va antes que la 'l' en el orden de
      // 'sort()', que compara por punto de codigo y no por alfabeto.
      'materia_biologica',
      'material',
      'reactivo',
    ])
  })

  test('la etiqueta es la que ve el usuario, en español y con acentos', () => {
    expect(ETIQUETA_CLASIFICACION.materia_biologica).toBe('Materia biológica')
    expect(ETIQUETA_CLASIFICACION.reactivo).toBe('Reactivo')
  })
})
