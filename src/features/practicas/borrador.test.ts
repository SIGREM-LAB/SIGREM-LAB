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

const NOMBRES = { asignatura: 'Bioquímica', laboratorio: 'Laboratorio de docencia N3' }

const SIN_NOMBRES = { asignatura: null, laboratorio: null }

describe('serializar y restaurar', () => {
  test('ida y vuelta es identidad', () => {
    const guardado = serializarBorrador(CABECERA, NOMBRES, [ELEMENTO])
    const recuperado = restaurarBorrador(JSON.parse(JSON.stringify(guardado)))

    expect(recuperado).toEqual({ cabecera: CABECERA, nombres: NOMBRES, elementos: [ELEMENTO] })
  })

  test('lo guardado lleva la versión, que es lo que permite descartarlo después', () => {
    expect(serializarBorrador(CABECERA, NOMBRES, []).version).toBe(VERSION_BORRADOR)
  })

  test('una cabecera a medias se guarda igual: para eso es un borrador', () => {
    const guardado = serializarBorrador({ programaId: 1 }, SIN_NOMBRES, [])

    expect(restaurarBorrador(guardado)).toEqual({
      cabecera: { programaId: 1 },
      nombres: SIN_NOMBRES,
      elementos: [],
    })
  })

  // El renglón "En curso" del historial se pinta con esto y no resolviendo los
  // ids contra los catálogos: es la misma razón por la que ElementoCaptura
  // guarda el nombre del producto junto al id.
  test('los nombres viajan en el borrador, para que el historial no tenga que resolverlos', () => {
    const guardado = serializarBorrador(CABECERA, NOMBRES, [ELEMENTO])

    expect(restaurarBorrador(guardado)?.nombres).toEqual(NOMBRES)
  })
})

describe('restaurarBorrador descarta lo que no entiende', () => {
  test('una versión distinta se descarta entera', () => {
    const viejo = { ...serializarBorrador(CABECERA, NOMBRES, [ELEMENTO]), version: 999 }

    expect(restaurarBorrador(viejo)).toBeNull()
  })

  // El caso real de la migración a v2: un borrador guardado antes de que la
  // cabecera llevara nombres. No se intenta rescatar rellenando con nulos,
  // porque media captura restaurada es peor que ninguna.
  test('un borrador de la versión 1 se descarta', () => {
    const v1 = { version: 1, cabecera: CABECERA, elementos: [ELEMENTO] }

    expect(restaurarBorrador(v1)).toBeNull()
  })

  test.each([
    ['null', null],
    ['un número', 7],
    ['una cadena', 'borrador'],
    ['un arreglo', []],
    ['un objeto sin versión', { cabecera: {}, nombres: SIN_NOMBRES, elementos: [] }],
    [
      'elementos que no son arreglo',
      { version: VERSION_BORRADOR, cabecera: {}, nombres: SIN_NOMBRES, elementos: 'no' },
    ],
    [
      'cabecera que no es objeto',
      { version: VERSION_BORRADOR, cabecera: 'no', nombres: SIN_NOMBRES, elementos: [] },
    ],
    [
      'nombres que no son objeto',
      { version: VERSION_BORRADOR, cabecera: {}, nombres: 'no', elementos: [] },
    ],
  ])('%s se descarta sin reventar', (_nombre, crudo) => {
    expect(restaurarBorrador(crudo)).toBeNull()
  })

  // Un elemento sin existenciaId no se puede registrar: la RPC lo necesita para
  // saber sobre qué existencia escribir. Se cae el borrador entero y no sólo esa
  // fila: restaurar la mitad de una captura es peor que no restaurarla, porque
  // la persona no sabe qué le falta.
  test('un elemento sin existenciaId tumba el borrador completo', () => {
    const roto = serializarBorrador(CABECERA, NOMBRES, [
      ELEMENTO,
      { ...ELEMENTO, existenciaId: undefined as unknown as number },
    ])

    expect(restaurarBorrador(roto)).toBeNull()
  })

  test('un elemento con un método que no existe tumba el borrador', () => {
    const roto = serializarBorrador(CABECERA, NOMBRES, [
      { ...ELEMENTO, metodo: 'telepatia' as unknown as typeof ELEMENTO.metodo },
    ])

    expect(restaurarBorrador(roto)).toBeNull()
  })
})
