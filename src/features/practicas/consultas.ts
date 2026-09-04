import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usePerfil } from '@/features/auth/usePerfil'
import { normalizarTermino } from '@/features/inventario/presentacion'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import type { ContenidoBorrador } from './borrador'
import { esFilaUtilizable, type Cabecera, type FilaUtilizable, type PayloadElemento } from './esquemas'
import type { Metodo } from './metodos'

// ---------------------------------------------------------------------------
// Los errores, en español
// ---------------------------------------------------------------------------
/**
 * Las restricciones de la migración son la última línea de defensa y funcionan;
 * lo que no puede pasar es que alguien lea
 * `violates check constraint "practica_elemento_peso_coherente"`.
 *
 * Lo desconocido se deja pasar con su mensaje original: un "algo salió mal"
 * genérico esconde justo la pista que hace falta para arreglarlo.
 */
export function mensajeDeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'No se pudo completar la operación'
  }

  const { code, message } = error as { code?: string; message?: string }

  if (code === '42501') {
    return 'No puedes registrar prácticas en este almacén. Revisa el laboratorio elegido.'
  }

  if (code === '23514') {
    if (message?.includes('practica_elemento_peso_coherente')) {
      return 'El peso final no puede ser mayor que el inicial'
    }
    if (message?.includes('practica_elemento_devolucion_coherente')) {
      return 'Lo devuelto y lo dañado no pueden sumar más de lo entregado'
    }
    if (message?.includes('practica_elemento_campos_por_metodo')) {
      return 'Un producto quedó con campos que no corresponden a su método de control'
    }
  }

  if (code === '23503') {
    if (message?.includes('practica_catalogo_coincide')) {
      return 'La práctica elegida no es de esa asignatura'
    }
    if (message?.includes('practica_pareja_valida')) {
      return 'Esa asignatura no pertenece al programa elegido'
    }
  }

  if (message === 'Una practica necesita al menos un producto') {
    return 'Agrega al menos un producto antes de finalizar'
  }

  return message ?? 'No se pudo completar la operación'
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
export type Programa = { id: number; nombre: string }
export type Asignatura = { id: number; nombre: string }
export type PracticaCatalogo = { id: number; numero: number; nombre: string }
export type Laboratorio = { id: number; nombre: string; almacenClave: string }
export type Motivo = { clave: string; etiqueta: string; metodos: Metodo[] }

export function useProgramas() {
  return useQuery({
    queryKey: ['practicas', 'programas'],
    queryFn: async (): Promise<Programa[]> => {
      const { data, error } = await supabase
        .from('programa_educativo')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data
    },
  })
}

/**
 * Los semestres que ese programa realmente usa, no del 1 al 12.
 *
 * `null` es "Optativa" —lo que el spec del 1 de septiembre decidió que
 * significa un semestre nulo— y va al final: un `order by semestre` ingenuo
 * pone los nulos primero, y entonces lo primero que se ve del plan de estudios
 * son las optativas.
 */
export function useSemestresDePrograma(programaId: number | null) {
  return useQuery({
    queryKey: ['practicas', 'semestres', programaId],
    enabled: programaId !== null,
    queryFn: async (): Promise<(number | null)[]> => {
      const { data, error } = await supabase
        .from('programa_asignatura')
        .select('semestre')
        .eq('programa_educativo_id', programaId as number)
      if (error) throw error

      const distintos = [...new Set(data.map((f) => f.semestre))]
      return distintos.sort(
        (a, b) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER),
      )
    },
  })
}

/**
 * `.is('semestre', null)` y no `.eq(...)`: en SQL nada es igual a NULL, así que
 * un `eq` con nulo devuelve cero filas y las optativas desaparecerían.
 */
