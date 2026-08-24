import { Divider, Stack, Typography } from '@mui/material'

import type { Enums } from '@/types/database'

/**
 * Plano a propósito. La consulta anidada devuelve `articulo` con
 * `articulo_reactivo` colgando, y esa forma no tiene por qué llegar hasta aquí:
 * si el componente la conociera, cambiar el `select` lo rompería. La página
 * aplana una vez y este componente sólo sabe de campos.
 */
export type DatosTipo = {
  cas: string | null
  estadoFisico: Enums<'estado_fisico'> | null
  colorAlmacenaje: Enums<'color_almacenaje'> | null
  tieneHojaSeguridad: boolean | null
  riesgoSalud: number | null
  riesgoInflamabilidad: number | null
  riesgoReactividad: number | null
  numeroSerie: string | null
  numeroInventario: string | null
  funcionamiento: Enums<'funcionamiento_equipo'> | null
  fechaChequeo: string | null
  metodoConservacion: string | null
  temperatura: string | null
  origenEspecie: string | null
}

type Entrada = { etiqueta: string; valor: string }

/** Los enums se guardan en minúsculas; en pantalla van como texto normal. */
function enPalabras(valor: string): string {
  const limpio = valor.replace(/_/g, ' ')
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

function entradasDeReactivo(d: DatosTipo): Entrada[] {
  const e: Entrada[] = []
  if (d.cas !== null) e.push({ etiqueta: 'CAS', valor: d.cas })
  if (d.estadoFisico !== null) e.push({ etiqueta: 'Estado físico', valor: enPalabras(d.estadoFisico) })
  if (d.colorAlmacenaje !== null) {
    e.push({ etiqueta: 'Almacenaje', valor: enPalabras(d.colorAlmacenaje) })
  }
  // Se compara contra null y no por verdadero: el formato pregunta si la TIENES,
  // y callarse ante un `false` dejaría "no la tenemos" indistinguible de
  // "no lo sabemos".
  if (d.tieneHojaSeguridad !== null) {
    e.push({
      etiqueta: 'Hoja de seguridad',
      valor: d.tieneHojaSeguridad ? 'Disponible' : 'Sin hoja de seguridad',
    })
  }
  // Igual con los grados: un 0 es "sin riesgo", que es un dato, no un hueco.
  if (d.riesgoSalud !== null) e.push({ etiqueta: 'NFPA salud', valor: `${d.riesgoSalud} de 4` })
  if (d.riesgoInflamabilidad !== null) {
    e.push({ etiqueta: 'NFPA inflamabilidad', valor: `${d.riesgoInflamabilidad} de 4` })
  }
  if (d.riesgoReactividad !== null) {
    e.push({ etiqueta: 'NFPA reactividad', valor: `${d.riesgoReactividad} de 4` })
  }
  return e
}

function entradasDeEquipo(d: DatosTipo): Entrada[] {
  const e: Entrada[] = []
  if (d.numeroSerie !== null) e.push({ etiqueta: 'N.º de serie', valor: d.numeroSerie })
  if (d.numeroInventario !== null) {
    e.push({ etiqueta: 'Inventario UAEH', valor: d.numeroInventario })
  }
  if (d.funcionamiento !== null) {
    e.push({
      etiqueta: 'Funcionamiento',
      valor: d.funcionamiento === 'correcto' ? 'Correcto' : 'Presenta fallas',
    })
  }
  if (d.fechaChequeo !== null) e.push({ etiqueta: 'Último chequeo', valor: d.fechaChequeo })
  return e
}

function entradasDeBiologico(d: DatosTipo): Entrada[] {
  const e: Entrada[] = []
  if (d.origenEspecie !== null) e.push({ etiqueta: 'Especie', valor: d.origenEspecie })
  if (d.metodoConservacion !== null) {
    e.push({ etiqueta: 'Conservación', valor: d.metodoConservacion })
  }
  if (d.temperatura !== null) e.push({ etiqueta: 'Temperatura', valor: d.temperatura })
  return e
}

const POR_CLASIFICACION: Partial<
  Record<Enums<'clasificacion_articulo'>, { titulo: string; entradas: (d: DatosTipo) => Entrada[] }>
> = {
  reactivo: { titulo: 'Datos del reactivo', entradas: entradasDeReactivo },
  equipo: { titulo: 'Datos del equipo', entradas: entradasDeEquipo },
  materia_biologica: { titulo: 'Datos de la muestra', entradas: entradasDeBiologico },
}

export function DetalleTipo({
  clasificacion,
  datos,
}: {
  clasificacion: Enums<'clasificacion_articulo'> | null
  datos: DatosTipo | null
}) {
  if (datos === null || clasificacion === null) return null

  // material, insumo y componente no tienen campos propios.
  const bloque = POR_CLASIFICACION[clasificacion]
  if (bloque === undefined) return null

  const entradas = bloque.entradas(datos)
  // Un encabezado sobre el vacío es peor que nada: pasa con los reactivos de los
  // que todavía no se capturó ningún dato normativo.
  if (entradas.length === 0) return null

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        {bloque.titulo}
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {entradas.map(({ etiqueta, valor }) => (
          <Stack key={etiqueta} direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', width: 104, flexShrink: 0 }}
            >
              {etiqueta}
            </Typography>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {valor}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </>
  )
}
