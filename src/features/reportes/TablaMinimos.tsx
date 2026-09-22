import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'

import { ETIQUETA_CLASIFICACION } from '@/features/practicas/metodos'
import type { ArticuloConMinimo } from './consultas'

/**
 * Una fila por articulo, con el minimo editable.
 *
 * Recibe las filas y un `onGuardar` por props, sin tocar la red: asi se prueba
 * entera sin montar un QueryClient ni fingir una respuesta de supabase.
 */
export function TablaMinimos({
  articulos,
  onGuardar,
}: {
  articulos: ArticuloConMinimo[]
  onGuardar: (v: { articuloId: number; minimo: number | null }) => void
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Artículo</TableCell>
          <TableCell>Clasificación</TableCell>
          <TableCell align="right" sx={{ width: 200 }}>
            Mínimo
          </TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {articulos.map((a) => (
          <TableRow key={a.articulo_id} hover>
            <TableCell>{a.nombre}</TableCell>

            <TableCell>
              <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                {ETIQUETA_CLASIFICACION[
                  a.clasificacion as keyof typeof ETIQUETA_CLASIFICACION
                ] ?? a.clasificacion}
              </Typography>
            </TableCell>

            <TableCell align="right">
              <TextField
                type="number"
                size="small"
                // `defaultValue` y no `value`: el campo es suyo mientras se
                // teclea, y el estado vive en el DOM hasta que el foco sale.
                // Con `value` haria falta un estado por fila y un render del
                // listado entero -cientos de renglones- en cada pulsacion.
                defaultValue={a.minimo ?? ''}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: 'any',
                    'aria-label': `Mínimo de ${a.nombre}`,
                  },
                }}
                sx={{ width: 140 }}
                onBlur={(e) => {
                  const texto = e.target.value.trim()

                  // Vacio BORRA el minimo. Nunca cero: la restriccion
                  // `minimo_articulo_positivo` lo rechaza, y «no repongo esto»
                  // se dice quitando el renglon, no poniendolo en cero.
                  const nuevo = texto === '' ? null : Number(texto)

                  if (nuevo !== null && !Number.isFinite(nuevo)) return

                  // Guardar sin cambio seria una escritura por cada vez que
                  // alguien pasa por encima con el tabulador.
                  if (nuevo === a.minimo) return

                  onGuardar({ articuloId: a.articulo_id, minimo: nuevo })
                }}
              />

              {/* La unidad sale del articulo, que es donde vive: un minimo de
                  «500» no se puede interpretar sin saber si son mL o g. */}
              <Typography
                component="span"
                sx={{ color: 'text.secondary', fontSize: 13, ml: 1 }}
              >
                {a.unidad}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
