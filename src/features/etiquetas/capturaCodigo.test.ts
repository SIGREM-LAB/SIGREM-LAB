import { describe, expect, test, vi } from 'vitest'

import { crearCaptura } from './capturaCodigo'

describe('crearCaptura', () => {
  test('sin nadie que la tome, no atiende: el código va al inventario', () => {
    expect(crearCaptura().atender('UCL-N3-00001')).toBe(false)
  })

  test('quien la toma recibe el código', () => {
    const captura = crearCaptura()
    const manejador = vi.fn()
    captura.tomar(manejador)

    expect(captura.atender('UCL-N3-00001')).toBe(true)
    expect(manejador).toHaveBeenCalledWith('UCL-N3-00001')
  })

  test('al soltarla vuelve a no atender', () => {
    const captura = crearCaptura()
    const soltar = captura.tomar(vi.fn())
    soltar()

    expect(captura.atender('UCL-N3-00001')).toBe(false)
  })

  test('soltar tarde no le quita la pistola a la pantalla siguiente', () => {
    const captura = crearCaptura()
    const soltarVieja = captura.tomar(vi.fn())
    const nueva = vi.fn()
    captura.tomar(nueva)
    soltarVieja()

    expect(captura.atender('UCL-N3-00001')).toBe(true)
    expect(nueva).toHaveBeenCalledOnce()
  })
})
