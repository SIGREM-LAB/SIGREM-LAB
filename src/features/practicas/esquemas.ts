import { z } from 'zod'

import type { Enums } from '@/types/database'
import type { Clasificacion, Metodo } from './metodos'

export type Funcionamiento = Enums<'funcionamiento_equipo'>

/**
 * Un producto dentro de la captura en curso.
 *
 * Lleva junto lo que se muestra —código, nombre, cuánto hay— y lo que se
 * captura. Los dos viajan al borrador, así que restaurarlo no necesita volver a
 * consultar el inventario: si un producto se dio de baja mientras el borrador
 * dormía, la fila sigue legible y el error sale al finalizar, que es donde debe
 * salir.
 */
export type ElementoCaptura = {
  existenciaId: number
  codigo: string
  nombre: string
  clasificacion: Clasificacion
  unidadBase: string
  almacenClave: string
  ubicacion: string | null
  /** El saldo al momento de agregarlo. Informativo. */
  disponible: number
  /** Lo decide la base y llega en la fila; aquí nunca se recalcula. */
  metodo: Metodo

  pesoInicial: number | null
  pesoFinal: number | null

  cantidadEntregada: number | null
  cantidadDevuelta: number | null
  cantidadDanada: number | null

  estadoSalida: Funcionamiento | null
  estadoDevolucion: Funcionamiento | null

  observaciones: string
  motivos: string[]
}

/**
 * La forma mínima de una fila de `existencia_listado` que esto necesita.
 *
 * `id` es anulable porque Supabase marca así **todas** las columnas de una
 * vista, sin importar que la de origen sea la llave primaria. Declararlo
 * `number` a secas dejaría de ser asignable lo que devuelve la consulta, y el
 * error saldría lejos de aquí.
 */
export type FilaExistencia = {
  id: number | null
  codigo: string | null
  nombre_canonico: string | null
  clasificacion: Clasificacion | null
  unidad_base: string | null
  almacen_clave: string | null
  cantidad: number | null
  ubicacion: string | null
  metodo_control: Metodo | null
}

/** Una fila que sí se puede registrar: la que tiene id. */
export type FilaUtilizable = FilaExistencia & { id: number }

/**
 * Se estrecha en la frontera de datos y no se rellena con `?? 0`: una
 * existencia sin id no se puede registrar, y un cero la mandaría a la RPC como
 * la existencia 0, con el error saliendo en la base en vez de aquí.
 */
export function esFilaUtilizable(fila: FilaExistencia): fila is FilaUtilizable {
  return fila.id !== null
}

/**
 * Respaldo para cuando `metodo_control` llega nulo. No es que se espere que
 * pase —la expresión de la vista no puede devolver nulo— pero Supabase marca
 * anulables todas las columnas de una vista, y un `!` aquí sería confiar en eso
 * para siempre. Refleja `public.metodo_de_control()`; la base sigue mandando.
 */
function metodoDeRespaldo(clasificacion: Clasificacion | null): Metodo {
  if (clasificacion === 'reactivo') return 'peso'
  if (clasificacion === 'equipo') return 'prestamo'
  return 'cantidad'
}

export function elementoDesdeExistencia(fila: FilaUtilizable): ElementoCaptura {
  return {
    existenciaId: fila.id,
    codigo: fila.codigo ?? '—',
    nombre: fila.nombre_canonico ?? 'Sin nombre',
    clasificacion: fila.clasificacion ?? 'material',
    unidadBase: fila.unidad_base ?? '',
    almacenClave: fila.almacen_clave ?? '',
    ubicacion: fila.ubicacion,
    disponible: fila.cantidad ?? 0,
    metodo: fila.metodo_control ?? metodoDeRespaldo(fila.clasificacion),

    pesoInicial: null,
    pesoFinal: null,
    cantidadEntregada: null,
    cantidadDevuelta: null,
    cantidadDanada: null,
    estadoSalida: null,
    estadoDevolucion: null,

    observaciones: '',
    motivos: [],
  }
}

// ---------------------------------------------------------------------------
// Lo calculado, sólo para mostrar
// ---------------------------------------------------------------------------
// `consumo` y `perdidas` son columnas generadas en la base. Estas dos funciones
// existen para pintar el número mientras se captura; lo que se guarda lo calcula
// Postgres. `aPayloadElementos` es quien garantiza que no se envíen.

export function consumoDe(el: ElementoCaptura): number | null {
  if (el.metodo !== 'peso') return null
  if (el.pesoInicial === null || el.pesoFinal === null) return null
  return el.pesoInicial - el.pesoFinal
}

export function perdidasDe(el: ElementoCaptura): number | null {
  if (el.metodo !== 'cantidad') return null
  if (el.cantidadEntregada === null) return null
  return el.cantidadEntregada - (el.cantidadDevuelta ?? 0) - (el.cantidadDanada ?? 0)
}

