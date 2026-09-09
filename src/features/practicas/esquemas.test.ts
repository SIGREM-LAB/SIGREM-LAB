import { describe, expect, test } from 'vitest'

import {
  aPayloadElementos,
  consumoDe,
  elementoDesdeExistencia,
  errorDeElemento,
  esFilaUtilizable,
  esquemaCabecera,
  estaCompleto,
  perdidasDe,
  type ElementoCaptura,
} from './esquemas'

const FILA = {
  id: 12,
  codigo: 'N3-00042',
  nombre_canonico: 'Etanol 96%',
  clasificacion: 'reactivo' as const,
  unidad_base: 'ml',
  almacen_clave: 'N3',
  cantidad: 2000,
  ubicacion: 'Lab 2',
  metodo_control: 'peso' as const,
}

function peso(campos: Partial<ElementoCaptura> = {}): ElementoCaptura {
  return { ...elementoDesdeExistencia(FILA), ...campos }
}

function cantidad(campos: Partial<ElementoCaptura> = {}): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      ...FILA,
      clasificacion: 'material',
      metodo_control: 'cantidad',
    }),
    ...campos,
  }
}

function prestamo(campos: Partial<ElementoCaptura> = {}): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      ...FILA,
      clasificacion: 'equipo',
      metodo_control: 'prestamo',
    }),
    ...campos,
  }
}

describe('esFilaUtilizable', () => {
  // La vista marca anulable hasta su llave primaria. El guardia existe para que
  // el nulo no salga de la frontera de datos: una fila sin id no se puede
  // registrar, y rellenarla con 0 mandaría a la RPC una existencia que no es.
  test('una fila con id pasa', () => {
    expect(esFilaUtilizable(FILA)).toBe(true)
  })

  test('una fila sin id no pasa', () => {
    expect(esFilaUtilizable({ ...FILA, id: null })).toBe(false)
  })
})

describe('elementoDesdeExistencia', () => {
  test('nace con todos los campos de captura vacíos', () => {
    const el = peso()

    expect(el.existenciaId).toBe(12)
    expect(el.pesoInicial).toBeNull()
    expect(el.pesoFinal).toBeNull()
    expect(el.motivos).toEqual([])
    expect(el.observaciones).toBe('')
  })

  // La columna sale anulable de los tipos generados aunque la expresión no
  // pueda serlo. Que un nulo no deje al elemento sin método.
  test('un metodo_control nulo se deriva de la clasificación', () => {
    expect(elementoDesdeExistencia({ ...FILA, metodo_control: null }).metodo).toBe('peso')
  })
})

