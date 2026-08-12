import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useSesion } from './contexto'

/**
 * Perfil del usuario de la sesion: nombre, rol y almacen al que pertenece.
 * La RLS ya limita lo que puede leer; aqui solo se pide su propio renglon.
 */
export function usePerfil() {
  const sesion = useSesion()
  const usuarioId = sesion.estado === 'con-sesion' ? sesion.usuarioId : null

  return useQuery({
    queryKey: ['perfil', usuarioId],
    enabled: usuarioId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfil')
        .select('id, nombre, rol, almacen:almacen_id (id, clave, nombre)')
        .eq('id', usuarioId as string)
        .single()
      if (error) throw error
      return data
    },
  })
}