// ---------------------------------------------------------------------------
// Cuándo un producto está completo
// ---------------------------------------------------------------------------
/**
 * Devuelve el problema del producto, o `null` si no tiene ninguno.
 *
 * Es el espejo de `practica_elemento_campos_por_metodo`,
 * `practica_elemento_peso_coherente` y `practica_elemento_devolucion_coherente`.
 * Que estén los dos lados no es duplicación por gusto: la base es la que manda
 * y no se puede saltar, pero si el frontend no lo dice antes, la persona llena
 * los tres paneles y descubre el problema al finalizar, cuando ya no sabe cuál
 * de los productos fue.
 *
 * Si un check cambia en una migración, este archivo cambia con él.
 */
export function errorDeElemento(el: ElementoCaptura): string | null {
  if (el.metodo === 'peso') {
    if (el.pesoInicial === null || el.pesoFinal === null) {
      return 'Captura el peso inicial y el final'
    }
    if (el.pesoInicial < 0 || el.pesoFinal < 0) {
      return 'Los pesos no pueden ser negativos'
    }
    if (el.pesoFinal > el.pesoInicial) {
      return 'El peso final no puede ser mayor que el inicial'
    }
    return null
  }

  if (el.metodo === 'cantidad') {
    if (el.cantidadEntregada === null) return 'Captura la cantidad entregada'
    if (
      el.cantidadEntregada < 0 ||
      (el.cantidadDevuelta ?? 0) < 0 ||
      (el.cantidadDanada ?? 0) < 0
    ) {
      return 'Las cantidades no pueden ser negativas'
    }
    if ((el.cantidadDevuelta ?? 0) + (el.cantidadDanada ?? 0) > el.cantidadEntregada) {
      return 'Lo devuelto y lo dañado no pueden sumar más de lo entregado'
    }
    return null
  }

  // Préstamo. El estado de devolución es opcional a propósito: un equipo puede
  // quedarse prestado de un día para otro, y el trigger sólo actualiza
  // `existencia.funcionamiento` si viene.
  if (el.estadoSalida === null) return 'Elige el estado de salida del equipo'
  return null
}

export function estaCompleto(el: ElementoCaptura): boolean {
  return errorDeElemento(el) === null
}

// ---------------------------------------------------------------------------
// La cabecera
// ---------------------------------------------------------------------------
// Los mensajes van en el esquema y no en el JSX: así el texto que ve el usuario
// vive junto a la regla que lo produce.
const requerido = (mensaje: string) =>
  z.number({ error: mensaje }).int(mensaje).positive(mensaje)

export const esquemaCabecera = z.object({
  programaId: requerido('Elige el programa educativo'),
  /** `null` es "Optativa", que el plan de estudios sí contempla. */
  semestre: z.number().int().min(1).max(12).nullable(),
  asignaturaId: requerido('Elige la asignatura'),
  practicaCatalogoId: requerido('Elige la práctica'),
  laboratorioId: requerido('Elige el laboratorio'),
  fecha: z.string().min(1, 'Elige la fecha'),
})

export type Cabecera = z.infer<typeof esquemaCabecera>

// ---------------------------------------------------------------------------
// El payload de registrar_practica
// ---------------------------------------------------------------------------
export type PayloadElemento = {
  existencia_id: number
  peso_inicial?: number | null
  peso_final?: number | null
  cantidad_entregada?: number | null
  cantidad_devuelta?: number | null
  cantidad_danada?: number | null
  estado_salida?: Funcionamiento | null
  estado_devolucion?: Funcionamiento | null
  observaciones: string | null
  motivos: string[]
}

/**
 * Arma el objeto que va a la RPC **recorriendo el método**, no volcando el
 * elemento entero. Ésa es la propiedad que hace que un campo de otro método
 * sencillamente no exista en el envío.
 *
 * No manda `metodo_control`: lo deriva `registrar_practica` de la clasificación
 * del artículo, y es el hueco que la migración vino a cerrar. Tampoco manda
 * `consumo` ni `perdidas`, que son columnas generadas.
 */
export function aPayloadElementos(elementos: ElementoCaptura[]): PayloadElemento[] {
  return elementos.map((el) => {
    const comun = {
      existencia_id: el.existenciaId,
      observaciones: el.observaciones.trim() === '' ? null : el.observaciones.trim(),
      motivos: el.motivos,
    }

    if (el.metodo === 'peso') {
      return { ...comun, peso_inicial: el.pesoInicial, peso_final: el.pesoFinal }
    }

    if (el.metodo === 'cantidad') {
      return {
        ...comun,
        cantidad_entregada: el.cantidadEntregada,
        cantidad_devuelta: el.cantidadDevuelta,
        cantidad_danada: el.cantidadDanada,
      }
    }

    return { ...comun, estado_salida: el.estadoSalida, estado_devolucion: el.estadoDevolucion }
  })
}
