import { z } from 'zod'

import type { Enums, Json, Tables } from '@/types/database'

export type Pendiente = Tables<'carga_pendiente'>

/**
 * Lo que el cargador anota por cada regla rota: `[{regla, columna, valor,
 * detalle}]`. Se declara aquí y se lee con `leerProblemas` en vez de castear el
 * `Json` que devuelve PostgREST. La columna es `jsonb` y el tipo generado no
 * promete nada de su forma: confiar en un cast sería confiar en que nadie
 * escribió jamás otra cosa ahí, y quien revisa se llevaría una pantalla en
 * blanco el día que pase.
 */
export type Problema = { regla: string; columna: string; valor: string; detalle: string }

export type FiltrosPendientes = {
  almacenId: number | 'todos'
  estado: Enums<'estado_pendiente'> | 'todos'
  motivo: Enums<'motivo_pendiente'> | 'todos'
}

/**
 * Arranca en el almacén propio y en «sin revisar»: esta pantalla es una cola de
 * trabajo, no un archivo histórico. Admin y consulta arrancan viendo los cuatro
 * almacenes, igual que en el inventario.
 *
 * `perfil` llega en `undefined` mientras su consulta está en vuelo.
 */
export function filtrosPendientesIniciales(
  perfil: { rol: Enums<'rol_usuario'>; almacenId: number | null } | undefined,
): FiltrosPendientes {
  const propio = perfil?.rol === 'responsable' && perfil.almacenId !== null

  return {
    almacenId: propio ? (perfil.almacenId as number) : 'todos',
    estado: 'pendiente',
    motivo: 'todos',
  }
}

function esObjeto(valor: unknown): valor is Record<string, Json> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Un valor de jsonb pintado como texto, sin `[object Object]` por sorpresa. */
function comoTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

export function leerProblemas(valor: Json | null): Problema[] {
  if (!Array.isArray(valor)) return []
  return valor.filter(esObjeto).map((p) => ({
    regla: comoTexto(p.regla),
    columna: comoTexto(p.columna),
    valor: comoTexto(p.valor),
    detalle: comoTexto(p.detalle),
  }))
}

export function leerRenglon(valor: Json | null): Record<string, Json> {
  return esObjeto(valor) ? valor : {}
}

/**
 * El orden en que se leen los campos, que no es el orden en que llegan.
 * PostgREST devuelve el `jsonb` con las llaves ordenadas por longitud y luego
 * por bytes —así lo guarda Postgres—, así que sin esta lista «cantidad» aparece
 * entre «color» y «mueble» y quien revisa tiene que cazarla.
 *
 * El criterio es el del renglón del Excel: qué cosa es, cuánta hay, dónde está,
 * y al final la ficha normativa. Lo que no esté aquí se pinta después, en el
 * orden en que venía.
 */
const ORDEN = [
  'clasificacion', 'familia', 'sustancia', 'articulo', 'especificacion',
  'marca', 'modelo', 'presentacion',
  'cantidad', 'unidad', 'peso_vacio', 'peso_total',
  'sub_ubicacion', 'mueble', 'repisa', 'fila_cajon', 'coord_h', 'coord_v', 'coord_i',
  'laboratorio', 'numero_serie', 'numero_inventario', 'funcionamiento',
  'fecha_chequeo', 'mantenimiento',
  'origen_especie', 'metodo_conservacion', 'temperatura',
  'fecha_recoleccion', 'fecha_preparacion', 'responsable_muestra',
  'color', 'estado_fisico', 'solido', 'liquido', 'gas', 'hoja_seguridad',
  'caracteristica_quimica', 'caracteristica_toxica',
  'riesgo_salud', 'riesgo_inflamabilidad', 'riesgo_reactividad',
  'peligro_especial', 'implica_peligro',
  'observaciones',
]

/** Los títulos de columna del formato unificado, uno por llave del renglón. */
export const ETIQUETAS: Record<string, string> = {
  clasificacion: 'Clasificación',
  familia: 'Familia',
  sustancia: 'Sustancia química',
  articulo: 'Artículo',
  especificacion: 'Especificación',
  marca: 'Marca',
  modelo: 'Modelo',
  presentacion: 'Presentación',
  cantidad: 'Cantidad',
  unidad: 'Unidad',
  peso_vacio: 'Peso del frasco vacío',
  peso_total: 'Peso del frasco lleno',
  sub_ubicacion: 'Sub-ubicación',
  mueble: 'Mueble',
  repisa: 'Repisa',
  fila_cajon: 'Fila o cajón',
  coord_h: 'Posición horizontal',
  coord_v: 'Posición vertical',
  coord_i: 'Posición interior',
  laboratorio: 'Laboratorio',
  numero_serie: 'Número de serie',
  numero_inventario: 'Inventario UAEH',
  funcionamiento: 'Funcionamiento',
  fecha_chequeo: 'Fecha de chequeo',
  mantenimiento: 'Mantenimiento',
  origen_especie: 'Origen o especie',
  metodo_conservacion: 'Método de conservación',
  temperatura: 'Temperatura',
  fecha_recoleccion: 'Fecha de recolección',
  fecha_preparacion: 'Fecha de preparación',
  responsable_muestra: 'Responsable de la muestra',
  color: 'Color de almacenaje',
  estado_fisico: 'Estado físico',
  solido: 'Sólido',
  liquido: 'Líquido',
  gas: 'Gas',
  hoja_seguridad: 'Tiene hoja de seguridad',
  caracteristica_quimica: 'Característica química',
  caracteristica_toxica: 'Característica tóxica',
  riesgo_salud: 'Riesgo a la salud',
  riesgo_inflamabilidad: 'Riesgo de inflamabilidad',
  riesgo_reactividad: 'Riesgo de reactividad',
  peligro_especial: 'Peligro especial',
  implica_peligro: 'Implica actividad peligrosa',
  observaciones: 'Observaciones',
}

