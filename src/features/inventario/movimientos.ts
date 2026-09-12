import { z } from 'zod'

import type { Enums } from '@/types/database'

/**
 * Los seis tipos que ofrece el diálogo, que NO son los ocho del enum
 * `tipo_movimiento` de la base.
 *
 * Son dos vocabularios distintos a propósito. El enum dice qué le pasó al
 * saldo —lo que necesitan la bitácora y los reportes—; esta lista dice qué
 * fue a hacer la persona, que es otra frase. De ahí las dos asimetrías:
 *
 * - `caducado` no tiene valor propio en el enum y se guarda como `merma`, con
 *   el motivo diciendo que fue por caducidad. La merma ya significa eso:
 *   existencia que se pierde sin haberse usado.
 * - `cambio_lab` NO es un movimiento. Mueve el frasco de sitio, no su
 *   cantidad, y un movimiento de cero lo prohíbe `movimiento_cantidad_no_cero`.
 *   Se guarda como un cambio de `existencia.laboratorio_id`, y por eso no deja
 *   renglón en la bitácora: la bitácora es de cantidades.
 *
 * `carga_inicial` tampoco está: la escribe el alta y solo puede haber una.
 * `prestamo` y `devolucion` sí existen en el enum pero no tienen pantalla
 * todavía; el préstamo entre almacenes se diseña aparte.
 */
export type TipoMovimiento = 'entrada' | 'consumo' | 'ajuste' | 'merma' | 'caducado' | 'cambio_lab'

/**
 * Cómo se lee la cantidad que se teclea.
 *
 * `absoluto` es el ajuste de conteo: no se captura cuánto cambió sino cuánto
 * HAY, y la diferencia con el saldo es lo que entra a la bitácora. Es la
 * diferencia que evita el error clásico de contar 240 y registrar −240.
 */
type Modo = 'suma' | 'resta' | 'absoluto'

type Definicion = {
  etiqueta: string
  /** El tipo del enum con el que se guarda. `null` = no es un movimiento. */
  tipo: Enums<'tipo_movimiento'> | null
  cantidad: { etiqueta: string; modo: Modo } | null
  /**
   * El texto libre que acompaña al movimiento. En pantalla se llama «Motivo» u
   * «Observaciones» según el tipo, pero es el mismo campo y aterriza en el
   * mismo sitio: `movimiento.motivo`. Es obligatorio donde la cifra no se
   * explica sola —nadie discute una entrada, pero una merma sin motivo es un
   * faltante sin explicación—.
   */
  motivo: { etiqueta: string; ayuda: string; obligatorio: boolean } | null
  /** A qué tipos de producto se ofrece. `null` = a todos. */
  clasificaciones: Enums<'clasificacion_articulo'>[] | null
}

export const MOVIMIENTOS: Record<TipoMovimiento, Definicion> = {
  entrada: {
    etiqueta: 'Entrada de inventario',
    tipo: 'entrada',
    cantidad: { etiqueta: 'Cantidad recibida', modo: 'suma' },
    motivo: { etiqueta: 'Observaciones', ayuda: 'Proveedor, lote, etc.', obligatorio: false },
    clasificaciones: null,
  },
  consumo: {
    etiqueta: 'Salida por consumo interno',
    tipo: 'consumo',
    cantidad: { etiqueta: 'Cantidad', modo: 'resta' },
    motivo: { etiqueta: 'Motivo', ayuda: 'Motivo del consumo', obligatorio: true },
    clasificaciones: null,
  },
  ajuste: {
    etiqueta: 'Ajuste de inventario',
    tipo: 'ajuste_conteo',
    cantidad: { etiqueta: 'Existencia física encontrada', modo: 'absoluto' },
    motivo: {
      etiqueta: 'Motivo del ajuste',
      ayuda: 'Error de captura, conteo físico, etc.',
      obligatorio: false,
    },
    clasificaciones: null,
  },
  merma: {
    etiqueta: 'Merma',
    tipo: 'merma',
    cantidad: { etiqueta: 'Cantidad dañada', modo: 'resta' },
    motivo: { etiqueta: 'Motivo', ayuda: 'Derrame, rotura, etc.', obligatorio: true },
    clasificaciones: null,
  },
  caducado: {
    etiqueta: 'Producto caducado',
    // Se guarda como merma. El motivo es lo que distingue una cosa de la otra
    // cuando alguien mire la bitácora dentro de un año.
    tipo: 'merma',
    cantidad: { etiqueta: 'Cantidad caducada', modo: 'resta' },
    motivo: {
      etiqueta: 'Observaciones',
      ayuda: 'Fecha de caducidad, lote, etc.',
      obligatorio: false,
    },
    // Un osciloscopio no caduca. Una muestra biológica sí, aunque el prototipo
    // solo listara reactivos e insumos.
    clasificaciones: ['reactivo', 'insumo', 'materia_biologica'],
  },
  cambio_lab: {
    etiqueta: 'Cambio de laboratorio',
    tipo: null,
    cantidad: null,
    motivo: null,
    clasificaciones: null,
  },
}

