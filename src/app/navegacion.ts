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
 *
 * `rol` llega en `undefined` mientras el perfil todavia se esta cargando.
 *
 * `tieneAlmacen` decide cuál de las dos pantallas de inventario aparece.
 * Inventario es UNA bodega —la de quien entra— y solo el responsable tiene
 * una. Inventario general es la Unidad entera, y el responsable ya no la ve:
 * su ámbito es el suyo. Admin y consulta no tienen bodega asignada, así que
 * la general es su inventario.
 */
export function menuDeNavegacion(
  rol: Enums<'rol_usuario'> | undefined,
  tieneAlmacen: boolean,
): ItemMenu[] {
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
    ...(tieneAlmacen
      ? [
          {
            ruta: '/inventario',
            etiqueta: 'Inventario',
            icono: 'mdi:package-variant-closed',
            grupo: 'operacion' as const,
            descripcion: 'Consultar y capturar lo de tu almacén',
            color: 'institucional.main',
            disponible: true,
          },
        ]
      : [
          {
            ruta: '/inventario-general',
            etiqueta: 'Inventario general',
            icono: 'mdi:warehouse',
            grupo: 'operacion' as const,
            descripcion: 'Buscar en los cuatro almacenes de la Unidad',
            color: 'institucional.main',
            disponible: true,
          },
        ]),
    {
      ruta: '/practicas',
      etiqueta: 'Prácticas',
      icono: 'mdi:flask-outline',
      grupo: 'operacion',
      descripcion: 'Registrar el consumo de cada práctica',
      color: 'secondary.main',
      disponible: true,
    },
  ]

  // Reportes no la ve `consulta`, ni nadie mientras el rol esta cargando.
  //
  // Un archivo sale del sistema, se reenvia y sobrevive a la baja del usuario;
  // una pantalla no. Por eso `consulta` sigue viendo el inventario entero y no
  // puede exportarlo, que es una incoherencia aparente y deliberada.
  //
  // Esconder la entrada es comodidad, no seguridad: quien edite el bundle llega
  // a la ruta igual. Lo que de verdad lo impide es que cada funcion de reporte
  // arranque comprobando `private.puede_reportar()`.
  const conReportes: ItemMenu[] =
    rol === undefined || rol === 'consulta'
      ? comunes
      : [
          ...comunes,
          {
            ruta: '/reportes',
            etiqueta: 'Reportes',
            icono: 'mdi:chart-box-outline',
            grupo: 'administracion',
            descripcion: 'Compras, caducidades, conteo y el formato unificado',
            color: 'secondary.light',
            disponible: true,
          },
        ]

  // El responsable tambien entra: administra los laboratorios y la ficha de su
  // almacen. `rol === undefined` queda fuera por los dos lados, que es lo que
  // impide que la entrada parpadee mientras el perfil carga.
  if (rol !== 'admin' && rol !== 'responsable') return conReportes

  return [
    ...conReportes,
    {
      ruta: '/administracion',
      etiqueta: 'Administración',
      icono: 'mdi:cog-outline',
      grupo: 'administracion',
      descripcion: 'Almacenes, laboratorios y catálogos del sistema',
      color: 'grey.600',
      disponible: true,
    },
  ]
}

/**
 * Las secciones del índice de Administración.
 *
 * Viven aquí y no en la pantalla por lo mismo que el menú: son la identidad de
 * cada sección —icono, color, de qué va— y repartidas por los componentes
 * acabarían distintas en cada sitio. El índice las dibuja con el mismo molde de
 * tarjeta que el menú principal.
 *
 * Una entrada de menú y no seis: con los catálogos que faltan —ubicaciones,
 * curación del catálogo, el formulario de alta— la barra lateral llegaría a
 * nueve entradas. Aquí crecen sin volver a tocarla.
 *
 * El responsable ve una sola: los laboratorios y la ficha NOM son dato de su
 * almacén. Los motivos, el plan de estudios y los usuarios son de la Unidad.
 */
export function tarjetasDeAdministracion(rol: Enums<'rol_usuario'> | undefined): ItemMenu[] {
  const almacenes: ItemMenu = {
    ruta: '/administracion/almacenes',
    etiqueta: 'Almacenes y laboratorios',
    icono: 'mdi:warehouse',
    grupo: 'administracion',
    descripcion: 'Los datos del almacén y los laboratorios a los que surte',
    color: 'institucional.main',
    disponible: true,
  }

  if (rol === 'responsable') return [almacenes]
  if (rol !== 'admin') return []

  return [
    almacenes,
    {
      ruta: '/administracion/motivos',
      etiqueta: 'Motivos de observación',
      icono: 'mdi:comment-alert-outline',
      grupo: 'administracion',
      descripcion: 'Por qué se marca una práctica o un producto',
      color: 'secondary.main',
      disponible: true,
    },
    {
      ruta: '/administracion/educativo',
      etiqueta: 'Programa educativo',
      icono: 'mdi:school-outline',
      grupo: 'administracion',
      descripcion: 'Programas, asignaturas y prácticas del plan de estudios',
      color: 'grey.600',
      disponible: true,
    },
    {
      ruta: '/administracion/usuarios',
      etiqueta: 'Usuarios',
      icono: 'mdi:account-cog-outline',
      grupo: 'administracion',
      descripcion: 'Gestionar usuarios, roles y accesos del sistema',
      color: 'grey.600',
      disponible: true,
    },
  ]
}
