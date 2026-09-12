import { describe, expect, test } from 'vitest'

import {
  esquemaDeMovimiento,
  fechaDe,
  hoy,
  MOVIMIENTOS,
  POR_CADUCIDAD,
  registroDe,
  tiposPara,
  type TipoMovimiento,
  type ValoresMovimiento,
} from './movimientos'

function valores(cambios: Partial<ValoresMovimiento> = {}): ValoresMovimiento {
  return { tipo: 'entrada', cantidad: '', motivo: '', fecha: hoy(), laboratorio: '', ...cambios }
}

const CTX = { saldo: 1500, unidad: 'mL', laboratorioActual: 2 }

describe('tiposPara', () => {
  test('los cinco de siempre aplican a cualquier producto', () => {
    expect(tiposPara('equipo')).toEqual([
      'entrada',
      'consumo',
      'ajuste',
      'merma',
      'cambio_lab',
    ])
  })

  // Un osciloscopio no caduca; un reactivo, un insumo y una muestra biológica sí.
  test('caducado solo se ofrece donde caducar significa algo', () => {
    expect(tiposPara('reactivo')).toContain('caducado')
    expect(tiposPara('insumo')).toContain('caducado')
    expect(tiposPara('materia_biologica')).toContain('caducado')
    expect(tiposPara('material')).not.toContain('caducado')
  })

  // Sin clasificación no se esconde nada: es un dato que falta, no un «no».
  test('sin clasificación se ofrecen todos', () => {
    expect(tiposPara(null)).toHaveLength(6)
  })
})

describe('registroDe', () => {
  test('una entrada suma', () => {
    expect(registroDe(valores({ tipo: 'entrada', cantidad: '500' }), CTX)).toMatchObject({
      clase: 'movimiento',
      tipo: 'entrada',
      cantidad: 500,
    })
  })

  // El signo es lo que la bitácora guarda, y teclear «-45» en una salida es el
  // error que este vuelco evita.
  test('un consumo y una merma restan, aunque se teclee en positivo', () => {
    expect(registroDe(valores({ tipo: 'consumo', cantidad: '45', motivo: 'Práctica' }), CTX))
      .toMatchObject({ tipo: 'consumo', cantidad: -45 })
    expect(registroDe(valores({ tipo: 'merma', cantidad: '10', motivo: 'Derrame' }), CTX))
      .toMatchObject({ tipo: 'merma', cantidad: -10 })
  })

  // El ajuste captura cuánto HAY, no cuánto cambió: a la bitácora va la
  // diferencia, que es como el esquema registra un conteo físico.
  test('el ajuste manda la diferencia contra el saldo', () => {
    expect(registroDe(valores({ tipo: 'ajuste', cantidad: '1440' }), CTX)).toMatchObject({
      tipo: 'ajuste_conteo',
      cantidad: -60,
    })
    expect(registroDe(valores({ tipo: 'ajuste', cantidad: '1600' }), CTX)).toMatchObject({
      cantidad: 100,
    })
  })

  // Sin redondear, 139.8 - 139.5 en coma flotante deja 0.30000000000000004 y el
  // ajuste de un frasco pesado entraría con cuatro decimales de ruido.
  test('la diferencia se redondea a lo que admite numeric(14,4)', () => {
    const salida = registroDe(valores({ tipo: 'ajuste', cantidad: '139.8' }), {
      ...CTX,
      saldo: 139.5,
    })
    expect(salida).toMatchObject({ cantidad: 0.3 })
  })

  // Se guarda como merma porque el enum no tiene un valor propio; el motivo es
  // lo que distingue una cosa de la otra dentro de un año.
  test('caducado se guarda como merma y lo dice en el motivo', () => {
    expect(registroDe(valores({ tipo: 'caducado', cantidad: '200' }), CTX)).toMatchObject({
      tipo: 'merma',
      cantidad: -200,
      motivo: POR_CADUCIDAD,
    })

    expect(
      registroDe(valores({ tipo: 'caducado', cantidad: '200', motivo: 'Lote 42' }), CTX),
    ).toMatchObject({ motivo: `${POR_CADUCIDAD}: Lote 42` })
  })

  test('un motivo vacío viaja como nulo, no como cadena vacía', () => {
    expect(registroDe(valores({ tipo: 'entrada', cantidad: '5' }), CTX)).toMatchObject({
      motivo: null,
    })
  })

  // No es un movimiento: mueve el frasco de sitio, no su cantidad.
  test('el cambio de laboratorio no produce un movimiento', () => {
    expect(registroDe(valores({ tipo: 'cambio_lab', laboratorio: '7' }), CTX)).toEqual({
      clase: 'laboratorio',
      laboratorioId: 7,
    })
  })
})

