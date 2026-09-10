import { z } from 'zod'

import type { Enums } from '@/types/database'

/**
 * Un campo tal como lo devuelve `public.formulario(almacen, clasificacion)`.
 *
 * No se escribe a mano en ningún sitio: es la forma de la fila que sale de la
 * base. Vive como tipo propio y no como `Tables<...>` porque `formulario` es
 * una función, no una tabla, y sus columnas son las que declara su `returns
 * table`.
 */
export type Campo = {
  campo: string
  etiqueta: string
  tipo_dato: string
  destino: string
  opciones: string[] | null
  ayuda: string | null
  obligatorio: boolean
  orden: number
}

/**
 * Lo que el formulario tiene en la mano mientras se captura. Todo es texto
 * porque todo sale de un control de texto: los números se validan al construir
 * el esquema, no al teclear, y así el campo puede estar vacío sin volverse
 * `NaN`. Los booleanos son la excepción: una casilla no tiene estado vacío.
 */
export type Valores = Record<string, string | boolean>

/**
 * En qué recuadro del diálogo cae cada campo.
 *
 * Sale del prefijo de `destino`, que es un dato de la base, y no de una lista
 * de nombres escrita aquí. Es lo que permite que agregar un campo a
 * `articulo_reactivo` lo pinte dentro de la ficha NOM sin tocar el diálogo.
 */
export type Grupo = 'reactivo' | 'biologico' | 'ubicacion' | 'general'

export function grupoDe(campo: Campo): Grupo {
  if (campo.destino.startsWith('articulo_reactivo.')) return 'reactivo'
  if (campo.destino.startsWith('articulo_biologico.')) return 'biologico'
  if (campo.destino.startsWith('ubicacion.')) return 'ubicacion'
  return 'general'
}

/**
 * `clasificacion` la elige el selector de arriba del diálogo, que es el que
 * decide qué perfil se pide. Los perfiles de material, insumo y electrónica
 * además la listan como campo: pintarla otra vez sería preguntar dos veces lo
 * mismo y admitir dos respuestas distintas.
 *
 * No se filtra al mandar: el valor sí viaja, lo pone `crear_existencia` desde
 * su propio argumento.
 */
export const CAMPO_CLASIFICACION = 'clasificacion'

export function camposVisibles(campos: Campo[]): Campo[] {
  return campos.filter((c) => c.campo !== CAMPO_CLASIFICACION)
}

/**
 * El campo cuyas opciones no están en `campo_capturable` sino en una tabla.
 * Su propia `ayuda` lo dice: «Las opciones salen de la tabla laboratorio del
 * almacén», y sus `opciones` traen el literal `(desde laboratorio)`.
 */
export const CAMPO_LABORATORIO = 'laboratorio'

/**
 * El esquema de zod que valida la captura, construido recorriendo los campos
 * que dio la base.
 *
 * Los mensajes se escriben aquí, en el esquema, y no en el JSX. La etiqueta se
 * interpola porque un «Requerido» suelto bajo el noveno campo de un formulario
 * de veinticinco no dice cuál falta cuando el error llega tras enviar.
 */
export function esquemaDeCampos(campos: Campo[]): z.ZodType<Valores, Valores> {
  const forma: Record<string, z.ZodType> = {}

  for (const campo of camposVisibles(campos)) {
    forma[campo.campo] = validadorDe(campo)
  }

  // El único `as` del módulo, y es inevitable: la forma del objeto se arma en
  // tiempo de ejecución a partir de lo que devolvió la base, así que zod la
  // infiere como `Record<string, unknown>` y TypeScript no tiene de dónde saber
  // más. Lo que el `as` promete —que cada valor es texto o booleano— sí es
  // cierto por construcción: lo garantiza `validadorDe`, que solo produce
  // validadores de `z.string()` o `z.boolean()`.
  return z.object(forma) as unknown as z.ZodType<Valores, Valores>
}

