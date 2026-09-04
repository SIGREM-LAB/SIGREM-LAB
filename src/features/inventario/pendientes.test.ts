import { describe, expect, test } from 'vitest'

import {
  camposDeRenglon,
  cantidadDeRenglon,
  campoDeRenglon,
  esFichaNOM,
  esquemaDeCampos,
  filtrosPendientesIniciales,
  leerProblemas,
  leerRenglon,
  nombreDeRenglon,
  origenDePendiente,
  renglonDesdeValores,
  resumenDeProblemas,
  ubicacionDeRenglon,
  valoresDeRenglon,
} from './pendientes'

// El renglón tal como lo aparta el cargador cuando rompe una regla: CRUDO, con
// los «Sin marca» y los «—» del Excel y los números como número.
const CRUDO = {
  marca: 'Sin marca',
  mueble: 'Gabinete 309',
  repisa: '—',
  unidad: 'paquete',
  articulo: 'Papel filtro Whatman No. 3',
  cantidad: 1,
  fila_cajon: '—',
  presentacion: null,
  clasificacion: 'Insumo',
  observaciones: null,
  sub_ubicacion: 'N3',
  especificacion: '125 mm',
}

describe('leerProblemas', () => {
  test('lee la lista que escribe el cargador', () => {
    const problemas = leerProblemas([
      { regla: 'Regla 2', columna: 'G', valor: 'paquete', detalle: 'es un empaque' },
    ])
    expect(problemas).toEqual([
      { regla: 'Regla 2', columna: 'G', valor: 'paquete', detalle: 'es un empaque' },
    ])
  })

  test('un jsonb con otra forma no revienta la pantalla: devuelve nada', () => {
    expect(leerProblemas(null)).toEqual([])
    expect(leerProblemas({ regla: 'suelta' })).toEqual([])
  })

  test('un valor numérico se pinta como texto, no como [object Object]', () => {
    const [problema] = leerProblemas([{ regla: 'Llave natural', valor: 98.97 }])
    expect(problema.valor).toBe('98.97')
    expect(problema.detalle).toBe('')
  })
})

describe('leerRenglon', () => {
  test('un renglón que no es objeto se lee como vacío', () => {
    expect(leerRenglon(null)).toEqual({})
    expect(leerRenglon([1, 2])).toEqual({})
  })
})

describe('camposDeRenglon', () => {
  test('pone primero qué cosa es y cuánta hay, no el orden en que llega el jsonb', () => {
    const claves = camposDeRenglon(CRUDO).map((c) => c.clave)
    expect(claves.indexOf('articulo')).toBeLessThan(claves.indexOf('cantidad'))
    expect(claves.indexOf('cantidad')).toBeLessThan(claves.indexOf('sub_ubicacion'))
    expect(claves.at(-1)).toBe('observaciones')
  })

  test('etiqueta cada campo con el título de su columna en el formato', () => {
    const campos = camposDeRenglon(CRUDO)
    expect(campos.find((c) => c.clave === 'fila_cajon')?.etiqueta).toBe('Fila o cajón')
  })

  test('una llave que no conoce se pinta igual, con su propio nombre', () => {
    const campos = camposDeRenglon({ inventada: 'x' })
    expect(campos).toEqual([{ clave: 'inventada', etiqueta: 'inventada', tipo: 'texto' }])
  })

  test('el tipo sale del valor: un número es número y una casilla es casilla', () => {
    const campos = camposDeRenglon({ cantidad: 1, hoja_seguridad: true, unidad: 'g' })
    expect(campos.find((c) => c.clave === 'cantidad')?.tipo).toBe('numero')
    expect(campos.find((c) => c.clave === 'hoja_seguridad')?.tipo).toBe('booleano')
    expect(campos.find((c) => c.clave === 'unidad')?.tipo).toBe('texto')
  })

  test('«2 cajas» en la cantidad es texto, para que se pueda ver y corregir', () => {
    const campos = camposDeRenglon({ cantidad: '2 cajas' })
    expect(campos[0].tipo).toBe('texto')
  })
})

describe('valoresDeRenglon y renglonDesdeValores', () => {
  test('ida y vuelta sin tocar nada deja el renglón como estaba', () => {
    expect(renglonDesdeValores(CRUDO, valoresDeRenglon(CRUDO))).toEqual(CRUDO)
  })

  test('un campo que llegó como número vuelve como número', () => {
    const corregido = renglonDesdeValores(CRUDO, {
      ...valoresDeRenglon(CRUDO),
      cantidad: '100',
      unidad: 'pieza',
    })
    expect(corregido.cantidad).toBe(100)
    expect(corregido.unidad).toBe('pieza')
  })

  test('un campo vaciado vuelve como null, no como cadena vacía', () => {
    const corregido = renglonDesdeValores(CRUDO, { ...valoresDeRenglon(CRUDO), marca: '   ' })
    expect(corregido.marca).toBeNull()
  })

  test('las casillas viajan como booleano', () => {
    const original = { hoja_seguridad: false }
    expect(renglonDesdeValores(original, { hoja_seguridad: true })).toEqual({
      hoja_seguridad: true,
    })
  })

  // La propiedad que hace que un campo fuera de la hoja no exista en el envío,
  // igual que en el formulario de alta.
  test('un campo que no venía en el renglón no se cuela en el envío', () => {
    const corregido = renglonDesdeValores({ unidad: 'g' }, { unidad: 'mL', colado: 'x' })
    expect(corregido).toEqual({ unidad: 'mL' })
  })
})

