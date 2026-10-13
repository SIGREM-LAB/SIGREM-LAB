import { Icon } from '@iconify/react'
import { IconButton, List, ListItem, ListItemText, Stack } from '@mui/material'

import { ASPECTO_METODO } from '@/features/practicas/metodos'
import type { Motivo } from './consultas'

type Props = {
  motivos: Motivo[]
  onEditar: (motivo: Motivo) => void
  onRetirar: (motivo: Motivo) => void
}

/**
 * No lleva `puedeEditar` como la de laboratorios: a esta pantalla sólo entra el
 * admin —la ruta va bajo SoloAdmin y la política es admin-only—, así que un
 * estado de sólo lectura sería un caso que no existe.
 */
export function ListaMotivos({ motivos, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {motivos.map((motivo) => (
        <ListItem
          key={motivo.clave}
          sx={{ pl: 2, pr: 10 }}
          secondaryAction={
            <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
              <IconButton
                size="small"
                aria-label={`Editar ${motivo.etiqueta}`}
                onClick={() => onEditar(motivo)}
              >
                <Icon icon="mdi:pencil-outline" width={16} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`${motivo.activo ? 'Retirar' : 'Reactivar'} ${motivo.etiqueta}`}
                onClick={() => onRetirar(motivo)}
              >
                <Icon
                  icon={motivo.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                  width={16}
                />
              </IconButton>
            </Stack>
          }
        >
          <ListItemText
            primary={motivo.etiqueta}
            secondary={
              motivo.activo
                ? `${motivo.clave} · ${motivo.metodos.map((m) => ASPECTO_METODO[m].etiqueta).join(', ')}`
                : 'Retirado'
            }
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItem>
      ))}
    </List>
  )
}