function validadorDe(campo: Campo): z.ZodType {
  if (campo.tipo_dato === 'booleano') {
    // Una casilla siempre tiene respuesta. Marcar «obligatorio» sobre un
    // booleano significaría exigir que esté marcada, y eso no es lo que dice el
    // perfil de reactivo con `hoja_seguridad`: dice que hay que contestar si la
    // tienes o no, y «no» es una respuesta.
    return z.boolean()
  }

  if (campo.tipo_dato === 'numero') {
    return texto(campo).refine(
      (v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      `${campo.etiqueta}: escribe un número, y que no sea negativo`,
    )
  }

  if (campo.tipo_dato === 'fecha') {
    return texto(campo).refine(
      (v) => v === '' || !Number.isNaN(Date.parse(v)),
      `${campo.etiqueta}: la fecha no es válida`,
    )
  }

  return texto(campo)
}

function texto(campo: Campo): z.ZodString {
  const base = z.string().trim()
  return campo.obligatorio ? base.min(1, `${campo.etiqueta} es obligatorio`) : base
}

/**
 * Con qué arranca cada campo. Los de texto vacíos y las casillas sin marcar:
 * react-hook-form necesita un valor definido por campo o el control salta de no
 * controlado a controlado en el primer tecleo, y React lo avisa por consola.
 */
export function valoresIniciales(campos: Campo[]): Valores {
  const valores: Valores = {}
  for (const campo of camposVisibles(campos)) {
    valores[campo.campo] = campo.tipo_dato === 'booleano' ? false : ''
  }
  return valores
}

/**
 * El payload que se manda a `crear_existencia`, armado **recorriendo los
 * campos**, nunca las llaves del objeto de estado.
 *
 * Esa es la propiedad que hace que un campo fuera del perfil sencillamente no
 * exista en el envío. Si el payload saliera del estado del formulario, un campo
 * que quedó ahí de una clasificación anterior —porque se cambió el tipo a medio
 * capturar— se colaría, que es exactamente el problema que los perfiles vienen
 * a resolver.
 *
 * Los vacíos se omiten en vez de mandarse como cadena vacía: `crear_existencia`
 * lee el renglón con `private.texto_de`, que ya trata `''` como nulo, pero
 * omitirlos deja el envío diciendo solo lo que de verdad se capturó.
 */
export function payloadDe(campos: Campo[], valores: Valores): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {}

  for (const campo of camposVisibles(campos)) {
    const valor = valores[campo.campo]

    if (typeof valor === 'boolean') {
      payload[campo.campo] = valor
      continue
    }

    const limpio = (valor ?? '').trim()
    if (limpio !== '') payload[campo.campo] = limpio
  }

  return payload
}

/**
 * Las seis clasificaciones, con el rótulo que usa el diálogo.
 *
 * Son las mismas de `CLASIFICACIONES` en `filtros.ts` pero en singular: allá se
 * filtra un conjunto («Reactivos») y aquí se declara qué es una cosa
 * («Reactivo»). Compartir la lista obligaría a que un rótulo sirviera para las
 * dos frases, y ninguno de los dos sirve para la otra.
 */
export const TIPOS: { valor: Enums<'clasificacion_articulo'>; etiqueta: string }[] = [
  { valor: 'reactivo', etiqueta: 'Reactivo' },
  { valor: 'material', etiqueta: 'Material / Herramienta' },
  { valor: 'equipo', etiqueta: 'Equipo / Maquinaria' },
  { valor: 'insumo', etiqueta: 'Insumo / Consumible' },
  { valor: 'componente', etiqueta: 'Componente electrónico' },
  { valor: 'materia_biologica', etiqueta: 'Materia biológica' },
]

/**
 * Los rótulos de las opciones de un `seleccion`.
 *
 * Las `opciones` de `campo_capturable` son valores del enum de Postgres
 * —`solido`, `materia_biologica`— o ya vienen en prosa —`Correcto`, `Presenta
 * fallas`—. Sin acento y sin mayúscula se ven como lo que son: identificadores
 * de la base asomándose a la pantalla.
 */
const ROTULOS: Record<string, string> = {
  solido: 'Sólido',
  liquido: 'Líquido',
  gas: 'Gas',
  verde: 'Verde',
  rojo: 'Rojo',
  azul: 'Azul',
  blanco: 'Blanco',
  amarillo: 'Amarillo',
  naranja: 'Naranja',
  reactivo: 'Reactivo',
  material: 'Material',
  insumo: 'Insumo',
  equipo: 'Equipo',
  componente: 'Componente',
  materia_biologica: 'Materia biológica',
}

export function rotuloDeOpcion(opcion: string): string {
  return ROTULOS[opcion] ?? opcion
}
