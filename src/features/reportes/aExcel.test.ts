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
