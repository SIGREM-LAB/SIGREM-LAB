import { describe, expect, it } from 'vitest'

import { nombreDeArchivo, REPORTES } from './registro'

describe('registro de reportes', () => {
  it('los cuatro reportes de la entrega 1', () => {
    expect(REPORTES.map((r) => r.id)).toEqual([
      'reposicion',
      'caducidades',
      'conteo',
      'inventario',
    ])
  })

  it('ningún id repetido: es la llave de la caché y del nombre de archivo', () => {
    expect(new Set(REPORTES.map((r) => r.id)).size).toBe(REPORTES.length)
  })

  it('toda columna lleva clave y título', () => {
    for (const reporte of REPORTES) {
      for (const hoja of reporte.hojas) {
        for (const columna of hoja.columnas) {
          expect(columna.clave, `${reporte.id}/${hoja.nombre}`).toBeTruthy()
          expect(columna.titulo, `${reporte.id}/${hoja.nombre}`).toBeTruthy()
        }
      }
    }
  })

  it('ninguna hoja repite una clave de columna', () => {
    for (const reporte of REPORTES) {
      for (const hoja of reporte.hojas) {
        const claves = hoja.columnas.map((c) => c.clave)
        expect(new Set(claves).size, `${reporte.id}/${hoja.nombre}`).toBe(claves.length)
      }
    }
  })

  it('reposición trae dos hojas: la de compras y la de trabajo', () => {
    const reposicion = REPORTES.find((r) => r.id === 'reposicion')
    expect(reposicion?.hojas.map((h) => h.rpc)).toEqual([
      'reporte_reposicion',
      'reporte_sin_minimo',
    ])
  })

  it('el formato unificado no declara hojas: las pone la base', () => {
    // Decisión D9 del spec. Un diccionario de columnas en TypeScript hay que
    // acordarse de actualizarlo, y olvidarlo no rompe la compilación.
    expect(REPORTES.find((r) => r.id === 'inventario')?.hojas).toEqual([])
  })

  it('las columnas en blanco del conteo salen al final', () => {
    const conteo = REPORTES.find((r) => r.id === 'conteo')!
    const columnas = conteo.hojas[0].columnas
    const primeraVacia = columnas.findIndex((c) => c.vacia)
    expect(primeraVacia).toBeGreaterThan(0)
    expect(columnas.slice(primeraVacia).every((c) => c.vacia)).toBe(true)
  })

  it('el nombre del archivo es determinista y lleva almacén y fecha', () => {
    const nombre = nombreDeArchivo(REPORTES[0], 'UCL-N3', new Date('2026-09-21T10:00:00'))
    expect(nombre).toBe('SIGREM-UCL-N3-reposicion-2026-09-21.xlsx')
  })

  it('el mismo reporte el mismo día da el mismo nombre', () => {
    const hoy = new Date('2026-09-21T23:59:00')
    expect(nombreDeArchivo(REPORTES[1], 'ACT', hoy)).toBe(
      nombreDeArchivo(REPORTES[1], 'ACT', hoy),
    )
  })
})
