import type { Enums } from '@/types/database'

/**
 * El menu se parte en dos bloques con rotulo. Con cinco entradas planas todas
 * pesan igual; agrupadas se ve de un vistazo que el trabajo diario esta arriba
 * y lo de administracion abajo.
 */
export type GrupoMenu = 'operacion' | 'administracion'

export const GRUPOS: { id: GrupoMenu; etiqueta: string }[] = [
  { id: 'operacion', etiqueta: 'Operación' },
  { id: 'administracion', etiqueta: 'Administración' },
]

export type ItemMenu = {
  ruta: string
  etiqueta: string
  icono: string
  grupo: GrupoMenu
  /** Qué se hace en esa pantalla. La barra lateral no la usa; el menú sí. */
  descripcion: string
  /**
   * Color de su placa en el menú principal, como token del tema. Vive aquí
   * junto al icono por lo mismo: es la identidad de la sección, y repartida por
   * los componentes acabaría distinta en cada pantalla.
   */
  color: string
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
    {
      ruta: '/',
      etiqueta: 'Menú principal',
      icono: 'mdi:view-dashboard-outline',
      grupo: 'operacion',
      descripcion: 'Cómo está el inventario de un vistazo',
      color: 'institucional.main',
      disponible: true,
    },
    {
      ruta: '/inventario',
      etiqueta: 'Inventario',
      icono: 'mdi:package-variant-closed',
      grupo: 'operacion',
      descripcion: 'Consultar y capturar reactivos, materiales y equipos',
      color: 'institucional.main',
      disponible: true,
    },
    {
      ruta: '/practicas',
      etiqueta: 'Prácticas',
      icono: 'mdi:flask-outline',
      grupo: 'operacion',
      descripcion: 'Registrar el consumo de cada práctica',
      color: 'secondary.main',
      disponible: false,
    },
    {
      ruta: '/reportes',
      etiqueta: 'Reportes',
      icono: 'mdi:chart-box-outline',
      grupo: 'administracion',
      descripcion: 'Formato NOM y consumos por periodo',
      color: 'secondary.light',
      disponible: false,
    },
  ]

  if (rol !== 'admin') return comunes

  return [
    ...comunes,
    {
      ruta: '/inventario-general',
      etiqueta: 'Inventario general',
      icono: 'mdi:shield-check-outline',
      grupo: 'administracion',
      descripcion: 'Los cuatro almacenes, solo administración',
      color: 'grey.600',
      disponible: false,
    },
  ]
}
