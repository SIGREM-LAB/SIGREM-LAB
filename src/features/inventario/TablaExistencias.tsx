import { Icon } from '@iconify/react'
import {
  Box,
  ButtonBase,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'

import { aspectoDeAlmacen } from '@/app/almacenes'
import type { Tables } from '@/types/database'
import { aspectoDeEstado, cortarNombre } from './presentacion'

export type Fila = Tables<'existencia_listado'>

type Props = {
  filas: Fila[]
  total: number
  pagina: number
  porPagina: number
  /** `null` para admin y consulta: no hay almacén propio contra el que contrastar. */
  almacenPropio: number | null
  onPagina: (pagina: number) => void
  onPorPagina: (porPagina: number) => void
  onAbrir: (fila: Fila) => void
}

function PuntoEstado({ estado }: { estado: Fila['estado'] }) {
  const aspecto = aspectoDeEstado(estado)
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: aspecto.color, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {aspecto.etiqueta}
      </Typography>
    </Stack>
  )
}

export function TablaExistencias({
  filas,
  total,
  pagina,
  porPagina,
  almacenPropio,
  onPagina,
  onPorPagina,
  onAbrir,
}: Props) {
  return (
    <>
      {/* El contenedor desplaza en horizontal por su cuenta: a 1024 px, que es
          la resolución de las máquinas del almacén, seis columnas no caben, y
          es preferible que ruede la tabla y no la página entera. */}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table aria-label="Existencias de los almacenes" size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Existencia</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Almacén</TableCell>
              <TableCell>Ubicación</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary' }}>
                    No se encontraron existencias con esos filtros
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {filas.map((f) => {
              const { cabeza, resto } = cortarNombre(f.nombre_canonico ?? '')
              const aspecto = aspectoDeAlmacen(f.almacen_clave)
              const ajeno = almacenPropio !== null && f.almacen_id !== almacenPropio
              const segundaLinea = [f.marca, resto !== '' ? resto : f.descripcion]
                .filter(Boolean)
                .join(' · ')

              return (
                <TableRow key={f.codigo ?? f.id} hover>
                  <TableCell>
                    {/* El control enfocable vive AQUÍ y no en el <tr>: a un <tr>
                        no se llega con Tab, y el prototipo pone ahí el onClick.
                        Sin esto la pantalla no se puede usar sin ratón. */}
                    <ButtonBase
                      onClick={() => onAbrir(f)}
                      aria-label={`Ver detalle de ${f.codigo ?? 'la existencia'}`}
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: 'primary.main',
                        borderRadius: 1,
                        px: 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.codigo}
                    </ButtonBase>
                  </TableCell>

                  <TableCell sx={{ minWidth: 260 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                      title={f.nombre_canonico ?? ''}
                    >
                      {cabeza}
                    </Typography>
                    {segundaLinea !== '' && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {segundaLinea}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {f.cantidad === null ? '—' : `${f.cantidad} ${f.unidad_base ?? ''}`.trim()}
                  </TableCell>

                  <TableCell>
                    <PuntoEstado estado={f.estado} />
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: aspecto.color,
                          color: 'common.white',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {f.almacen_clave}
                      </Box>
                      {ajeno && (
                        // El `title` va en el span y no en el <Icon>: Iconify lo
                        // pintaría como <title> dentro del SVG, y ahí queda a
                        // merced de cómo trate cada lector de pantalla los SVG.
                        <Box
                          component="span"
                          title="De otro almacén: solo consulta"
                          sx={{ display: 'inline-flex', color: 'text.secondary' }}
                        >
                          <Icon icon="mdi:eye-outline" width={16} aria-hidden />
                        </Box>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {f.ubicacion ?? '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={pagina}
        rowsPerPage={porPagina}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_, p) => onPagina(p)}
        onRowsPerPageChange={(e) => onPorPagina(Number(e.target.value))}
        labelRowsPerPage="Por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />
    </>
  )
}
