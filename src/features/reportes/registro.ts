import type { Columna } from './aExcel'

/**
 * Un reporte es DATOS, no codigo.
 *
 * Agregar el de equipos con fallas o el de reactivos sin hoja de seguridad es
 * una migracion y un objeto en este arreglo: ningun componente nuevo, ninguna
 * pantalla nueva.
 *
 * Es el mismo patron que `formulario(almacen, clasificacion)`, que decide que
 * campos pedir desde la base en vez de con condicionales en React, y el mismo
 * vocabulario de `ItemMenu` en src/app/navegacion.ts, que ya lleva icono y
 * color por la misma razon: la identidad de una seccion repartida entre
 * componentes acaba distinta en cada pantalla.
 */

export type Parametro =
  | { clave: string; etiqueta: string; tipo: 'almacen' }
  | {
      clave: string
      etiqueta: string
      tipo: 'dias'
      opciones: number[]
      porDefecto: number
    }
  | {
      clave: string
      etiqueta: string
      tipo: 'casilla'
      porDefecto: boolean
      ayuda?: string
    }

export type HojaReporte = {
  nombre: string
  rpc: string
  columnas: Columna[]
}

export type Reporte = {
  id: string
  titulo: string
  descripcion: string
  icono: string
  color: string
  parametros: Parametro[]
  hojas: HojaReporte[]
}

/** Lo que falta se resalta; lo que no falta, no. */
const faltaAlgo = (fila: Record<string, unknown>) =>
  Number(fila.faltante) > 0 ? ('alerta' as const) : null