export type TipoCampo = 'texto' | 'numero' | 'booleano'
export type CampoRenglon = { clave: string; etiqueta: string; tipo: TipoCampo }

/**
 * El tipo del control sale del VALOR que traía el renglón, no de una lista de
 * campos numéricos. Es deliberado: los renglones apartados por regla llevan el
 * dato crudo del Excel, y ahí «cantidad» puede venir como `1` o como
 * «2 cajas». Si «2 cajas» se pintara en un `type="number"` el campo saldría
 * vacío y quien revisa perdería justo lo que tiene que corregir.
 */
function tipoDe(valor: Json): TipoCampo {
  if (typeof valor === 'number') return 'numero'
  if (typeof valor === 'boolean') return 'booleano'
  return 'texto'
}

/**
 * Los campos que se pueden editar, en orden de lectura. Salen del renglón
 * mismo: cada hoja del formato tiene sus columnas y el cargador guarda las de
 * la suya, así que la pantalla no lleva ni un condicional por hoja ni por
 * almacén. Es la misma propiedad que hace que el formulario de alta se arme
 * desde la base y no desde el código.
 */
export function camposDeRenglon(renglon: Record<string, Json>): CampoRenglon[] {
  const posicion = (clave: string) => {
    const i = ORDEN.indexOf(clave)
    return i === -1 ? ORDEN.length : i
  }

  // `sort` es estable, así que las llaves que no están en ORDEN conservan entre
  // sí el orden en que llegaron.
  return Object.keys(renglon)
    .sort((a, b) => posicion(a) - posicion(b))
    .map((clave) => ({
      clave,
      etiqueta: ETIQUETAS[clave] ?? clave,
      tipo: tipoDe(renglon[clave]),
    }))
}

export type ValoresRenglon = Record<string, string | boolean>

/** El renglón como lo pide el formulario: todo texto, salvo las casillas. */
export function valoresDeRenglon(renglon: Record<string, Json>): ValoresRenglon {
  const valores: ValoresRenglon = {}
  for (const [clave, valor] of Object.entries(renglon)) {
    valores[clave] = typeof valor === 'boolean' ? valor : comoTexto(valor)
  }
  return valores
}

/**
 * El camino de vuelta. Se recorre el renglón ORIGINAL y no los valores del
 * formulario: así un campo que no venía en la hoja no se puede colar en el
 * envío por mucho que aparezca en el estado del formulario. Es la misma regla
 * que en el alta —el payload se arma recorriendo los campos, nunca leyendo un
 * objeto de estado más grande—.
 *
 * Un campo que llegó como número vuelve como número. El renglón conserva su
 * forma, y `resolver_pendiente` no tiene que adivinar si «100» es la cantidad o
 * el nombre de un mueble.
 */
export function renglonDesdeValores(
  original: Record<string, Json>,
  valores: ValoresRenglon,
): Record<string, Json> {
  const salida: Record<string, Json> = {}

  for (const [clave, previo] of Object.entries(original)) {
    const valor = valores[clave]

    if (typeof valor === 'boolean') {
      salida[clave] = valor
      continue
    }

    const texto = (valor ?? '').toString().trim()
    if (texto === '') {
      salida[clave] = null
      continue
    }

    const numero = Number(texto)
    salida[clave] =
      typeof previo === 'number' && texto !== '' && Number.isFinite(numero) ? numero : texto
  }

  return salida
}

/** El nombre con el que quien revisa reconoce el renglón. */
export function nombreDeRenglon(renglon: Record<string, Json>): string {
  // Reactivos titula la columna «Sustancia química»; el resto, «Artículo». Es
  // el mismo campo, y el cargador guarda el que traiga la hoja.
  const nombre = renglon.sustancia ?? renglon.articulo
  const texto = comoTexto(nombre).trim()
  return texto === '' ? 'Renglón sin nombre' : texto
}