describe('consumoDe y perdidasDe', () => {
  test('el consumo es inicial menos final', () => {
    expect(consumoDe(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBe(6)
  })

  test('sin los dos pesos no hay consumo que mostrar', () => {
    expect(consumoDe(peso({ pesoInicial: 526 }))).toBeNull()
  })

  test('las pérdidas son entregada menos devuelta menos dañada', () => {
    expect(
      perdidasDe(cantidad({ cantidadEntregada: 10, cantidadDevuelta: 7, cantidadDanada: 2 })),
    ).toBe(1)
  })

  test('devuelta y dañada nulas cuentan como cero', () => {
    expect(perdidasDe(cantidad({ cantidadEntregada: 10 }))).toBe(10)
  })

  test('un método que no es el suyo no calcula nada', () => {
    expect(consumoDe(cantidad({ cantidadEntregada: 10 }))).toBeNull()
    expect(perdidasDe(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBeNull()
  })
})

describe('errorDeElemento — peso', () => {
  test('faltan los dos pesos', () => {
    expect(errorDeElemento(peso())).toBe('Captura el peso inicial y el final')
  })

  // El mismo par que practica_elemento_peso_coherente exige en la base. Si esto
  // se relaja, la persona llena todo y revienta al finalizar.
  test('el peso final no puede ser mayor que el inicial', () => {
    expect(errorDeElemento(peso({ pesoInicial: 520, pesoFinal: 526 }))).toBe(
      'El peso final no puede ser mayor que el inicial',
    )
  })

  test('un peso negativo no existe', () => {
    expect(errorDeElemento(peso({ pesoInicial: -1, pesoFinal: -2 }))).toBe(
      'Los pesos no pueden ser negativos',
    )
  })

  test('con los dos pesos coherentes, no hay error', () => {
    expect(errorDeElemento(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBeNull()
  })

  test('pesar lo mismo antes y después es válido: consumo cero', () => {
    expect(errorDeElemento(peso({ pesoInicial: 526, pesoFinal: 526 }))).toBeNull()
  })
})

describe('errorDeElemento — cantidad', () => {
  test('falta la entregada', () => {
    expect(errorDeElemento(cantidad())).toBe('Captura la cantidad entregada')
  })

  // practica_elemento_devolucion_coherente.
  test('lo devuelto y lo dañado no pueden sumar más de lo entregado', () => {
    expect(
      errorDeElemento(cantidad({ cantidadEntregada: 5, cantidadDevuelta: 4, cantidadDanada: 2 })),
    ).toBe('Lo devuelto y lo dañado no pueden sumar más de lo entregado')
  })

  test('una cantidad negativa no existe', () => {
    expect(errorDeElemento(cantidad({ cantidadEntregada: -1 }))).toBe(
      'Las cantidades no pueden ser negativas',
    )
  })

  test('entregada sola es válida: todo se perdió', () => {
    expect(errorDeElemento(cantidad({ cantidadEntregada: 10 }))).toBeNull()
  })
})

describe('errorDeElemento — préstamo', () => {
  test('falta el estado de salida', () => {
    expect(errorDeElemento(prestamo())).toBe('Elige el estado de salida del equipo')
  })

  // El de devolución es opcional a propósito: un equipo puede quedarse prestado
  // de un día para otro, y el trigger sólo actualiza funcionamiento si viene.
  test('el estado de devolución es opcional', () => {
    expect(errorDeElemento(prestamo({ estadoSalida: 'correcto' }))).toBeNull()
  })

  test('con los dos estados tampoco hay error', () => {
    expect(
      errorDeElemento(prestamo({ estadoSalida: 'correcto', estadoDevolucion: 'presenta_fallas' })),
    ).toBeNull()
  })
})

describe('estaCompleto', () => {
  test('es exactamente lo contrario de tener error', () => {
    expect(estaCompleto(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBe(true)
    expect(estaCompleto(peso())).toBe(false)
  })
})

describe('esquemaCabecera', () => {
  const valida = {
    programaId: 1,
    semestre: 3,
    asignaturaId: 2,
    practicaCatalogoId: 4,
    laboratorioId: 5,
    fecha: '2026-09-03',
  }

  test('una cabecera completa pasa', () => {
    expect(esquemaCabecera.safeParse(valida).success).toBe(true)
  })

  test('el semestre nulo pasa: es una optativa, no un hueco', () => {
    expect(esquemaCabecera.safeParse({ ...valida, semestre: null }).success).toBe(true)
  })

  test.each([
    ['programaId', 'Elige el programa educativo'],
    ['asignaturaId', 'Elige la asignatura'],
    ['practicaCatalogoId', 'Elige la práctica'],
    ['laboratorioId', 'Elige el laboratorio'],
  ])('sin %s el mensaje lo dice en español', (campo, mensaje) => {
    const resultado = esquemaCabecera.safeParse({ ...valida, [campo]: null })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe(mensaje)
    }
  })
})

describe('aPayloadElementos', () => {
  test('cada método manda sólo sus campos', () => {
    const payload = aPayloadElementos([
      peso({ pesoInicial: 526, pesoFinal: 520, motivos: ['se_termino'] }),
      cantidad({ cantidadEntregada: 10, cantidadDevuelta: 8 }),
      prestamo({ estadoSalida: 'correcto', observaciones: '  con rayón  ' }),
    ])

    expect(payload[0]).toEqual({
      existencia_id: 12,
      peso_inicial: 526,
      peso_final: 520,
      observaciones: null,
      motivos: ['se_termino'],
    })

    expect(payload[1]).toEqual({
      existencia_id: 12,
      cantidad_entregada: 10,
      cantidad_devuelta: 8,
      cantidad_danada: null,
      observaciones: null,
      motivos: [],
    })

    expect(payload[2]).toEqual({
      existencia_id: 12,
      estado_salida: 'correcto',
      estado_devolucion: null,
      observaciones: 'con rayón',
      motivos: [],
    })
  })

  // El consumo y las pérdidas son columnas generadas: la aritmética vive en la
  // base porque una resta que calcula el frontend se puede equivocar en
  // silencio. Que no se cuelen aunque se muestren en pantalla. Y metodo_control
  // tampoco viaja: derivarlo en la base es el hueco que cerró la Tarea 1.
  test('no manda consumo, perdidas ni metodo_control', () => {
    const [fila] = aPayloadElementos([peso({ pesoInicial: 526, pesoFinal: 520 })])

    expect(fila).not.toHaveProperty('consumo')
    expect(fila).not.toHaveProperty('perdidas')
    expect(fila).not.toHaveProperty('metodo_control')
  })
})