export function useAsignaturasDeSemestre(programaId: number | null, semestre: number | null) {
  const activo = programaId !== null
  return useQuery({
    queryKey: ['practicas', 'asignaturas', programaId, semestre],
    enabled: activo,
    queryFn: async (): Promise<Asignatura[]> => {
      let consulta = supabase
        .from('programa_asignatura')
        .select('asignatura:asignatura_id (id, nombre)')
        .eq('programa_educativo_id', programaId as number)

      consulta =
        semestre === null ? consulta.is('semestre', null) : consulta.eq('semestre', semestre)

      const { data, error } = await consulta
      if (error) throw error

      return data
        .map((f) => ({ id: f.asignatura.id, nombre: f.asignatura.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    },
  })
}

export function usePracticasDeAsignatura(asignaturaId: number | null) {
  return useQuery({
    queryKey: ['practicas', 'catalogo', asignaturaId],
    enabled: asignaturaId !== null,
    queryFn: async (): Promise<PracticaCatalogo[]> => {
      const { data, error } = await supabase
        .from('practica_catalogo')
        .select('id, numero, nombre')
        .eq('asignatura_id', asignaturaId as number)
        .eq('activo', true)
        .order('numero')
      if (error) throw error
      return data
    },
  })
}

/**
 * Los laboratorios donde esta persona puede registrar.
 *
 * Filtrados al almacén del perfil, y no por gusto: `practica_escritura` rechaza
 * insertar en un laboratorio de otro almacén, y el `almacen_id` de la práctica
 * sale justo de aquí. Ofrecer los cuatro es ofrecer un error para el final. El
 * admin sí los ve todos, porque para él la política es cierta.
 */
export function useLaboratorios() {
  const { data: perfil } = usePerfil()
  const almacenId = perfil?.almacen?.id ?? null
  const esAdmin = perfil?.rol === 'admin'

  return useQuery({
    queryKey: ['practicas', 'laboratorios', esAdmin ? 'todos' : almacenId],
    enabled: perfil !== undefined,
    queryFn: async (): Promise<Laboratorio[]> => {
      let consulta = supabase
        .from('laboratorio')
        .select('id, nombre, almacen:almacen_id (clave)')
        .eq('activo', true)
        .order('nombre')

      if (!esAdmin) {
        // Sin almacén no hay dónde registrar. `-1` devuelve vacío en vez de
        // devolver los cuatro, que es el modo de falla seguro.
        consulta = consulta.eq('almacen_id', almacenId ?? -1)
      }

      const { data, error } = await consulta
      if (error) throw error
      return data.map((l) => ({ id: l.id, nombre: l.nombre, almacenClave: l.almacen.clave }))
    },
  })
}

/**
 * Los nueve motivos con su columna `metodos`. Se piden una vez y se filtran en
 * memoria: son nueve filas que cambian una vez al año, y una consulta por panel
 * sería un viaje por cada clic en la tabla.
 */
export function useMotivos() {
  return useQuery({
    queryKey: ['practicas', 'motivos'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Motivo[]> => {
      const { data, error } = await supabase
        .from('motivo_observacion')
        .select('clave, etiqueta, metodos')
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return data.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, metodos: m.metodos }))
    },
  })
}

/**
 * Qué casillas se ofrecen en un panel. La lista NO está escrita aquí: viene de
 * `motivo_observacion.metodos`, para que mover "No tenemos" a otro método sea un
 * `update` y no un redespliegue.
 */
export function motivosDeMetodo(motivos: Motivo[], metodo: Metodo): Motivo[] {
  return motivos.filter((m) => m.metodos.includes(metodo))
}

// ---------------------------------------------------------------------------
// Búsqueda de productos
// ---------------------------------------------------------------------------
/**
 * Filtrada al almacén de quien busca, por lo mismo que `useLaboratorios`:
 * `practica_elemento_escritura` rechaza una existencia de otro almacén. Dejar
 * buscar en los cuatro significa capturar los pesos de un producto de N4 y
 * comerse un 42501 al final de todo el trabajo.
 *
 * Lo dado de baja no se ofrece: no se puede consumir de un frasco dado de baja.
 */
export function useBuscarExistencias(termino: string) {
  const { data: perfil } = usePerfil()
  const almacenId = perfil?.almacen?.id ?? null
  const esAdmin = perfil?.rol === 'admin'
  const normalizado = normalizarTermino(termino)

  return useQuery({
    queryKey: ['practicas', 'existencias', normalizado, esAdmin ? 'todos' : almacenId],
    enabled: perfil !== undefined,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<FilaUtilizable[]> => {
      let consulta = supabase
        .from('existencia_listado')
        .select(
          'id, codigo, nombre_canonico, clasificacion, unidad_base, almacen_clave, cantidad, ubicacion, metodo_control',
        )
        .neq('estado', 'baja')
        .order('codigo')
        .limit(40)

      if (!esAdmin) consulta = consulta.eq('almacen_id', almacenId ?? -1)

      if (normalizado !== '') {
        // `nombre_norm` y `marca_norm` ya vienen en minúsculas y sin acentos, así
        // que va `like` y no `ilike`: es lo que deja al predicado usar el índice
        // trigram. `codigo` no está normalizado, y ahí sí `ilike`.
        consulta = consulta.or(
          `nombre_norm.like.*${normalizado}*,marca_norm.like.*${normalizado}*,codigo.ilike.*${normalizado}*`,
        )
      }

      const { data, error } = await consulta
      if (error) throw error

      // El estrechamiento vive aquí, en la frontera de datos, y no en cada
      // componente: Supabase marca anulable hasta la llave primaria de una
      // vista, y una fila sin id no se puede registrar. Descartarla aquí es lo
      // que evita un `!` o un `?? 0` repartido por toda la pantalla.
      return data.filter(esFilaUtilizable)
    },
  })
}

// ---------------------------------------------------------------------------
// El borrador
// ---------------------------------------------------------------------------
// La RLS ya limita cada borrador a su dueño: no hace falta filtrar por usuario.
// `maybeSingle` y no `single` porque no tener borrador es lo normal, no un error.

export function useBorrador() {
  return useQuery({
    queryKey: ['practicas', 'borrador'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practica_borrador')
        .select('contenido, actualizado_en')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useGuardarBorrador() {
  const qc = useQueryClient()
  const { data: perfil } = usePerfil()

  return useMutation({
    mutationFn: async (contenido: ContenidoBorrador) => {
      if (perfil === undefined) throw new Error('Todavía no se conoce tu perfil')

      // `usuario_id` viaja porque es la llave del upsert, pero no es lo que
      // decide de quién es el borrador: el trigger lo reescribe con auth.uid().
      //
      // La conversión a `Json` es de una sola dirección y a propósito:
      // `contenido` es `jsonb` opaco para la base, y ensanchar
      // `ContenidoBorrador` para que encaje estructuralmente en `Json`
      // ensuciaría el tipo que usa toda la pantalla por complacer una firma.
      const { error } = await supabase
        .from('practica_borrador')
        .upsert(
          { usuario_id: perfil.id, contenido: contenido as unknown as Json },
          { onConflict: 'usuario_id' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practicas', 'borrador'] }),
  })
}

export function useBorrarBorrador() {
  const qc = useQueryClient()
  const { data: perfil } = usePerfil()

  return useMutation({
    mutationFn: async () => {
      if (perfil === undefined) return
      const { error } = await supabase
        .from('practica_borrador')
        .delete()
        .eq('usuario_id', perfil.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practicas', 'borrador'] }),
  })
}

// ---------------------------------------------------------------------------
// Finalizar
// ---------------------------------------------------------------------------
/**
 * Una sola llamada, una sola transacción. Devuelve el folio (`PRA-0001`), que es
 * lo único que la pantalla no podía saber antes de guardar.
 *
 * Invalida el inventario porque los triggers acaban de mover saldos: si no, la
 * pantalla de Inventario sigue mostrando lo de antes.
 */
export function useRegistrarPractica() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: { cabecera: Cabecera; elementos: PayloadElemento[] }) => {
      const { data, error } = await supabase.rpc('registrar_practica', {
        p_programa: v.cabecera.programaId,
        p_laboratorio: v.cabecera.laboratorioId,
        p_asignatura: v.cabecera.asignaturaId,
        p_practica_catalogo: v.cabecera.practicaCatalogoId,
        p_fecha: v.cabecera.fecha,
        p_elementos: v.elementos as unknown as Json,
        // `p_observaciones` se omite: la descripción adicional es de cada
        // producto (D1 del spec), y la práctica entera no tiene texto libre en
        // esta pantalla. Tiene default en la base, así que sale opcional aquí.
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['existencias'] })
      qc.invalidateQueries({ queryKey: ['resumen-estados'] })
      qc.invalidateQueries({ queryKey: ['practicas', 'existencias'] })
    },
  })
}