/** Lo que el motivo de una merma por caducidad dice en la bitácora. */
export const POR_CADUCIDAD = 'Producto caducado'

/** Los tipos que aplican a este producto, en el orden del selector. */
export function tiposPara(clasificacion: Enums<'clasificacion_articulo'> | null): TipoMovimiento[] {
  const todos = Object.keys(MOVIMIENTOS) as TipoMovimiento[]

  return todos.filter((t) => {
    const permitidas = MOVIMIENTOS[t].clasificaciones
    if (permitidas === null) return true
    // Sin clasificación no se esconde nada: es un dato que falta, no un «no».
    return clasificacion === null || permitidas.includes(clasificacion)
  })
}

export type ValoresMovimiento = {
  tipo: TipoMovimiento
  cantidad: string
  motivo: string
  fecha: string
  /** El id del laboratorio destino, como texto: sale de un `Select`. */
  laboratorio: string
}

type Contexto = {
  saldo: number
  unidad: string
  /** El laboratorio donde está hoy, para no «cambiarlo» al mismo. */
  laboratorioActual: number | null
}

/**
 * Qué se manda a la base. Dos formas porque son dos operaciones distintas, y
 * distinguirlas aquí es lo que evita que el diálogo tenga que saberlo.
 */
export type Registro =
  | {
      clase: 'movimiento'
      tipo: Enums<'tipo_movimiento'>
      /** Con signo, que es como lo guarda la bitácora. */
      cantidad: number
      motivo: string | null
      /** Solo si se eligió un día pasado; `null` deja el `default now()`. */
      ocurridoEn: string | null
    }
  | { clase: 'laboratorio'; laboratorioId: number }

/**
 * De lo capturado a lo que se guarda.
 *
 * Función pura y separada del diálogo: es donde vive la aritmética del signo y
 * la del ajuste, que es lo que de verdad hay que poder probar sin montar una
 * pantalla.
 */
export function registroDe(valores: ValoresMovimiento, ctx: Contexto): Registro {
  const definicion = MOVIMIENTOS[valores.tipo]

  if (definicion.tipo === null) {
    return { clase: 'laboratorio', laboratorioId: Number(valores.laboratorio) }
  }

  const capturada = Number(valores.cantidad)
  const modo = definicion.cantidad?.modo ?? 'suma'

  const cantidad =
    modo === 'suma'
      ? capturada
      : modo === 'resta'
        ? -capturada
        : // El ajuste captura cuánto HAY; a la bitácora va la diferencia.
          redondear(capturada - ctx.saldo)

  return {
    clase: 'movimiento',
    tipo: definicion.tipo,
    cantidad,
    motivo: motivoDe(valores),
    ocurridoEn: fechaDe(valores.fecha),
  }
}

/**
 * `numeric(14,4)` en la base. Sin redondear, restar dos números con decimales
 * en coma flotante deja colas como 0.30000000000000004, y el ajuste de un
 * frasco pesado saldría con cuatro decimales de ruido.
 */
function redondear(n: number): number {
  return Math.round(n * 10000) / 10000
}

function motivoDe(valores: ValoresMovimiento): string | null {
  const escrito = valores.motivo.trim()

  // La caducidad se guarda como merma, así que sin esta marca los dos casos
  // quedarían indistinguibles en la bitácora.
  if (valores.tipo === 'caducado') {
    return escrito === '' ? POR_CADUCIDAD : `${POR_CADUCIDAD}: ${escrito}`
  }

  return escrito === '' ? null : escrito
}

