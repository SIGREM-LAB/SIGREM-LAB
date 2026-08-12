/**
 * Color e icono de cada almacen, como en el prototipo aprobado.
 *
 * Estos hex no van en el tema a proposito: no son la paleta de la interfaz,
 * son un dato de cada almacen -lo que en una grafica seria la serie-. Viven
 * aqui, en un solo lugar, y no sueltos en los componentes.
 */
const ASPECTO: Record<string, { color: string; icono: string }> = {
  N3:  { color: '#C10230', icono: 'mdi:flask-outline' },
  N4:  { color: '#ED5E17', icono: 'mdi:flask-outline' },
  LUM: { color: '#2563EB', icono: 'mdi:test-tube' },
  LE:  { color: '#7C3AED', icono: 'mdi:chip' },
}

const NEUTRO = { color: '#6F6F6E', icono: 'mdi:warehouse' }

export function aspectoDeAlmacen(clave: string | null | undefined) {
  if (!clave) return NEUTRO
  return ASPECTO[clave] ?? NEUTRO
}