describe('fechaDe', () => {
  // `ocurrido_en` tiene `default now()`. Mandar la de hoy la dejaría a las 00:00
  // y desordenaría los movimientos del mismo día, que es donde se leen.
  test('la de hoy no viaja: deja el now() de la base', () => {
    expect(fechaDe(hoy())).toBeNull()
    expect(fechaDe('')).toBeNull()
  })

  test('un día pasado sí: registrar el consumo de ayer es legítimo', () => {
    expect(fechaDe('2026-01-15')).toBe('2026-01-15')
  })
})

describe('esquemaDeMovimiento', () => {
  function revisar(v: Partial<ValoresMovimiento>, ctx = CTX) {
    return esquemaDeMovimiento(ctx).safeParse(valores(v))
  }

  function errorEn(v: Partial<ValoresMovimiento>, campo: string) {
    const salida = revisar(v)
    expect(salida.success).toBe(false)
    return salida.error?.issues.find((i) => i.path[0] === campo)
  }

  test('una entrada con cantidad pasa sin motivo', () => {
    expect(revisar({ tipo: 'entrada', cantidad: '500' }).success).toBe(true)
  })

  test('la cantidad es obligatoria donde se pide', () => {
    expect(errorEn({ tipo: 'entrada', cantidad: '' }, 'cantidad')?.message).toMatch(/obligatorio/)
  })

  test('cero no es un movimiento', () => {
    expect(errorEn({ tipo: 'entrada', cantidad: '0' }, 'cantidad')?.message).toMatch(/mayor que cero/)
  })

  // `movimiento_cantidad_no_cero` lo rechazaría, pero enterarse al pulsar
  // Guardar, con el error de Postgres, es peor que no poder teclearlo.
  test('un ajuste igual al saldo no tiene nada que registrar', () => {
    expect(errorEn({ tipo: 'ajuste', cantidad: '1500' }, 'cantidad')?.message).toMatch(
      /no hay diferencia/i,
    )
  })

  test('pero un ajuste distinto sí pasa, y puede ser a la baja', () => {
    expect(revisar({ tipo: 'ajuste', cantidad: '0' }).success).toBe(true)
  })

  // Lo rechazaría `aplicar_movimiento`, y dejar la existencia en negativo es
  // justo lo que no puede pasar.
  test('no se puede descontar más de lo que hay, y se dice cuánto queda', () => {
    const error = errorEn({ tipo: 'consumo', cantidad: '2000', motivo: 'X' }, 'cantidad')
    expect(error?.message).toMatch(/1500 mL/)
  })

  test('el motivo es obligatorio en consumo y merma, no en entrada', () => {
    expect(errorEn({ tipo: 'consumo', cantidad: '10' }, 'motivo')).toBeDefined()
    expect(errorEn({ tipo: 'merma', cantidad: '10' }, 'motivo')).toBeDefined()
    expect(revisar({ tipo: 'entrada', cantidad: '10' }).success).toBe(true)
  })

  test('el cambio de laboratorio exige destino, y uno distinto del actual', () => {
    expect(errorEn({ tipo: 'cambio_lab', laboratorio: '' }, 'laboratorio')?.message).toMatch(
      /destino/,
    )
    expect(errorEn({ tipo: 'cambio_lab', laboratorio: '2' }, 'laboratorio')?.message).toMatch(
      /ya está/,
    )
    expect(revisar({ tipo: 'cambio_lab', laboratorio: '3' }).success).toBe(true)
  })
})

describe('MOVIMIENTOS', () => {
  // Los seis tipos de la pantalla no son los ocho del enum. Que `caducado` se
  // guarde como merma y que el cambio de laboratorio no sea un movimiento son
  // las dos asimetrías, y conviene que se rompa la prueba si alguien las toca
  // sin querer.
  test('los tipos del enum con los que se guarda cada uno', () => {
    const tipos = Object.fromEntries(
      (Object.keys(MOVIMIENTOS) as TipoMovimiento[]).map((t) => [t, MOVIMIENTOS[t].tipo]),
    )

    expect(tipos).toEqual({
      entrada: 'entrada',
      consumo: 'consumo',
      ajuste: 'ajuste_conteo',
      merma: 'merma',
      caducado: 'merma',
      cambio_lab: null,
    })
  })
})