/**
 * La fecha solo viaja si es de un día pasado.
 *
 * `ocurrido_en` tiene `default now()`. Mandar la de hoy la dejaría a las 00:00 y
 * desordenaría los movimientos del mismo día en «Últimos movimientos», que es
 * donde se leen. Registrar el consumo de ayer sí es legítimo, y ese sí se manda.
 */
export function fechaDe(fecha: string): string | null {
  const elegida = fecha.trim()
  if (elegida === '' || elegida === hoy()) return null
  return elegida
}

export function hoy(): string {
  const ahora = new Date()
  // `toISOString` daría el día en UTC, que de noche ya es el siguiente.
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

/**
 * El esquema de la captura. Los mensajes se escriben aquí, no en el JSX.
 *
 * Lo que comprueba de más respecto de un formulario cualquiera son las dos
 * reglas que el esquema de la base también sostiene, pero que llegarían tarde:
 * un movimiento de cero está prohibido por `movimiento_cantidad_no_cero`, y
 * dejar la existencia en negativo lo rechaza `aplicar_movimiento`. Enterarse al
 * pulsar Guardar, con el error de Postgres, es peor que no poder teclearlo.
 */
export function esquemaDeMovimiento(ctx: Contexto): z.ZodType<ValoresMovimiento, ValoresMovimiento> {
  const esquema = z
    .object({
      tipo: z.string(),
      cantidad: z.string(),
      motivo: z.string(),
      fecha: z.string(),
      laboratorio: z.string(),
    })
    .superRefine((valores: Record<string, unknown>, ctx2) => {
      const tipo = String(valores.tipo) as TipoMovimiento
      const definicion = MOVIMIENTOS[tipo]
      const cantidad = String(valores.cantidad ?? '').trim()
      const motivo = String(valores.motivo ?? '').trim()

      if (definicion.motivo?.obligatorio === true && motivo === '') {
        ctx2.addIssue({
          code: 'custom',
          path: ['motivo'],
          message: `${definicion.motivo.etiqueta} es obligatorio`,
        })
      }

      if (definicion.tipo === null) {
        if (String(valores.laboratorio ?? '') === '') {
          ctx2.addIssue({
            code: 'custom',
            path: ['laboratorio'],
            message: 'Elige el laboratorio destino',
          })
        } else if (Number(valores.laboratorio) === ctx.laboratorioActual) {
          ctx2.addIssue({
            code: 'custom',
            path: ['laboratorio'],
            message: 'Es el laboratorio donde ya está',
          })
        }
        return
      }

      if (definicion.cantidad === null) return

      if (cantidad === '' || Number.isNaN(Number(cantidad))) {
        ctx2.addIssue({
          code: 'custom',
          path: ['cantidad'],
          message: `${definicion.cantidad.etiqueta} es obligatorio`,
        })
        return
      }

      const numero = Number(cantidad)

      if (numero < 0) {
        ctx2.addIssue({
          code: 'custom',
          path: ['cantidad'],
          message: 'No puede ser negativa',
        })
        return
      }

      if (definicion.cantidad.modo === 'absoluto') {
        if (numero === ctx.saldo) {
          ctx2.addIssue({
            code: 'custom',
            path: ['cantidad'],
            message: `Es lo mismo que dice el saldo: no hay diferencia que registrar`,
          })
        }
        return
      }

      if (numero === 0) {
        ctx2.addIssue({
          code: 'custom',
          path: ['cantidad'],
          message: 'Tiene que ser mayor que cero',
        })
        return
      }

      if (definicion.cantidad.modo === 'resta' && numero > ctx.saldo) {
        ctx2.addIssue({
          code: 'custom',
          path: ['cantidad'],
          message: `No puedes descontar más de lo que hay: quedan ${ctx.saldo} ${ctx.unidad}`.trim(),
        })
      }
    })

  // El mismo `as` que en `campos.ts`: el objeto se valida en tiempo de
  // ejecución y zod lo infiere como `Record<string, unknown>`.
  return esquema as unknown as z.ZodType<ValoresMovimiento, ValoresMovimiento>
}
