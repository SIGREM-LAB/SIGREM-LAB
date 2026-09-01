import { Icon } from '@iconify/react'
import { IconButton, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'

import type { PracticaCatalogo } from './consultas'

type Props = {
  practicas: PracticaCatalogo[]
  /** La que se está editando ahora mismo. Se resalta mientras el diálogo está abierto. */
  seleccionada: number | null
  onEditar: (practica: PracticaCatalogo) => void
  onRetirar: (practica: PracticaCatalogo) => void
}

/**
 * La columna 3. `ListItem` y no `ListItemButton`: aquí no hay cuarto nivel al
 * que bajar, así que una fila que se ilumina al pasar el ratón prometería una
 * navegación que no existe.
 */
export function ListaPracticas({ practicas, seleccionada, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {practicas.map((practica) => (
        <ListItem
          key={practica.id}
          sx={{
            pl: 2,
            pr: 1,
            opacity: practica.activo ? 1 : 0.55,
            bgcolor: practica.id === seleccionada ? 'action.selected' : undefined,
          }}
          secondaryAction={
            <Stack direction="row" spacing={0.25}>
              <IconButton
                size="small"
                aria-label={`Editar la práctica ${practica.numero}`}
                onClick={() => onEditar(practica)}
              >
                <Icon icon="mdi:pencil-outline" width={16} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`${practica.activo ? 'Retirar' : 'Reactivar'} la práctica ${practica.numero}`}
                onClick={() => onRetirar(practica)}
              >
                <Icon
                  icon={practica.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                  width={16}
                />
              </IconButton>
            </Stack>
          }
        >
          {/* tabular-nums para que los números no bailen de ancho al pasar de
              9 a 10, que es donde una lista numerada se ve descuadrada. */}
          <Typography
            sx={{
              width: 26,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
              color: 'text.secondary',
              fontSize: '0.8rem',
            }}
          >
            {practica.numero}
          </Typography>
          <ListItemText
            primary={practica.nombre}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItem>
      ))}
    </List>
  )
}
