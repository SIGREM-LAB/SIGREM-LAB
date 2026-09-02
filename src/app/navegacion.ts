import type { Enums } from '@/types/database'

export type ItemMenu = {
  ruta: string
  etiqueta: string
  icono: string
  /**
   * false = la pantalla todavia no existe. Se dibuja apagada en vez de
   * esconderse: el menu completo es lo que se aprobo en el prototipo, y quien
   * lo usa ve a donde va el sistema sin toparse con un enlace roto.
   */
  disponible: boolean
}

/**
 * El menu del prototipo, con las pantallas pendientes marcadas.
 * `rol` llega en `undefined` mientras el perfil todavia se esta cargando.
 */
export function menuDeNavegacion(rol: Enums<'rol_usuario'> | undefined): ItemMenu[] {
  const comunes: ItemMenu[] = [
    { ruta: '/',           etiqueta: 'Menú principal', icono: 'mdi:view-dashboard-outline',  disponible: true },
    { ruta: '/inventario', etiqueta: 'Inventario',     icono: 'mdi:package-variant-closed',  disponible: false },
    { ruta: '/practicas',  etiqueta: 'Prácticas',      icono: 'mdi:flask-outline',           disponible: false },
    { ruta: '/reportes',   etiqueta: 'Reportes',       icono: 'mdi:chart-box-outline',       disponible: false },
  ]

  if (rol !== 'admin') return comunes

  return [
    ...comunes,
    {
      ruta: '/inventario-general',
      etiqueta: 'Inventario general',
      icono: 'mdi:shield-check-outline',
      disponible: true,
    },
    {
      ruta: '/usuarios',
      etiqueta: 'Administración de usuarios',
      icono: 'mdi:account-cog-outline',
      disponible: true,
    },
  ]
}
