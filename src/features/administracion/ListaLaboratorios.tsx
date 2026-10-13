import { Icon } from '@iconify/react'
import { IconButton, List, ListItem, ListItemText, Stack } from '@mui/material'

import type { Laboratorio } from './consultas'

type Props = {
  laboratorios: Laboratorio[]
  puedeEditar: boolean
  onEditar: (laboratorio: Laboratorio) => void
  onRetirar: (laboratorio: Laboratorio) => void
}

/**
 * Los laboratorios a los que surte el almacén elegido.
 *
 * `ListItem` y no `ListItemButton` como en `ListaProgramas`: de un laboratorio
 * no cuelga nada, así que la fila no se elige y no hace falta frenar la
 * propagación del clic de cada botón.
 */
export function ListaLaboratorios({ laboratorios, puedeEditar, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {laboratorios.map((laboratorio) => (
        <ListItem
          key={laboratorio.id}
          sx={{ pl: 2, pr: 1 }}
          secondaryAction={
            puedeEditar ? (
              <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                <IconButton
                  size="small"
                  aria-label={`Renombrar ${laboratorio.nombre}`}
                  onClick={() => onEditar(laboratorio)}
                >
                  <Icon icon="mdi:pencil-outline" width={16} />
                </IconButton>
                {/* Nunca borrar: existencias y prácticas apuntan aquí. Retirar
                    lo saca del selector de Prácticas, que ya filtra por activo. */}
                <IconButton
                  size="small"
                  aria-label={`${laboratorio.activo ? 'Retirar' : 'Reactivar'} ${laboratorio.nombre}`}
                  onClick={() => onRetirar(laboratorio)}
                >
                  <Icon
                    icon={laboratorio.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                    width={16}
                  />
                </IconButton>
              </Stack>
            ) : null
          }
        >
          <ListItemText
            primary={laboratorio.nombre}
            secondary={laboratorio.activo ? undefined : 'Retirado'}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItem>
      ))}
    </List>
  )
}
