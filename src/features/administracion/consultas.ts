import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Enums } from '@/types/database'

export type Almacen = {
  id: number
  clave: string
  nombre: string
  usoPrincipal: string | null
  zonaRiesgo: string | null
  personasExpuestas: number | null
}

/**
 * Traduce los errores de Postgres. Las restricciones y las políticas son la
 * última línea de defensa y funcionan; lo que no puede pasar es que el usuario
 * lea «duplicate key value violates unique constraint».
 *
 * Lo desconocido se deja pasar con su mensaje original a propósito: un «algo
 * salió mal» genérico esconde justo la pista que hace falta para arreglarlo.
 */
export function mensajeDeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'No se pudo completar la operación'
  }

  const { code, message } = error as { code?: string; message?: string }

  if (code === '23505') {
    if (message?.includes('laboratorio_almacen_id_nombre_key')) {
      return 'Ya hay un laboratorio con ese nombre en este almacén'
    }
    if (message?.includes('motivo_observacion_pkey')) {
      return 'Ya existe un motivo con esa clave'
    }
  }

  // Lo devuelven tanto la RLS como un privilegio de columna que falta. Para
  // quien mira la pantalla es lo mismo, y «no tienes permiso» es lo único
  // accionable.
  if (code === '42501') {
    return 'No tienes permiso para cambiar esto. Revisa que sea de tu almacén.'
  }

  if (code === '23503') return 'No se puede borrar: hay registros que lo usan'

  return message ?? 'No se pudo completar la operación'
}

// ---------------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------------
/**
 * Los almacenes con su ficha NOM.
 *
 * Se leen todos: `almacen_lectura` deja que cualquiera con sesión los vea, y
 * quién puede EDITAR cuál lo decide `almacen_ficha_propia`. Que el responsable
 * vea sólo el suyo es decisión de la pantalla, no de la base.
 */
export function useAlmacenes() {
  return useQuery({
    queryKey: ['administracion', 'almacenes'],
    queryFn: async (): Promise<Almacen[]> => {
      const { data, error } = await supabase
        .from('almacen')
        .select('id, clave, nombre, uso_principal, zona_riesgo, personas_expuestas')
        .order('clave')
      if (error) throw error

      return data.map((a) => ({
        id: a.id,
        clave: a.clave,
        nombre: a.nombre,
        usoPrincipal: a.uso_principal,
        zonaRiesgo: a.zona_riesgo,
        personasExpuestas: a.personas_expuestas,
      }))
    },
  })
}

/**
 * `clave` y `activo` no van en el update, y no por olvido: el privilegio de
 * `authenticated` sobre `almacen` está otorgado por columnas
 * (`20260921120600_administracion_almacen.sql`), así que mandarlas devolvería
 * 42501 aunque la fila sí sea suya.
 */
export function useGuardarFichaAlmacen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      id: number
      nombre: string
      usoPrincipal: string | null
      zonaRiesgo: string | null
      personasExpuestas: number | null
    }) => {
      const { error } = await supabase
        .from('almacen')
        .update({
          nombre: v.nombre,
          uso_principal: v.usoPrincipal,
          zona_riesgo: v.zonaRiesgo,
          personas_expuestas: v.personasExpuestas,
        })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['administracion', 'almacenes'] }),
  })
}

// ---------------------------------------------------------------------------
// Laboratorios
// ---------------------------------------------------------------------------
export type Laboratorio = { id: number; nombre: string; activo: boolean }

