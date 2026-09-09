import { Icon } from '@iconify/react'
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'

import { aspectoDeAlmacen } from '@/app/almacenes'
import { etiquetaRol, type EstadoUsuario, type Usuario } from './administracion'

/**
 * Las mismas medidas que `TablaExistencias`: alto de renglón clavado y anchos
 * fijos con `<colgroup>` sobre `table-layout: fixed`. Sin esto el renglón mide
 * distinto según lo que traiga el nombre, y las columnas se recolocan al
 * cambiar la lista. Aquí el alto sube a 60 px porque el renglón lleva avatar.
 */
const ALTO_FILA = 60

const COLUMNAS: { etiqueta: string; ancho?: number }[] = [
  { etiqueta: 'Nombre' },
  { etiqueta: 'Correo electrónico', ancho: 232 },
  { etiqueta: 'Rol', ancho: 156 },
  { etiqueta: 'Laboratorio / Área', ancho: 168 },
  { etiqueta: 'Estado', ancho: 124 },
  { etiqueta: 'Acciones', ancho: 132 },
]

/** Los anchos fijos más el mínimo que se le deja al nombre. */
const ANCHO_MINIMO = 232 + 156 + 168 + 124 + 132 + 240

/** La cabecera del resto de las tablas de la app. */
const ESTILO_CABECERA = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  whiteSpace: 'nowrap',
} as const

const ASPECTO_ESTADO: Record<EstadoUsuario, { etiqueta: string; color: 'success' | 'warning' | 'error' }> = {
  activo: { etiqueta: 'Activo', color: 'success' },
  pendiente: { etiqueta: 'Pendiente', color: 'warning' },
  desactivado: { etiqueta: 'Desactivado', color: 'error' },
}

function fechaCreacion(fecha: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(fecha))
}

type Props = {
  usuarios: Usuario[]
  cargando: boolean
  onEditar: (usuario: Usuario) => void
  onContrasena: (usuario: Usuario) => void
}

/** El hueco de la primera carga, con la medida final del renglón. */
function FilasCargando() {
  return (
    <>
      {[0, 1, 2, 3].map((fila) => (
        <TableRow key={fila} sx={{ height: ALTO_FILA }}>
          {COLUMNAS.map((columna) => (
            <TableCell key={columna.etiqueta}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function TablaUsuarios({ usuarios, cargando, onEditar, onContrasena }: Props) {
  return (
    <TableContainer sx={{ overflowX: 'auto', minHeight: 240 }}>
      <Table
        aria-label="Usuarios registrados"
        size="small"
        sx={{ tableLayout: 'fixed', minWidth: ANCHO_MINIMO }}
      >
        <colgroup>
          {COLUMNAS.map((columna) => (
            <col key={columna.etiqueta} style={{ width: columna.ancho }} />
          ))}
        </colgroup>

        <TableHead>
          <TableRow>
            {COLUMNAS.map((columna) => (
              <TableCell key={columna.etiqueta} sx={ESTILO_CABECERA}>
                {columna.etiqueta}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {cargando ? <FilasCargando /> : null}

          {!cargando && usuarios.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNAS.length} sx={{ py: 6, textAlign: 'center' }}>
                <Typography sx={{ color: 'text.secondary' }}>
                  Todavía no hay usuarios registrados
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}

          {cargando
            ? null
            : usuarios.map((usuario) => {
                const aspecto = aspectoDeAlmacen(usuario.almacen?.clave)
                const estado = ASPECTO_ESTADO[usuario.estado]

                return (
                  <TableRow key={usuario.id} hover sx={{ height: ALTO_FILA }}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Avatar
                          sx={{
                            width: 34,
                            height: 34,
                            fontSize: '0.875rem',
                            flexShrink: 0,
                            bgcolor: usuario.rol === 'admin' ? 'institucional.main' : 'grey.600',
                          }}
                        >
                          {usuario.nombre.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }} title={usuario.nombre}>
                            {usuario.nombre}
                          </Typography>
                          <Typography variant="caption" component="p" noWrap sx={{ color: 'text.secondary' }}>
                            Creado {fechaCreacion(usuario.creado_en)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        noWrap
                        title={usuario.correo ?? ''}
                        sx={{ color: 'text.secondary' }}
                      >
                        {usuario.correo ?? 'Sin correo'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={usuario.rol === 'admin' ? 'primary' : 'default'}
                        label={etiquetaRol(usuario.rol)}
                      />
                    </TableCell>

                    <TableCell>
                      {usuario.almacen ? (
                        // El color del almacén va de fondo, igual que en el
                        // inventario: es un dato del almacén, no de la paleta.
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-block',
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            bgcolor: aspecto.color,
                            color: 'common.white',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {usuario.almacen.clave}
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Sin asignar
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip size="small" variant="outlined" color={estado.color} label={estado.etiqueta} />
                    </TableCell>

                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <Tooltip title="Editar usuario">
                          <IconButton
                            aria-label={`Editar a ${usuario.nombre}`}
                            color="secondary"
                            onClick={() => onEditar(usuario)}
                          >
                            <Icon icon="mdi:pencil-outline" width={20} />
                          </IconButton>
                        </Tooltip>

                        {/* Acción propia del renglón y no un botón escondido
                            dentro de "Editar": restablecer una contraseña es lo
                            que más se pide en esta pantalla. */}
                        <Tooltip title="Restablecer contraseña">
                          <IconButton
                            aria-label={`Restablecer la contraseña de ${usuario.nombre}`}
                            color="secondary"
                            onClick={() => onContrasena(usuario)}
                          >
                            <Icon icon="mdi:lock-reset" width={20} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Se habilitará al definir el mecanismo seguro de Auth">
                          {/* El span es obligatorio: un botón deshabilitado no
                              emite eventos y el Tooltip no aparecería. */}
                          <span>
                            <IconButton disabled aria-label={`Desactivar a ${usuario.nombre}`}>
                              <Icon icon="mdi:account-off-outline" width={20} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
