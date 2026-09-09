import { Icon } from '@iconify/react'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { estaCompleto, type ElementoCaptura } from './esquemas'
import { aspectoDeMetodo, ETIQUETA_CLASIFICACION } from './metodos'

type Props = {
  elementos: ElementoCaptura[]
  seleccionado: number | null
  onElegir: (existenciaId: number) => void
  onQuitar: (existenciaId: number) => void
}

export function TablaProductos({ elementos, seleccionado, onElegir, onQuitar }: Props) {
  const completados = elementos.filter(estaCompleto).length

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 2 }}>
        <Typography variant="h2" sx={{ color: 'institucional.main' }}>
          Productos utilizados
        </Typography>
        {elementos.length === 0 ? null : (
          <Typography sx={{ color: 'text.secondary' }}>
            {`(${completados}/${elementos.length} completados)`}
          </Typography>
        )}
      </Stack>

      {elementos.length === 0 ? (
        <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
          <Icon icon="mdi:package-variant-closed" width={40} aria-hidden />
          <Typography sx={{ color: 'text.secondary' }}>Sin productos</Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center' }}>
            Usa «Buscar producto» para agregar lo que se usó en la práctica
          </Typography>
        </Stack>
      ) : (
        // La tabla desborda a lo ancho en 1024 px, que es la resolución de las
        // máquinas del almacén. Con overflow propio, la que se desplaza es ella
        // y no la página entera.
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Método</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Quitar</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {elementos.map((el) => {
                const completo = estaCompleto(el)
                const metodo = aspectoDeMetodo(el.metodo)

                return (
                  <TableRow
                    key={el.existenciaId}
                    hover
                    selected={seleccionado === el.existenciaId}
                    aria-selected={seleccionado === el.existenciaId}
                    onClick={() => onElegir(el.existenciaId)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', color: 'institucional.main' }}>
                      {el.codigo}
                    </TableCell>
                    <TableCell>{el.nombre}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Box sx={{ color: metodo.color, display: 'flex' }}>
                          <Icon icon={metodo.icono} aria-hidden />
                        </Box>
                        <span>{ETIQUETA_CLASIFICACION[el.clasificacion]}</span>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={metodo.etiqueta} />
                    </TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                          alignItems: 'center',
                          color: completo ? 'success.main' : 'warning.main',
                        }}
                      >
                        <Icon
                          icon={completo ? 'mdi:check-circle-outline' : 'mdi:clock-outline'}
                          aria-hidden
                        />
                        <span>{completo ? 'Completado' : 'Pendiente'}</span>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        aria-label={`Quitar ${el.nombre}`}
                        size="small"
                        // stopPropagation: sin esto, quitar también dispara el
                        // onClick de la fila y selecciona lo que acaba de irse.
                        onClick={(evento) => {
                          evento.stopPropagation()
                          onQuitar(el.existenciaId)
                        }}
                      >
                        <Icon icon="mdi:trash-can-outline" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
