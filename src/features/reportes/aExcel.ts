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

  /**
   * Letra de la columna en el formato unificado: «H», «AB».
   *
   * Solo la traen las hojas del formato, y no es decoracion. Reactivos arranca
   * en la B, salta la O y termina en la AB: escribir las columnas seguidas
   * desde la A produce un archivo que SE VE BIEN y que el ETL no puede leer,
   * porque busca cada campo en su letra.
   */
  columna?: string
}

export type HojaLista = {
  nombre: string
  columnas: Columna[]
  filas: Record<string, unknown>[]

  /**
   * En que fila van los titulos. Las hojas del formato la traen -8, y 9 en
   * Reactivos por las tres filas agrupadas de los apartados de la NOM-; los
   * reportes normales no, y entonces va la 1.
   */
  filaEncabezado?: number

  /** Lo que va ARRIBA del encabezado: responsable, periodo, fecha. */
  preambulo?: { celda: string; valor: string }[]
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

    // Dos modos. Sin `filaEncabezado` es un reporte normal: columnas seguidas
    // desde la A y titulos en la 1. Con ella es el formato unificado, y
    // entonces cada columna va en SU letra y el resto se queda vacio -la A es
    // el consecutivo «No.», que no se guarda, y hay huecos a proposito-.
    const enFormato = hoja.filaEncabezado !== undefined
    const filaTitulos = hoja.filaEncabezado ?? 1

    for (const { celda, valor } of hoja.preambulo ?? []) {
      ws.getCell(celda).value = valor
    }

    if (enFormato) {
      for (const c of hoja.columnas) {
        if (!c.columna) continue
        ws.getColumn(c.columna).width = c.ancho ?? anchoDe(c)
        ws.getCell(`${c.columna}${filaTitulos}`).value = c.titulo
      }
    } else {
      ws.columns = hoja.columnas.map((c) => ({
        header: c.titulo,
        key: c.clave,
        width: c.ancho ?? anchoDe(c),
      }))
    }

    ws.getRow(filaTitulos).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: filaTitulos }]

    if (!enFormato) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columnas.length },
      }
    }

    hoja.filas.forEach((fila, i) => {
      const numero = filaTitulos + 1 + i
      const agregada = ws.getRow(numero)

      hoja.columnas.forEach((c, indice) => {
        const valor = c.vacia ? null : convertir(fila[c.clave], c.tipo)
        const celda = enFormato
          ? c.columna
            ? agregada.getCell(c.columna)
            : null
          : agregada.getCell(indice + 1)

        if (celda === null) return
        celda.value = valor

        const token = c.resaltar?.(fila)
        if (token) {
          celda.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: RELLENO[token] },
          }
        }
      })

      agregada.commit()
    })
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
