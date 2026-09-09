import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/**
 * Los almacenes que se pueden asignar a un usuario. Vive aquí y no en el
 * componente del campo porque lo piden el alta y la edición, y así comparten
 * la misma entrada de caché en vez de consultar dos veces lo mismo.
 */
export function useAlmacenesActivos() {
  return useQuery({
    queryKey: ['almacenes', 'activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('almacen')
        .select('id, clave, nombre, activo')
        .eq('activo', true)
        .order('clave')
      if (error) throw error
      return data
    },
  })
}
