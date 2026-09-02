import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type Programa = { id: number; nombre: string; activo: boolean }
export type AsignaturaVinculada = {
  asignaturaId: number
  nombre: string
  semestre: number | null
}
export type PracticaCatalogo = {
  id: number
  numero: number
  nombre: string
  activo: boolean
}
export type Asignatura = { id: number; nombre: string }

/**
 * Traduce los errores de Postgres. Las restricciones de la migración son la
 * última línea de defensa y funcionan; lo que no puede pasar es que el usuario
 * lea "duplicate key value violates unique constraint".
 *
 * Lo desconocido se deja pasar con su mensaje original a propósito: un
 * "algo salió mal" genérico esconde justo la pista que hace falta para
 * arreglarlo.
 */
export function mensajeDeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'No se pudo completar la operación'
  }

  const { code, message } = error as { code?: string; message?: string }

  if (code === '23505') {
    if (message?.includes('asignatura_nombre_norm_idx')) {
      return 'Ya existe una asignatura con ese nombre'
    }
    if (message?.includes('practica_catalogo_asignatura_id_numero_key')) {
      return 'Ya hay una práctica con ese número en esta asignatura'
    }
    if (message?.includes('programa_asignatura_pkey')) {
      return 'Esta asignatura ya está en el programa'
    }
  }

  if (code === '23503') return 'No se puede borrar: hay prácticas registradas que lo usan'
  if (code === '23514') return 'El semestre va del 1 al 12'

  return message ?? 'No se pudo completar la operación'
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------
export function useProgramas(incluirRetiradas: boolean) {
  return useQuery({
    queryKey: ['academico', 'programas', incluirRetiradas],
    queryFn: async (): Promise<Programa[]> => {
      let consulta = supabase
        .from('programa_educativo')
        .select('id, nombre, activo')
        .order('nombre')
      if (!incluirRetiradas) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * El semestre sale de la tabla puente y el nombre del join. El orden por
 * semestre lo decide `agruparPorSemestre` y no esta consulta: un
 * `order by semestre` pondría las optativas primero.
 */
export function useAsignaturasDePrograma(programaId: number | null) {
  return useQuery({
    queryKey: ['academico', 'asignaturas-de-programa', programaId],
    enabled: programaId !== null,
    queryFn: async (): Promise<AsignaturaVinculada[]> => {
      const { data, error } = await supabase
        .from('programa_asignatura')
        .select('semestre, asignatura:asignatura_id (id, nombre)')
        .eq('programa_educativo_id', programaId as number)
      if (error) throw error

      return data
        .map((fila) => ({
          asignaturaId: fila.asignatura.id,
          nombre: fila.asignatura.nombre,
          semestre: fila.semestre,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    },
  })
}

export function usePracticas(asignaturaId: number | null, incluirRetiradas: boolean) {
  return useQuery({
    queryKey: ['academico', 'practicas', asignaturaId, incluirRetiradas],
    enabled: asignaturaId !== null,
    queryFn: async (): Promise<PracticaCatalogo[]> => {
      let consulta = supabase
        .from('practica_catalogo')
        .select('id, numero, nombre, activo')
        .eq('asignatura_id', asignaturaId as number)
        .order('numero')
      if (!incluirRetiradas) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * Todas las asignaturas, para el autocompletar de "vincular una que ya existe".
 * El filtrado de "las que este programa aún no tiene" ocurre en el componente:
 * son decenas de filas, PostgREST no expresa bien un NOT IN (subconsulta), y
 * montar una vista sería pagar una migración por un `filter` de JavaScript.
 */
export function useAsignaturas() {
  return useQuery({
    queryKey: ['academico', 'asignaturas'],
    queryFn: async (): Promise<Asignatura[]> => {
      const { data, error } = await supabase
        .from('asignatura')
        .select('id, nombre')
        .order('nombre')
      if (error) throw error
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------
// Cada una invalida sólo lo que ensucia. Invalidar ['academico'] entero
// refrescaría las tres columnas en cada guardado.

export function useCrearPrograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { nombre: string }) => {
      const { error } = await supabase.from('programa_educativo').insert({ nombre: v.nombre })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'programas'] }),
  })
}

export function useRenombrarPrograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; nombre: string }) => {
      const { error } = await supabase
        .from('programa_educativo')
        .update({ nombre: v.nombre })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'programas'] }),
  })
}

export function useRetirarPrograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from('programa_educativo')
        .update({ activo: v.activo })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'programas'] }),
  })
}

/**
 * Por RPC y no por dos inserts: crear la asignatura y vincularla tienen que ser
 * atómicos, y la función además reusa la asignatura que ya exista con ese
 * nombre normalizado en vez de chocar contra el índice único.
 */
export function useVincularAsignatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { programaId: number; nombre: string; semestre: number | null }) => {
      const { error } = await supabase.rpc('vincular_asignatura', {
        p_programa: v.programaId,
        p_nombre: v.nombre,
        // `undefined` y no `null`: el argumento tiene `default null` en la
        // firma, y omitirlo es lo mismo que mandarlo nulo.
        p_semestre: v.semestre ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academico', 'asignaturas-de-programa'] })
      qc.invalidateQueries({ queryKey: ['academico', 'asignaturas'] })
    },
  })
}

export function useCambiarSemestre() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      programaId: number
      asignaturaId: number
      semestre: number | null
    }) => {
      const { error } = await supabase
        .from('programa_asignatura')
        .update({ semestre: v.semestre })
        .eq('programa_educativo_id', v.programaId)
        .eq('asignatura_id', v.asignaturaId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'asignaturas-de-programa'] }),
  })
}

export function useDesvincularAsignatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { programaId: number; asignaturaId: number }) => {
      const { error } = await supabase
        .from('programa_asignatura')
        .delete()
        .eq('programa_educativo_id', v.programaId)
        .eq('asignatura_id', v.asignaturaId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'asignaturas-de-programa'] }),
  })
}

export function useCrearPractica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { asignaturaId: number; numero: number; nombre: string }) => {
      const { error } = await supabase
        .from('practica_catalogo')
        .insert({ asignatura_id: v.asignaturaId, numero: v.numero, nombre: v.nombre })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'practicas'] }),
  })
}

export function useEditarPractica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; numero: number; nombre: string }) => {
      const { error } = await supabase
        .from('practica_catalogo')
        .update({ numero: v.numero, nombre: v.nombre })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'practicas'] }),
  })
}

export function useRetirarPractica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from('practica_catalogo')
        .update({ activo: v.activo })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'practicas'] }),
  })
}