describe('ubicacionDeRenglon', () => {
  test('arma la etiqueta con los prefijos del formato, en su orden', () => {
    expect(
      ubicacionDeRenglon({ sub_ubicacion: 'N3', mueble: 'Anaquel 2', repisa: '3', fila_cajon: '1' }),
    ).toBe('N3 · Anaquel 2 · Repisa 3 · Fila 1')
  })

  test('los «—» del Excel no son una repisa: no entran en la etiqueta', () => {
    expect(ubicacionDeRenglon(CRUDO)).toBe('N3 · Gabinete 309')
  })

  test('un renglón sin una sola parte de ubicación no inventa ninguna', () => {
    expect(ubicacionDeRenglon({ marca: 'MEYER' })).toBe('—')
  })
})

describe('cantidadDeRenglon y campoDeRenglon', () => {
  test('pinta la cantidad con su unidad', () => {
    expect(cantidadDeRenglon({ cantidad: 528.14, unidad: 'g' })).toBe('528.14 g')
  })

  test('sin cantidad no inventa un cero', () => {
    expect(cantidadDeRenglon({ unidad: 'g' })).toBe('—')
  })

  test('«Sin marca» se lee como que no tiene marca', () => {
    expect(campoDeRenglon(CRUDO, 'marca')).toBe('—')
  })
})

describe('nombreDeRenglon', () => {
  test('Reactivos lo trae en «sustancia» y el resto en «articulo»', () => {
    expect(nombreDeRenglon({ sustancia: 'Acetona, líquido' })).toBe('Acetona, líquido')
    expect(nombreDeRenglon(CRUDO)).toBe('Papel filtro Whatman No. 3')
  })

  test('un renglón sin nombre se dice, no se pinta en blanco', () => {
    expect(nombreDeRenglon({ marca: 'MEYER' })).toBe('Renglón sin nombre')
  })
})

describe('resumenDeProblemas', () => {
  test('con un solo problema se lee el detalle', () => {
    expect(resumenDeProblemas(leerProblemas([{ detalle: 'es un empaque' }]))).toBe('es un empaque')
  })

  test('con varios se lee el primero y se cuentan los demás', () => {
    const problemas = leerProblemas([{ detalle: 'es un empaque' }, { detalle: 'y otra cosa' }])
    expect(resumenDeProblemas(problemas)).toBe('es un empaque (y 1 más)')
  })

  test('sin detalle se cae a la regla', () => {
    expect(resumenDeProblemas(leerProblemas([{ regla: 'Regla 13' }]))).toBe('Regla 13')
  })
})

describe('esFichaNOM', () => {
  test('los trece campos del rombo se pliegan; el resto no', () => {
    expect(esFichaNOM('riesgo_salud')).toBe(true)
    expect(esFichaNOM('color')).toBe(true)
    expect(esFichaNOM('cantidad')).toBe(false)
    expect(esFichaNOM('observaciones')).toBe(false)
  })
})

describe('esquemaDeCampos', () => {
  test('un campo que llegó como número no acepta texto', () => {
    const esquema = esquemaDeCampos(camposDeRenglon({ cantidad: 1 }))
    expect(esquema.safeParse({ cantidad: '100' }).success).toBe(true)
    expect(esquema.safeParse({ cantidad: 'como veinte' }).success).toBe(false)
  })

  test('vaciar un campo numérico se permite: es decir «no sé cuánto hay»', () => {
    const esquema = esquemaDeCampos(camposDeRenglon({ cantidad: 1 }))
    expect(esquema.safeParse({ cantidad: '' }).success).toBe(true)
  })
})

describe('filtrosPendientesIniciales', () => {
  test('un responsable arranca en su almacén y en lo que le falta por revisar', () => {
    expect(filtrosPendientesIniciales({ rol: 'responsable', almacenId: 3 })).toEqual({
      almacenId: 3,
      estado: 'pendiente',
      motivo: 'todos',
    })
  })

  test('admin y consulta arrancan viendo los cuatro almacenes', () => {
    expect(filtrosPendientesIniciales({ rol: 'admin', almacenId: 1 }).almacenId).toBe('todos')
    expect(filtrosPendientesIniciales(undefined).almacenId).toBe('todos')
  })
})

describe('origenDePendiente', () => {
  test('dice hoja y fila, que es como se encuentra el renglón en el archivo', () => {
    expect(origenDePendiente({ hoja: 'Insumos', fila: 70 })).toBe('Insumos · fila 70')
  })
})