export const REPORTES: Reporte[] = [
  {
    id: 'reposicion',
    titulo: 'Reposición y compras',
    descripcion: 'Qué falta para llegar al mínimo, y cuánto se consumió',
    icono: 'mdi:cart-arrow-down',
    color: 'institucional.main',
    parametros: [
      { clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' },
      {
        clave: 'p_dias',
        etiqueta: 'Periodo de consumo',
        tipo: 'dias',
        opciones: [90, 180, 365],
        porDefecto: 180,
      },
    ],
    hojas: [
      {
        nombre: 'Reposición',
        rpc: 'reporte_reposicion',
        columnas: [
          { clave: 'almacen', titulo: 'Almacén', tipo: 'texto' },
          { clave: 'clasificacion', titulo: 'Clasificación', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'descripcion', titulo: 'Descripción', tipo: 'texto', ancho: 36 },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          // Tres columnas y no una: el faltante sale del vigente, pero el total
          // fisico y lo vencido quedan a la vista para que el numero sea
          // explicable frente a quien pregunte.
          { clave: 'total_fisico', titulo: 'Total físico', tipo: 'numero' },
          { clave: 'vencido', titulo: 'Vencido', tipo: 'numero' },
          { clave: 'vigente', titulo: 'Vigente', tipo: 'numero' },
          { clave: 'minimo', titulo: 'Mínimo', tipo: 'numero' },
          { clave: 'faltante', titulo: 'Faltante', tipo: 'numero', resaltar: faltaAlgo },
          { clave: 'envases', titulo: 'Envases', tipo: 'entero' },
          { clave: 'consumo', titulo: 'Consumo del periodo', tipo: 'numero' },
          { clave: 'ultima_entrada', titulo: 'Última entrada', tipo: 'fecha' },
          { clave: 'ubicaciones', titulo: 'Ubicaciones', tipo: 'texto', ancho: 38 },
        ],
      },
      {
        // La hoja que hace util el reporte el primer dia, cuando la otra sale
        // vacia porque no hay ni un minimo capturado.
        nombre: 'Sin mínimo definido',
        rpc: 'reporte_sin_minimo',
        columnas: [
          { clave: 'almacen', titulo: 'Almacén', tipo: 'texto' },
          { clave: 'clasificacion', titulo: 'Clasificación', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'descripcion', titulo: 'Descripción', tipo: 'texto', ancho: 36 },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          { clave: 'vigente', titulo: 'Vigente', tipo: 'numero' },
          { clave: 'consumo', titulo: 'Consumo del periodo', tipo: 'numero' },
          { clave: 'envases', titulo: 'Envases', tipo: 'entero' },
        ],
      },
    ],
  },

  {
    id: 'caducidades',
    titulo: 'Caducidades',
    descripcion: 'Lo vencido y lo que está por vencer',
    icono: 'mdi:calendar-alert',
    color: 'secondary.main',
    parametros: [
      { clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' },
      {
        clave: 'p_dias',
        etiqueta: 'Horizonte',
        tipo: 'dias',
        opciones: [30, 60, 90, 180],
        porDefecto: 90,
      },
    ],
    hojas: [
      {
        nombre: 'Caducidades',
        rpc: 'reporte_caducidades',
        columnas: [
          { clave: 'almacen', titulo: 'Almacén', tipo: 'texto' },
          { clave: 'codigo', titulo: 'Código', tipo: 'texto' },
          { clave: 'clasificacion', titulo: 'Clasificación', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'marca', titulo: 'Marca', tipo: 'texto' },
          { clave: 'presentacion', titulo: 'Presentación', tipo: 'texto' },
          { clave: 'cantidad', titulo: 'Cantidad', tipo: 'numero' },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          { clave: 'fecha_caducidad', titulo: 'Caduca', tipo: 'fecha' },
          {
            clave: 'dias_restantes',
            titulo: 'Días restantes',
            tipo: 'entero',
            // El gradiente es la informacion: vencido en rojo, lo que vence en
            // quince dias en ambar, y el resto sin resalte. Un corte binario
            // esconderia que algo vence pasado manana.
            resaltar: (f) =>
              Number(f.dias_restantes) < 0
                ? 'alerta'
                : Number(f.dias_restantes) <= 15
                  ? 'aviso'
                  : null,
          },
          { clave: 'ubicacion', titulo: 'Ubicación', tipo: 'texto', ancho: 30 },
          { clave: 'estado', titulo: 'Estado', tipo: 'texto' },
        ],
      },
    ],
  },

  {
    id: 'conteo',
    titulo: 'Hoja de conteo físico',
    descripcion: 'Para recorrer el almacén e ir anotando',
    icono: 'mdi:clipboard-list-outline',
    color: 'secondary.light',
    parametros: [
      { clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' },
      {
        clave: 'p_con_cantidad',
        etiqueta: 'Mostrar la cantidad del sistema',
        tipo: 'casilla',
        porDefecto: false,
        ayuda:
          'Sin ella el conteo es ciego: quien cuenta no puede copiar el número ' +
          'que ya estaba, y la diferencia que salga es real.',
      },
    ],
    hojas: [
      {
        nombre: 'Conteo',
        rpc: 'reporte_conteo',
        columnas: [
          { clave: 'ubicacion', titulo: 'Ubicación', tipo: 'texto', ancho: 30 },
          { clave: 'codigo', titulo: 'Código', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'descripcion', titulo: 'Descripción', tipo: 'texto', ancho: 36 },
          { clave: 'marca', titulo: 'Marca', tipo: 'texto' },
          { clave: 'presentacion', titulo: 'Presentación', tipo: 'texto' },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          { clave: 'cantidad_sistema', titulo: 'Cantidad del sistema', tipo: 'numero' },
          // Las dos en blanco van al final, que es donde cae la mano al
          // apoyar la hoja en el estante.
          { clave: 'conteo', titulo: 'Conteo', tipo: 'texto', vacia: true, ancho: 16 },
          { clave: 'nota', titulo: 'Observaciones', tipo: 'texto', vacia: true, ancho: 34 },
        ],
      },
    ],
  },

  {
    id: 'inventario',
    titulo: 'Inventario en formato unificado',
    descripcion: 'El libro que el personal ya conoce, una hoja por clasificación',
    icono: 'mdi:file-table-outline',
    color: 'grey.600',
    parametros: [{ clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' }],

    // Vacio a proposito. Las hojas y columnas de este reporte salen de
    // `hoja_formato` y `formato_hoja()` en la base, no de aqui: es la decision
    // D9 del spec, por lo que ya razona el comentario de
    // `private.clave_renglon`. Un diccionario de columnas en TypeScript hay que
    // acordarse de actualizarlo, y olvidarlo no rompe la compilacion: manda el
    // valor con la llave equivocada y el campo se pierde en silencio.
    hojas: [],
  },
]

/**
 * Determinista: el mismo reporte del mismo almacen el mismo dia produce el
 * mismo nombre, asi que dos descargas se pisan en vez de acumularse como
 * «reporte (3).xlsx».
 *
 * La fecha se arma a mano y no con `toISOString()`, que convierte a UTC: a las
 * once de la noche en Pachuca eso ya es el dia siguiente, y el archivo diria
 * una fecha que no es la del dia de trabajo.
 */
export function nombreDeArchivo(reporte: Reporte, almacen: string, hoy = new Date()) {
  const fecha = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-')

  return `SIGREM-${almacen}-${reporte.id}-${fecha}.xlsx`
}
