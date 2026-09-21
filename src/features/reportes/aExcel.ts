import ExcelJS from 'exceljs'

/**
 * La UNICA pieza del sistema que sabe de exceljs. Todo lo demas -el registro,
 * las pantallas, las consultas- habla de filas y columnas, no de libros.
 */

export type TipoColumna = 'texto' | 'numero' | 'entero' | 'fecha'

export type Columna = {
  clave: string
  titulo: string
  tipo: TipoColumna
  ancho?: number
  /** Sale con encabezado y sin datos: es para anotar a mano. */
  vacia?: boolean
  resaltar?: (fila: Record<string, unknown>) => 'alerta' | 'aviso' | null
}

export type HojaLista = {
  nombre: string
  columnas: Columna[]
  filas: Record<string, unknown>[]
}

/** Rojo y ámbar suaves: se leen impresos en blanco y negro sin taparse. */
const RELLENO = {
  alerta: 'FFFFD9D9',
  aviso: 'FFFFF0C7',
} as const

export async function aExcel(opciones: {
  titulo: string
  parametros: { etiqueta: string; valor: string }[]
  hojas: HojaLista[]
}): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook()
  libro.created = new Date()

  // Siempre primero. El destinatario es uno mismo, asi que no lleva membrete,
  // pero si lleva esto: un archivo en Descargas dentro de tres meses sin saber
  // con que filtros salio no vale nada.
  const portada = libro.addWorksheet('Parámetros')
  portada.columns = [{ width: 28 }, { width: 52 }]
  portada.addRow([opciones.titulo]).font = { bold: true, size: 14 }
  portada.addRow([])
  for (const { etiqueta, valor } of opciones.parametros) {
    const fila = portada.addRow([etiqueta, valor])
    fila.getCell(1).font = { bold: true }
  }

  for (const hoja of opciones.hojas) {
    const ws = libro.addWorksheet(hoja.nombre)

    ws.columns = hoja.columnas.map((c) => ({
      header: c.titulo,
      key: c.clave,
      width: c.ancho ?? anchoDe(c),
    }))
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: hoja.columnas.length },
    }

    for (const fila of hoja.filas) {
      const agregada = ws.addRow(
        Object.fromEntries(
          hoja.columnas.map((c) => [
            c.clave,
            c.vacia ? null : convertir(fila[c.clave], c.tipo),
          ]),
        ),
      )

      hoja.columnas.forEach((c, i) => {
        const token = c.resaltar?.(fila)
        if (!token) return
        agregada.getCell(i + 1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: RELLENO[token] },
        }
      })
    }
  }

  return libro.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

/**
 * El tipo real importa, y no es cosmetica: los Excel originales traian
 * «Un frasco» en columna numerica. El formato nuevo no puede reintroducir por
 * la puerta de salida lo que el ETL limpio en la de entrada.
 */
function convertir(valor: unknown, tipo: TipoColumna) {
  if (valor === null || valor === undefined || valor === '') return null

  switch (tipo) {
    case 'numero':
    case 'entero': {
      const n = Number(valor)
      // Un texto donde se esperaba numero se deja como texto en vez de
      // convertirse en NaN: el dato malo se ve, el NaN se disimula.
      return Number.isFinite(n) ? n : String(valor)
    }
    case 'fecha': {
      const d = new Date(String(valor))
      return Number.isNaN(d.getTime()) ? String(valor) : d
    }
    default:
      return String(valor)
  }
}

function anchoDe(c: Columna) {
  if (c.tipo === 'fecha') return 14
  if (c.tipo === 'numero' || c.tipo === 'entero') return 12
  return Math.max(14, Math.min(48, c.titulo.length + 6))
}

/**
 * La descarga. Va aparte de `aExcel` para que las pruebas puedan inspeccionar
 * el libro sin tocar el DOM.
 */
export function descargar(buffer: ArrayBuffer, nombre: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}
