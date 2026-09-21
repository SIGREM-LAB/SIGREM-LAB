import { describe, expect, it } from 'vitest'

import { TOPE, traerTodo } from './paginacion'

/** Una fuente falsa de `n` filas que respeta el rango que le piden. */
function fuente(n: number) {
  return async (desde: number, hasta: number) => ({
    data: Array.from(
      { length: Math.max(0, Math.min(hasta, n - 1) - desde + 1) },
      (_, i) => ({ id: desde + i }),
    ),
    error: null,
  })
}

describe('traerTodo', () => {
  it('trae las 2600 filas completas y no las 1000 de max_rows', async () => {
    const filas = await traerTodo(fuente(2600))
    expect(filas).toHaveLength(2600)
    expect(filas.at(-1)).toEqual({ id: 2599 })
  })

  it('una sola página cuando hay menos de 1000', async () => {
    expect(await traerTodo(fuente(7))).toHaveLength(7)
  })

  it('no pide una página de más cuando el total es múltiplo exacto', async () => {
    let llamadas = 0
    const contada = (desde: number, hasta: number) => {
      llamadas += 1
      return fuente(2000)(desde, hasta)
    }
    await traerTodo(contada)
    // 2 llenas + 1 vacía que confirma el final. Menos sería adivinar.
    expect(llamadas).toBe(3)
  })

  it('al llegar al tope lanza, en vez de devolver un reporte a medias', async () => {
    await expect(traerTodo(fuente(TOPE + 1))).rejects.toThrow(/demasiado grande/i)
  })

  it('propaga el error de la fuente sin envolverlo', async () => {
    const rota = async () => ({ data: null, error: new Error('pum') })
    await expect(traerTodo(rota)).rejects.toThrow('pum')
  })
})
