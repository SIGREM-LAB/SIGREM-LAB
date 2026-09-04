import type { Enums } from '@/types/database'

export type Metodo = Enums<'metodo_control'>
export type Clasificacion = Enums<'clasificacion_articulo'>

type AspectoMetodo = {
  /** Lo que dice el chip de la tabla: una palabra. */
  etiqueta: string
  /** El encabezado del Panel de Control. */
  titulo: string
  icono: string
  /** Token del tema, nunca un hex: un hex suelto no responde al modo oscuro. */
  color: string
}

/**
 * Cómo se ve cada método de control. Vive aquí y no repartido por los
 * componentes porque si no, la tabla dice "Peso" y el panel dice otra cosa con
 * otro icono, y eso no lo atrapa ninguna prueba de tipos.
 *
 * Qué método le toca a cada existencia NO se decide aquí: lo decide
 * `metodo_de_control()` en la base y llega en la fila de `existencia_listado`.
 * Repetir ese mapa en TypeScript es justo lo que la migración vino a evitar.
 */
export const ASPECTO_METODO: Record<Metodo, AspectoMetodo> = {
  peso: {
    etiqueta: 'Peso',
    titulo: 'Control por Peso',
    icono: 'mdi:scale-balance',
    color: 'institucional.main',
  },
  cantidad: {
    etiqueta: 'Cantidad',
    titulo: 'Control por Cantidad',
    icono: 'mdi:package-variant-closed',
    color: 'secondary.main',
  },
  prestamo: {
    etiqueta: 'Préstamo',
    titulo: 'Control por Préstamo',
    icono: 'mdi:microscope',
    // `info` no lo declara `src/tema.ts`, pero MUI lo rellena por esquema de
    // color, así que responde al modo oscuro igual que los declarados. Se usa
    // por eso: los otros dos tokens de la paleta propia son guinda y naranja, y
    // un tercer método en guinda claro no se distingue del primero.
    color: 'info.main',
  },
}

const NEUTRO: AspectoMetodo = {
  etiqueta: 'Sin método',
  titulo: 'Sin método de control',
  icono: 'mdi:help-circle-outline',
  color: 'text.disabled',
}

/**
 * `metodo_control` sale anulable de los tipos generados: Supabase marca así
 * todas las columnas de una vista, aunque la expresión que la produce no pueda
 * devolver nulo. En vez de un `!` en cada uso, el nulo tiene su aspecto.
 */
export function aspectoDeMetodo(metodo: Metodo | null | undefined): AspectoMetodo {
  if (metodo === null || metodo === undefined) return NEUTRO
  return ASPECTO_METODO[metodo] ?? NEUTRO
}

/** Las seis hojas del formato unificado, como las lee una persona. */
export const ETIQUETA_CLASIFICACION: Record<Clasificacion, string> = {
  reactivo: 'Reactivo',
  material: 'Material',
  insumo: 'Insumo',
  equipo: 'Equipo',
  componente: 'Componente',
  materia_biologica: 'Materia biológica',
}
