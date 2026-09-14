import { describe, expect, test } from 'vitest'

import { serializarBorrador } from './borrador'
import { elementoDesdeExistencia } from './esquemas'
import { componerHistorial, filaDeBorrador, filaDePractica } from './historial'

const ELEMENTO = elementoDesdeExistencia({
  id: 12,
  codigo: 'N3-00042',
  nombre_canonico: 'Etanol 96%',
  clasificacion: 'reactivo' as const,
  unidad_base: 'ml',
  almacen_clave: 'N3',
  cantidad: 2000,
  ubicacion: 'Lab 2',
  metodo_control: 'peso' as const,
})

const CABECERA = {
  programaId: 1,
  semestre: 3,
  asignaturaId: 2,
  numeroPractica: '2',
  laboratorioId: 5,
  fecha: '2026-09-08',
}

const NOMBRES = { asignatura: 'Bioquímica', laboratorio: 'Laboratorio de docencia N3' }

describe('filaDeBorrador', () => {
  test('un borrador se vuelve un renglón "en curso" con sus nombres y su conteo', () => {
    const contenido = serializarBorrador(CABECERA, NOMBRES, [ELEMENTO, ELEMENTO])

    expect(filaDeBorrador({ id: 3, contenido })).toEqual({
      clave: 'borrador-3',
      estado: 'en_curso',
      practicaId: null,
      borradorId: 3,
      folio: null,
      fecha: '2026-09-08',
      asignatura: 'Bioquímica',
      laboratorio: 'Laboratorio de docencia N3',
      productos: 2,
    })
  })

  // El folio lo asigna el trigger al finalizar. Inventar uno antes sería
  // mostrar un dato que no existe.
  test('el folio va nulo: todavía no lo tiene', () => {
    const contenido = serializarBorrador(CABECERA, NOMBRES, [])

    expect(filaDeBorrador({ id: 1, contenido })?.folio).toBeNull()
  })

  test('una cabecera sin fecha no revienta', () => {
    const contenido = serializarBorrador({}, NOMBRES, [])
    const fila = filaDeBorrador({ id: 1, contenido })

    expect(fila?.fecha).toBeNull()
  })

  // Un borrador que no se entiende no pinta un renglón roto: no pinta renglón.
  test('un borrador de otra versión no produce renglón', () => {
    const contenido = { version: 1, cabecera: CABECERA, elementos: [] }

    expect(filaDeBorrador({ id: 1, contenido })).toBeNull()
  })
})

describe('filaDePractica', () => {
  const PRACTICA = {
    id: 7,
    folio: 'PRA-0001',
    fecha: '2026-09-05',
    asignatura: { nombre: 'Bioquímica' },
    laboratorio: { nombre: 'Laboratorio de docencia N3' },
    practica_elemento: [{ count: 3 }],
  }

  test('aplana los nombres embebidos y el conteo', () => {
    expect(filaDePractica(PRACTICA)).toEqual({
      clave: 'practica-7',
      estado: 'finalizada',
      practicaId: 7,
      borradorId: null,
      folio: 'PRA-0001',
      fecha: '2026-09-05',
      asignatura: 'Bioquímica',
      laboratorio: 'Laboratorio de docencia N3',
      productos: 3,
    })
  })

  // `practica.asignatura_id` es anulable en el esquema: hay asignaturas
  // compartidas y la FK no es obligatoria.
  test('una práctica sin asignatura no revienta', () => {
    expect(filaDePractica({ ...PRACTICA, asignatura: null }).asignatura).toBeNull()
  })

  // Si el recurso embebido llega vacío, cero es la respuesta honesta.
  test('un conteo embebido vacío cuenta cero', () => {
    expect(filaDePractica({ ...PRACTICA, practica_elemento: [] }).productos).toBe(0)
  })
})

describe('componerHistorial', () => {
  const FINALIZADA = filaDePractica({
    id: 7,
    folio: 'PRA-0001',
    fecha: '2026-09-05',
    asignatura: { nombre: 'Bioquímica' },
    laboratorio: { nombre: 'Laboratorio de docencia N3' },
    practica_elemento: [{ count: 3 }],
  })

  // Van primero aunque su fecha sea más vieja: son lo único accionable de la
  // pantalla y lo único que se puede perder. Intercalados por fecha acabarían
  // en la página tres.
  test('el borrador va primero, aunque su fecha sea anterior', () => {
    const viejo = serializarBorrador({ ...CABECERA, fecha: '2026-01-01' }, NOMBRES, [])

    expect(componerHistorial([{ id: 1, contenido: viejo }], [FINALIZADA]).map((f) => f.estado)).toEqual([
      'en_curso',
      'finalizada',
    ])
  })

  // Varias capturas a la vez: cada una es su propio renglón, y conservan el
  // orden en que llegaron —más reciente primero, que es `actualizado_en`—.
  test('los borradores salen todos, en el orden en que llegaron', () => {
    const uno = serializarBorrador(CABECERA, NOMBRES, [])
    const dos = serializarBorrador(CABECERA, NOMBRES, [ELEMENTO])

    const filas = componerHistorial(
      [
        { id: 2, contenido: dos },
        { id: 1, contenido: uno },
      ],
      [FINALIZADA],
    )

    expect(filas.map((f) => f.borradorId)).toEqual([2, 1, null])
  })

  test('sin borrador solo van las finalizadas', () => {
    expect(componerHistorial([], [FINALIZADA])).toEqual([FINALIZADA])
  })

  test('un borrador que no se entiende no agrega renglón', () => {
    expect(componerHistorial([{ id: 1, contenido: { version: 1 } }], [FINALIZADA])).toEqual([
      FINALIZADA,
    ])
  })

  test('sin nada, la lista queda vacía', () => {
    expect(componerHistorial([], [])).toEqual([])
  })
})