/**
 * La ficha NOM-005-STPS del reactivo: rombo, color de almacenaje, hoja de
 * seguridad. Se separa del resto porque solo se usa cuando el artículo todavía
 * no existe en el catálogo, y para 236 renglones de Reactivos son trece campos
 * de más entre la cantidad y las observaciones. El panel los pliega; siguen
 * estando y siguen siendo editables.
 */
const FICHA_NOM = new Set([
  'color', 'estado_fisico', 'solido', 'liquido', 'gas', 'hoja_seguridad',
  'caracteristica_quimica', 'caracteristica_toxica',
  'riesgo_salud', 'riesgo_inflamabilidad', 'riesgo_reactividad',
  'peligro_especial', 'implica_peligro',
])

export function esFichaNOM(clave: string): boolean {
  return FICHA_NOM.has(clave)
}

/**
 * La ubicación como la arma el cargador: las partes con dato, en el orden del
 * formato y con el prefijo que lleva cada una. Es lo que se compara contra la
 * `etiqueta` de la existencia con la que chocó, así que tiene que salir igual
 * que `private.ubicacion_de_renglon` en la base.
 */
const PARTES_UBICACION: [clave: string, prefijo: string][] = [
  ['sub_ubicacion', ''], ['mueble', ''], ['repisa', 'Repisa '],
  ['fila_cajon', 'Fila '], ['coord_h', 'H'], ['coord_v', 'V'], ['coord_i', 'I'],
]

/**
 * Las formas de decir «no tiene» del contrato del ETL. Aquí solo sirven para no
 * pintar «Repisa —» en la comparación; la base tiene su propia copia, que es la
 * que decide lo que se guarda.
 */
const VACIOS = new Set([
  '', '-', '—', 'sin serie', 'sin modelo', 'sin inventario', 'sin marca',
  's/n', 'n/a', 'na', 's/d', 'nd', 'sin dato', 'no aplica', 'ninguno', 'ninguna',
])

function conDato(valor: Json | undefined): string {
  const texto = comoTexto(valor).trim()
  return VACIOS.has(normalizarTexto(texto)) ? '' : texto
}

/** Minúsculas y sin acentos, igual que `public.norm_texto()` en la base. */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function ubicacionDeRenglon(renglon: Record<string, Json>): string {
  const partes = PARTES_UBICACION.map(([clave, prefijo]) => {
    const valor = conDato(renglon[clave])
    return valor === '' ? '' : `${prefijo}${valor}`
  }).filter((parte) => parte !== '')

  return partes.length === 0 ? '—' : partes.join(' · ')
}

/** «528.14 g», o «—» si el renglón no dice cuánto hay. */
export function cantidadDeRenglon(renglon: Record<string, Json>): string {
  const cantidad = conDato(renglon.cantidad)
  if (cantidad === '') return '—'
  return `${cantidad} ${conDato(renglon.unidad)}`.trim()
}

/** El campo del renglón, listo para pintarse. `—` cuando no dice nada. */
export function campoDeRenglon(renglon: Record<string, Json>, clave: string): string {
  const valor = conDato(renglon[clave])
  return valor === '' ? '—' : valor
}

/** «Insumos · fila 70»: lo primero que hace quien revisa es abrir el archivo ahí. */
export function origenDePendiente(pendiente: { hoja: string; fila: number }): string {
  return `${pendiente.hoja} · fila ${pendiente.fila}`
}

/**
 * Lo que cabe en una celda de la tabla. Un renglón puede violar varias reglas a
 * la vez —Material!F136 viola la 1 y el §6— y en la lista se lee la primera con
 * la cuenta de las demás; el detalle completo vive en el panel.
 */
export function resumenDeProblemas(problemas: Problema[]): string {
  if (problemas.length === 0) return '—'

  const primero = problemas[0]
  const texto = primero.detalle !== '' ? primero.detalle : primero.regla
  return problemas.length === 1 ? texto : `${texto} (y ${problemas.length - 1} más)`
}

const NUMERO_O_NADA = 'Tiene que ser un número'

/**
 * El esquema se arma recorriendo los campos, igual que el formulario. Solo los
 * que llegaron como número se validan como número: los demás son texto libre
 * porque el Excel los trae como texto libre.
 *
 * Los mensajes de error viven aquí y no en el JSX, que es la regla del stack.
 */
export function esquemaDeCampos(campos: CampoRenglon[]): z.ZodType<ValoresRenglon, ValoresRenglon> {
  const forma: Record<string, z.ZodType<string | boolean>> = {}

  for (const campo of campos) {
    forma[campo.clave] =
      campo.tipo === 'booleano'
        ? z.boolean()
        : campo.tipo === 'numero'
          ? z.string().refine((v) => v.trim() === '' || Number.isFinite(Number(v)), NUMERO_O_NADA)
          : z.string()
  }

  return z.object(forma) as unknown as z.ZodType<ValoresRenglon, ValoresRenglon>
}
