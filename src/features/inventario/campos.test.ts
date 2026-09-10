import { describe, expect, test } from 'vitest'

import {
  camposVisibles,
  esquemaDeCampos,
  grupoDe,
  payloadDe,
  rotuloDeOpcion,
  TIPOS,
  valoresIniciales,
  type Campo,
} from './campos'

function campo(cambios: Partial<Campo> = {}): Campo {
  return {
    campo: 'nombre_articulo',
    etiqueta: 'Artículo',
    tipo_dato: 'texto',
    destino: 'articulo.nombre_canonico',
    opciones: null,
    ayuda: null,
    obligatorio: true,
    orden: 1,
    ...cambios,
  }
}

describe('grupoDe', () => {
  // El recuadro sale del prefijo de `destino`, que es un dato de la base. Si
  // saliera de una lista de nombres escrita en el componente, agregar un campo
  // a la ficha NOM lo pintaría fuera de su recuadro hasta que alguien se
  // acordara de actualizar esa lista.
  test('la ficha NOM se reconoce por su destino, no por el nombre del campo', () => {
    expect(grupoDe(campo({ campo: 'riesgo_salud', destino: 'articulo_reactivo.riesgo_salud' }))).toBe(
      'reactivo',
    )
  })

  test('lo biológico también', () => {
    expect(
      grupoDe(campo({ campo: 'origen_especie', destino: 'articulo_biologico.origen_especie' })),
    ).toBe('biologico')
  })

  test('las partes de la ubicación se agrupan aunque se llamen distinto', () => {
    expect(grupoDe(campo({ campo: 'coord_h', destino: 'ubicacion.componentes.h' }))).toBe('ubicacion')
    expect(grupoDe(campo({ campo: 'mueble', destino: 'ubicacion.componentes.mueble' }))).toBe(
      'ubicacion',
    )
  })

  test('lo demás va al cuerpo del formulario', () => {
    expect(grupoDe(campo({ campo: 'marca', destino: 'existencia.marca' }))).toBe('general')
    expect(grupoDe(campo())).toBe('general')
  })
})

describe('camposVisibles', () => {
  // El selector de tipo del diálogo YA preguntó qué es. Los perfiles de
  // material, insumo y electrónica además lo listan como campo; pintarlo otra
  // vez sería preguntar dos veces lo mismo y admitir dos respuestas distintas.
  test('la clasificación no se pregunta dos veces', () => {
    const lista = [campo({ campo: 'clasificacion', tipo_dato: 'seleccion' }), campo()]
    expect(camposVisibles(lista).map((c) => c.campo)).toEqual(['nombre_articulo'])
  })
})

describe('esquemaDeCampos', () => {
  test('un obligatorio vacío falla, y el mensaje dice cuál es', () => {
    const esquema = esquemaDeCampos([campo({ etiqueta: 'Artículo', obligatorio: true })])
    const salida = esquema.safeParse({ nombre_articulo: '   ' })

    expect(salida.success).toBe(false)
    expect(salida.error?.issues[0]?.message).toBe('Artículo es obligatorio')
  })

  test('un opcional vacío pasa', () => {
    const esquema = esquemaDeCampos([campo({ campo: 'marca', obligatorio: false })])
    expect(esquema.safeParse({ marca: '' }).success).toBe(true)
  })

  test('un número que no es número falla', () => {
    const esquema = esquemaDeCampos([
      campo({ campo: 'cantidad', etiqueta: 'Cantidad', tipo_dato: 'numero', obligatorio: false }),
    ])
    expect(esquema.safeParse({ cantidad: 'como diez' }).success).toBe(false)
    expect(esquema.safeParse({ cantidad: '10.5' }).success).toBe(true)
  })

  // `existencia_cantidad_no_negativa` lo rechazaría igual, pero enterarse
  // después de un viaje a la base es enterarse tarde.
  test('una cantidad negativa falla antes de salir del navegador', () => {
    const esquema = esquemaDeCampos([
      campo({ campo: 'cantidad', tipo_dato: 'numero', obligatorio: false }),
    ])
    expect(esquema.safeParse({ cantidad: '-3' }).success).toBe(false)
  })

  test('una fecha inventada falla', () => {
    const esquema = esquemaDeCampos([
      campo({ campo: 'fecha_chequeo', tipo_dato: 'fecha', obligatorio: false }),
    ])
    expect(esquema.safeParse({ fecha_chequeo: '2026-13-45' }).success).toBe(false)
    expect(esquema.safeParse({ fecha_chequeo: '2026-09-10' }).success).toBe(true)
  })

  // «Obligatorio» sobre una casilla querría decir «tiene que estar marcada», y
  // no es lo que dice el perfil de reactivo con `hoja_seguridad`: dice que hay
  // que contestar si la tienes, y «no la tengo» es una respuesta.
  test('una casilla obligatoria no exige estar marcada', () => {
    const esquema = esquemaDeCampos([
      campo({ campo: 'hoja_seguridad', tipo_dato: 'booleano', obligatorio: true }),
    ])
    expect(esquema.safeParse({ hoja_seguridad: false }).success).toBe(true)
  })
})

