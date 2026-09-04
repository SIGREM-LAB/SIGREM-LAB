import { Icon } from '@iconify/react'
import { IconButton, List, ListItemButton, ListItemText, Stack } from '@mui/material'

import type { Programa } from './consultas'

type Props = {
  programas: Programa[]
  seleccionado: number | null
  onElegir: (programaId: number) => void
  onEditar: (programa: Programa) => void
  onRetirar: (programa: Programa) => void
}

/** La columna 1: la raíz de la cascada. */
export function ListaProgramas({ programas, seleccionado, onElegir, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {programas.map((programa) => (
        <ListItemButton
          key={programa.id}
          selected={programa.id === seleccionado}
          onClick={() => onElegir(programa.id)}
          sx={{ pl: 2, pr: 1 }}
        >
          <ListItemText
            primary={programa.nombre}
            secondary={programa.activo ? undefined : 'Retirado'}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
          <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
            <IconButton
              size="small"
              aria-label={`Renombrar ${programa.nombre}`}
              onClick={(e) => {
                // Sin esto el clic también elige el programa, y la cascada
                // entera se recarga detrás del diálogo.
                e.stopPropagation()
                onEditar(programa)
              }}
            >
              <Icon icon="mdi:pencil-outline" width={16} />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`${programa.activo ? 'Retirar' : 'Reactivar'} ${programa.nombre}`}
              onClick={(e) => {
                e.stopPropagation()
                onRetirar(programa)
              }}
            >
              <Icon
                icon={programa.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                width={16}
              />
            </IconButton>
          </Stack>
        </ListItemButton>
      ))}
    </List>
  )
}
