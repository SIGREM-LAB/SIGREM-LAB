import { writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { aExcel, type HojaLista } from './aExcel'

/**
 * Genera el libro que la prueba de ida y vuelta de `etl/tests/` lee.
 *
 * El archivo se escribe en `etl/tests/fixtures/` y NO se versiona: lo produce
 * esta prueba en cada corrida, asi que nunca puede quedarse obsoleto respecto
 * al exportador. Un fixture commiteado seguiria pasando el dia que alguien
 * rompa `aExcel`, que es justo lo contrario de lo que se busca.
 *
 * Los datos son inventados. El repositorio es publico y ningun .xlsx de
 * inventario real entra al commit; ademas, lo que esta prueba verifica es la
 * FORMA -que cada campo caiga en su letra y su fila-, no el contenido.
 */

const SALIDA = resolve(__dirname, '../../../etl/tests/fixtures/N3-formato.xlsx')

/**
 * Espejo de lo que la base devuelve para Reactivos, con las letras reales.
 *
 * Va escrito aqui y no leido de la base porque esta prueba corre en vitest, sin
 * red. Que estas letras sigan siendo las de `columna_formato` lo comprueba
 * `etl/tests/test_formato_alineado.py`, que si habla con la base.
 */
const REACTIVOS: HojaLista = {
  nombre: 'Reactivos',
  filaEncabezado: 9,
  preambulo: [
    { celda: 'F4', valor: 'Responsable de prueba' },
    { celda: 'B5', valor: 'J-D 2026' },
    { celda: 'F5', valor: '2026-09-21' },
  ],
  columnas: [
    { clave: 'sub_ubicacion', columna: 'B', titulo: 'Sub-ubicación', tipo: 'texto' },
    { clave: 'mueble', columna: 'C', titulo: 'Anaquel', tipo: 'texto' },
    { clave: 'repisa', columna: 'D', titulo: 'Repisa', tipo: 'texto' },
    { clave: 'fila_cajon', columna: 'E', titulo: 'Fila', tipo: 'texto' },
    { clave: 'color', columna: 'F', titulo: 'Clasificación por color de almacenaje', tipo: 'texto' },
    { clave: 'hoja_seguridad', columna: 'G', titulo: 'Existencia de hoja de seguridad', tipo: 'texto' },
    { clave: 'sustancia', columna: 'H', titulo: 'Sustancia química', tipo: 'texto' },
    { clave: 'marca', columna: 'I', titulo: 'Marca', tipo: 'texto' },
    { clave: 'presentacion', columna: 'J', titulo: 'Presentación', tipo: 'texto' },
    { clave: 'peso_vacio', columna: 'K', titulo: 'Peso del frasco vacío', tipo: 'numero' },
    { clave: 'peso_total', columna: 'L', titulo: 'Peso del frasco lleno', tipo: 'numero' },
    { clave: 'cantidad', columna: 'M', titulo: 'Cantidad', tipo: 'numero' },
    { clave: 'unidad', columna: 'N', titulo: 'Unidad', tipo: 'texto' },
    { clave: 'observaciones', columna: 'AB', titulo: 'Observaciones', tipo: 'texto' },
  ],
  filas: [
    {
      sub_ubicacion: 'N3',
      mueble: '1',
      repisa: '1',
      fila_cajon: '2',
      color: 'rojo',
      hoja_seguridad: 'Sí',
      sustancia: 'Sustancia de prueba, líquido, presentación 1 L',
      marca: 'MARCA-PRUEBA',
      presentacion: 'FRASCO',
      peso_vacio: 40,
      peso_total: 288.54,
      cantidad: 248.54,
      unidad: 'g',
      observaciones: 'Renglón sintético',
    },
    {
      sub_ubicacion: 'N3',
      mueble: '2',
      sustancia: 'Segunda sustancia de prueba, sólido',
      cantidad: 10,
      unidad: 'mL',
    },
  ],
}

describe('formato unificado · libro para la ida y vuelta', () => {
  it('escribe el archivo que lee etl/tests/test_ida_y_vuelta.py', async () => {
    const buffer = await aExcel({
      titulo: 'Inventario en formato unificado',
      parametros: [{ etiqueta: 'Almacén', valor: 'N3' }],
      hojas: [REACTIVOS],
    })

    mkdirSync(dirname(SALIDA), { recursive: true })
    writeFileSync(SALIDA, Buffer.from(buffer))

    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