describe('valoresIniciales', () => {
  test('cada campo arranca definido: el control nace controlado', () => {
    const lista = [campo(), campo({ campo: 'hoja_seguridad', tipo_dato: 'booleano' })]
    expect(valoresIniciales(lista)).toEqual({ nombre_articulo: '', hoja_seguridad: false })
  })
})

describe('payloadDe', () => {
  // La propiedad que hace que los perfiles sirvan de algo. Si el payload
  // saliera del objeto de estado, un campo que quedó ahí de una clasificación
  // anterior se colaría en el envío.
  test('un valor que no corresponde a ningún campo del perfil no viaja', () => {
    const lista = [campo({ campo: 'marca', obligatorio: false })]
    const payload = payloadDe(lista, { marca: 'MEYER', numero_serie: 'COLADO-001' })

    expect(payload).toEqual({ marca: 'MEYER' })
    expect(payload).not.toHaveProperty('numero_serie')
  })

  test('los vacíos se omiten en vez de mandarse como cadena vacía', () => {
    const lista = [campo({ campo: 'marca', obligatorio: false }), campo({ campo: 'modelo' })]
    expect(payloadDe(lista, { marca: '  ', modelo: 'PA224' })).toEqual({ modelo: 'PA224' })
  })

  test('los espacios sobrantes no llegan al catálogo', () => {
    expect(payloadDe([campo()], { nombre_articulo: '  Acetona  ' })).toEqual({
      nombre_articulo: 'Acetona',
    })
  })

  // Un `false` es una respuesta, no un vacío: si se omitiera, «no tengo la hoja
  // de seguridad» llegaría a la base como «no contestó».
  test('una casilla sin marcar sí viaja', () => {
    const lista = [campo({ campo: 'hoja_seguridad', tipo_dato: 'booleano' })]
    expect(payloadDe(lista, { hoja_seguridad: false })).toEqual({ hoja_seguridad: false })
  })

  test('la clasificación no viaja: la pone crear_existencia desde su argumento', () => {
    const lista = [campo({ campo: 'clasificacion', tipo_dato: 'seleccion' })]
    expect(payloadDe(lista, { clasificacion: 'insumo' })).toEqual({})
  })
})

describe('TIPOS', () => {
  // El prototipo lista cinco y se le olvida `componente`, que es lo que son los
  // artículos de Electrónica. Con cinco opciones, LE no puede dar de alta nada.
  test('están las seis clasificaciones del enum', () => {
    expect(TIPOS).toHaveLength(6)
    expect(TIPOS.map((t) => t.valor)).toContain('componente')
  })
})

describe('rotuloDeOpcion', () => {
  test('los valores del enum se leen como español, no como identificadores', () => {
    expect(rotuloDeOpcion('liquido')).toBe('Líquido')
    expect(rotuloDeOpcion('materia_biologica')).toBe('Materia biológica')
  })

  test('lo que ya viene en prosa se deja como está', () => {
    expect(rotuloDeOpcion('Presenta fallas')).toBe('Presenta fallas')
  })
})
