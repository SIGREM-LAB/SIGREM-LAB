import { List, ListItemButton, ListItemText } from '@mui/material'

import type { Almacen } from './consultas'

type Props = {
  almacenes: Almacen[]
  seleccionado: number | null
  onElegir: (almacenId: number) => void
}

/**
 * Si le falta cualquiera de las tres constantes de la NOM.
 *
 * Basta con una: el exportador las reinyecta juntas en cada renglón del formato
 * unificado, así que media ficha sale igual de rota que ninguna.
 */
function fichaIncompleta(almacen: Almacen): boolean {
  return (
    almacen.usoPrincipal === null ||
    almacen.zonaRiesgo === null ||
    almacen.personasExpuestas === null
  )
}

/** La columna izquierda: el sujeto de la pantalla. */
export function ListaAlmacenes({ almacenes, seleccionado, onElegir }: Props) {
  return (
    <List dense disablePadding>
      {almacenes.map((almacen) => (
        <ListItemButton
          key={almacen.id}
          selected={almacen.id === seleccionado}
          onClick={() => onElegir(almacen.id)}
          sx={{ pl: 2, pr: 1 }}
        >
          <ListItemText
            primary={`${almacen.clave} · ${almacen.nombre}`}
            secondary={fichaIncompleta(almacen) ? 'Falta la ficha NOM' : undefined}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItemButton>
      ))}
    </List>
  )
}
