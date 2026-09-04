import { describe, expect, test } from 'vitest'

import { restaurarBorrador, serializarBorrador, VERSION_BORRADOR } from './borrador'
import { elementoDesdeExistencia } from './esquemas'

const ELEMENTO = {
  ...elementoDesdeExistencia({
    id: 12,
    codigo: 'N3-00042',
    nombre_canonico: 'Etanol 96%',
    clasificacion: 'reactivo' as const,
    unidad_base: 'ml',
    almacen_clave: 'N3',
    cantidad: 2000,
    ubicacion: 'Lab 2',
    metodo_control: 'peso' as const,
  }),
  pesoInicial: 526,
  pesoFinal: 520,
  motivos: ['se_termino'],
}

const CABECERA = {
  programaId: 1,
  semestre: 3,
  asignaturaId: 2,
  practicaCatalogoId: 4,
  laboratorioId: 5,
  fecha: '2026-09-03',
}

describe('serializar y restaurar', () => {
  test('ida y vuelta es identidad', () => {
    const guardado = serializarBorrador(CABECERA, [ELEMENTO])
    const recuperado = restaurarBorrador(JSON.parse(JSON.stringify(guardado)))

    expect(recuperado).toEqual({ cabecera: CABECERA, elementos: [ELEMENTO] })
  })

  test('lo guardado lleva la versión, que es lo que permite descartarlo después', () => {
    expect(serializarBorrador(CABECERA, []).version).toBe(VERSION_BORRADOR)
  })

  test('una cabecera a medias se guarda igual: para eso es un borrador', () => {
    const guardado = serializarBorrador({ programaId: 1 }, [])

    expect(restaurarBorrador(guardado)).toEqual({ cabecera: { programaId: 1 }, elementos: [] })
  })
})

describe('restaurarBorrador descarta lo que no entiende', () => {
  test('una versión distinta se descarta entera', () => {
    const viejo = { ...serializarBorrador(CABECERA, [ELEMENTO]), version: 999 }

    expect(restaurarBorrador(viejo)).toBeNull()
  })

  test.each([
    ['null', null],
    ['un número', 7],
    ['una cadena', 'borrador'],
    ['un arreglo', []],
    ['un objeto sin versión', { cabecera: {}, elementos: [] }],
    ['elementos que no son arreglo', { version: 1, cabecera: {}, elementos: 'no' }],
    ['cabecera que no es objeto', { version: 1, cabecera: 'no', elementos: [] }],
  ])('%s se descarta sin reventar', (_nombre, crudo) => {
    expect(restaurarBorrador(crudo)).toBeNull()
  })

  // Un elemento sin existenciaId no se puede registrar: la RPC lo necesita para
  // saber sobre qué existencia escribir. Se cae el borrador entero y no sólo esa
  // fila: restaurar la mitad de una captura es peor que no restaurarla, porque
  // la persona no sabe qué le falta.
  test('un elemento sin existenciaId tumba el borrador completo', () => {
    const roto = serializarBorrador(CABECERA, [
      ELEMENTO,
      { ...ELEMENTO, existenciaId: undefined as unknown as number },
    ])

    expect(restaurarBorrador(roto)).toBeNull()
  })

  test('un elemento con un método que no existe tumba el borrador', () => {
    const roto = serializarBorrador(CABECERA, [
      { ...ELEMENTO, metodo: 'telepatia' as unknown as typeof ELEMENTO.metodo },
    ])

    expect(restaurarBorrador(roto)).toBeNull()
  })
})