export function useLaboratoriosDeAlmacen(almacenId: number | null, incluirRetirados: boolean) {
  return useQuery({
    queryKey: ['administracion', 'laboratorios', almacenId, incluirRetirados],
    enabled: almacenId !== null,
    queryFn: async (): Promise<Laboratorio[]> => {
      let consulta = supabase
        .from('laboratorio')
        .select('id, nombre, activo')
        // `-1` y no un salto: sin almacén la consulta devuelve vacío en vez de
        // devolver los de todos, que es el modo de falla seguro.
        .eq('almacen_id', almacenId ?? -1)
        .order('nombre')

      if (!incluirRetirados) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * Las tres mutaciones invalidan lo mismo, y el porqué de las dos últimas claves
 * es lo que se olvida y se siente como un bug: Prácticas e Inventario leen esta
 * tabla por su cuenta, cada uno con su propia clave y su propio `staleTime`.
 *
 * La de Inventario (`useLaboratorios`, consultas.ts:463) cachea **una hora**.
 * Sin invalidarla, alguien da de alta un laboratorio, se va al alta de
 * existencias, no lo encuentra en el select, y no hay ningún error que mirar.
 * Las claves están copiadas de sus archivos, no supuestas: `['laboratorios',
 * almacenId]` no empieza por 'inventario' aunque viva ahí.
 */
function invalidarLaboratorios(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['administracion', 'laboratorios'] }),
    qc.invalidateQueries({ queryKey: ['practicas', 'laboratorios'] }),
    qc.invalidateQueries({ queryKey: ['laboratorios'] }),
  ])
}

export function useCrearLaboratorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { almacenId: number; nombre: string }) => {
      const { error } = await supabase
        .from('laboratorio')
        .insert({ almacen_id: v.almacenId, nombre: v.nombre })
      if (error) throw error
    },
    onSuccess: () => invalidarLaboratorios(qc),
  })
}

export function useRenombrarLaboratorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; nombre: string }) => {
      const { error } = await supabase
        .from('laboratorio')
        .update({ nombre: v.nombre })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => invalidarLaboratorios(qc),
  })
}

/** Nunca `delete`: existencias y prácticas apuntan aquí por `id`. */
export function useRetirarLaboratorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from('laboratorio')
        .update({ activo: v.activo })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => invalidarLaboratorios(qc),
  })
}

// ---------------------------------------------------------------------------
// Motivos de observacion
// ---------------------------------------------------------------------------
// Catálogo de la Unidad, no de un almacén: sigue siendo admin-only
// (`rls.sql:223`). La PK es `clave`, un texto, así que los `.eq()` van sobre
// ella y no sobre un id.
export type Motivo = {
  clave: string
  etiqueta: string
  orden: number
  activo: boolean
  metodos: Enums<'metodo_control'>[]
}

export function useMotivos(incluirRetirados: boolean) {
  return useQuery({
    queryKey: ['administracion', 'motivos', incluirRetirados],
    queryFn: async (): Promise<Motivo[]> => {
      let consulta = supabase
        .from('motivo_observacion')
        .select('clave, etiqueta, orden, activo, metodos')
        .order('orden')

      if (!incluirRetirados) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * Prácticas los lee por su cuenta y los cachea diez minutos
 * (`practicas/consultas.ts:205`): sin esto, un motivo nuevo tarda ese rato en
 * aparecer en el panel y nadie sabe por qué.
 */
function invalidarMotivos(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['administracion', 'motivos'] }),
    qc.invalidateQueries({ queryKey: ['practicas', 'motivos'] }),
  ])
}

export function useCrearMotivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      clave: string
      etiqueta: string
      orden: number
      metodos: Enums<'metodo_control'>[]
    }) => {
      const { error } = await supabase.from('motivo_observacion').insert(v)
      if (error) throw error
    },
    onSuccess: () => invalidarMotivos(qc),
  })
}

/** La clave nunca entra en el update: `practica_observacion` apunta por ella. */
export function useEditarMotivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      clave: string
      etiqueta: string
      orden: number
      metodos: Enums<'metodo_control'>[]
    }) => {
      const { error } = await supabase
        .from('motivo_observacion')
        .update({ etiqueta: v.etiqueta, orden: v.orden, metodos: v.metodos })
        .eq('clave', v.clave)
      if (error) throw error
    },
    onSuccess: () => invalidarMotivos(qc),
  })
}

export function useRetirarMotivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { clave: string; activo: boolean }) => {
      const { error } = await supabase
        .from('motivo_observacion')
        .update({ activo: v.activo })
        .eq('clave', v.clave)
      if (error) throw error
    },
    onSuccess: () => invalidarMotivos(qc),
  })
}
