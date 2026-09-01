import { describe, expect, test } from 'vitest'

import { elegirAsignatura, elegirPractica, elegirPrograma, SELECCION_VACIA } from './seleccion'

describe('la cascada del panel académico', () => {
  // La importante. Sin esto la columna 3 sigue mostrando las prácticas de la
  // selección anterior, que ya no cuelgan de nada visible en pantalla.
  test('cambiar de programa limpia la asignatura y la práctica', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    const despues = elegirPrograma(antes, 2)

    expect(despues).toEqual({ programaId: 2, asignaturaId: null, practicaId: null })
  })

  test('cambiar de asignatura limpia la práctica pero conserva el programa', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    const despues = elegirAsignatura(antes, 11)

    expect(despues).toEqual({ programaId: 1, asignaturaId: 11, practicaId: null })
  })

  // Volver a hacer clic en lo que ya estaba elegido no puede tirar el resto:
  // si lo hiciera, un clic accidental en la columna 1 vaciaría las otras dos.
  test('reelegir el mismo programa no toca nada', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    expect(elegirPrograma(antes, 1)).toEqual(antes)
  })

  test('reelegir la misma asignatura no toca nada', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    expect(elegirAsignatura(antes, 10)).toEqual(antes)
  })

  test('la selección vacía no trae nada elegido', () => {
    expect(SELECCION_VACIA).toEqual({ programaId: null, asignaturaId: null, practicaId: null })
  })
})
