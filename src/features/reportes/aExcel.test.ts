import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { aExcel } from './aExcel'

async function abrir(buffer: ArrayBuffer) {
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(buffer)
  return libro
}

const BASE = {
  titulo: 'Caducidades',
  parametros: [
    { etiqueta: 'Almacén', valor: 'N3' },
    { etiqueta: 'Horizonte', valor: '90 días' },
  ],
  hojas: [
    {
      nombre: 'Caducidades',
      columnas: [
        { clave: 'articulo', titulo: 'Artículo', tipo: 'texto' as const },
        { clave: 'cantidad', titulo: 'Cantidad', tipo: 'numero' as const },
        { clave: 'caduca', titulo: 'Caduca', tipo: 'fecha' as const },
        { clave: 'conteo', titulo: 'Conteo', tipo: 'texto' as const, vacia: true },
      ],
      filas: [
        { articulo: 'Acetona', cantidad: 40.5, caduca: '2026-12-01' },
        { articulo: 'Etanol', cantidad: 12, caduca: '2026-09-01' },
      ],
    },
  ],
}

describe('aExcel', () => {
  it('escribe la hoja de Parámetros primero', async () => {
    const libro = await abrir(await aExcel(BASE))
    expect(libro.worksheets[0].name).toBe('Parámetros')
    expect(libro.worksheets[1].name).toBe('Caducidades')
  })

  it('registra en Parámetros con qué filtros salió', async () => {
    const libro = await abrir(await aExcel(BASE))
    const texto = JSON.stringify(libro.getWorksheet('Parámetros')?.getSheetValues())
    expect(texto).toContain('Almacén')
    expect(texto).toContain('N3')
    expect(texto).toContain('90 días')
  })

  it('escribe los números como número, no como texto', async () => {
    const libro = await abrir(await aExcel(BASE))
    const celda = libro.getWorksheet('Caducidades')?.getCell('B2')
    expect(typeof celda?.value).toBe('number')
    expect(celda?.value).toBe(40.5)
  })

  it('escribe las fechas como fecha, no como texto', async () => {
    const libro = await abrir(await aExcel(BASE))
    const celda = libro.getWorksheet('Caducidades')?.getCell('C2')
    expect(celda?.value).toBeInstanceOf(Date)
  })

  it('deja vacía la columna marcada, pero con su encabezado', async () => {
    const libro = await abrir(await aExcel(BASE))
    const hoja = libro.getWorksheet('Caducidades')
    expect(hoja?.getCell('D1').value).toBe('Conteo')
    expect(hoja?.getCell('D2').value).toBeFalsy()
  })

  it('congela el encabezado y pone autofiltro', async () => {
    const libro = await abrir(await aExcel(BASE))
    const hoja = libro.getWorksheet('Caducidades')
    expect(hoja?.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(hoja?.autoFilter).toBeTruthy()
  })

  it('resalta la fila que la columna marca como alerta', async () => {
    const conResalte = {
      ...BASE,
      hojas: [
        {
          ...BASE.hojas[0],
          columnas: BASE.hojas[0].columnas.map((c) =>
            c.clave === 'cantidad'
              ? {
                  ...c,
                  resaltar: (f: Record<string, unknown>) =>
                    Number(f.cantidad) < 20 ? ('alerta' as const) : null,
                }
              : c,
          ),
        },
      ],
    }
    const libro = await abrir(await aExcel(conResalte))
    const hoja = libro.getWorksheet('Caducidades')
    expect(hoja?.getCell('B3').fill).toBeTruthy() // Etanol, 12
    expect(hoja?.getCell('B2').fill?.type).toBeUndefined() // Acetona, 40.5
  })
})

/*
 * El formato unificado no es una hoja cualquiera: sus columnas viven en letras
 * concretas —Reactivos arranca en B, salta la O, y termina en AB—, su
 * encabezado va en la fila 8 (9 en Reactivos, por las tres filas agrupadas de
 * la NOM) y arriba lleva un preámbulo. Escribir las columnas seguidas desde A1
 * produce un archivo que se ve bien y que el ETL no puede leer.
 */
describe('aExcel · formato unificado', () => {
  const FORMATO = {
    titulo: 'Inventario en formato unificado',
    parametros: [{ etiqueta: 'Almacén', valor: 'UCL-N3' }],
    hojas: [
      {
        nombre: 'Reactivos',
        filaEncabezado: 9,
        preambulo: [
          { celda: 'F4', valor: 'Quien responde' },
          { celda: 'B5', valor: 'J-D 2026' },
          { celda: 'F5', valor: '2026-09-21' },
        ],
        columnas: [
          { clave: 'sub_ubicacion', columna: 'B', titulo: 'Sub-ubicación', tipo: 'texto' as const },
          { clave: 'sustancia', columna: 'H', titulo: 'Sustancia química', tipo: 'texto' as const },
          { clave: 'cantidad', columna: 'M', titulo: 'Cantidad', tipo: 'numero' as const },
          { clave: 'observaciones', columna: 'AB', titulo: 'Observaciones', tipo: 'texto' as const },
        ],
        filas: [{ sub_ubicacion: 'N3', sustancia: 'Acetona', cantidad: 248.54, observaciones: 'x' }],
      },
    ],
  }

  it('pone cada columna en SU letra, no en la siguiente libre', async () => {
    const hoja = (await abrir(await aExcel(FORMATO))).getWorksheet('Reactivos')

    expect(hoja?.getCell('B9').value).toBe('Sub-ubicación')
    expect(hoja?.getCell('H9').value).toBe('Sustancia química')
    expect(hoja?.getCell('AB9').value).toBe('Observaciones')
  })

  it('deja vacías las columnas que el formato no usa', async () => {
    const hoja = (await abrir(await aExcel(FORMATO))).getWorksheet('Reactivos')

    // A es el consecutivo «No.» del Excel, que no se guarda. O, Z y AA son
    // huecos del formato.
    expect(hoja?.getCell('A9').value).toBeFalsy()
    expect(hoja?.getCell('O9').value).toBeFalsy()
    expect(hoja?.getCell('Z9').value).toBeFalsy()
  })

  it('el encabezado va en su fila y los datos debajo', async () => {
    const hoja = (await abrir(await aExcel(FORMATO))).getWorksheet('Reactivos')

    expect(hoja?.getCell('H10').value).toBe('Acetona')
    expect(hoja?.getCell('M10').value).toBe(248.54)
  })

  it('escribe el preámbulo donde el ETL lo busca', async () => {
    const hoja = (await abrir(await aExcel(FORMATO))).getWorksheet('Reactivos')

    expect(hoja?.getCell('F4').value).toBe('Quien responde')
    expect(hoja?.getCell('B5').value).toBe('J-D 2026')
    expect(hoja?.getCell('F5').value).toBe('2026-09-21')
  })

  it('congela por debajo del encabezado, no de la primera fila', async () => {
    const hoja = (await abrir(await aExcel(FORMATO))).getWorksheet('Reactivos')

    expect(hoja?.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 9 })
  })
})
