import { Icon } from '@iconify/react'
import { Button, Chip, Stack } from '@mui/material'

import { ESTADO } from './presentacion'
import { CLASIFICACIONES, type Filtros } from './filtros'

type Props = {
  filtros: Filtros
  almacenes: { id: number; clave: string }[]
  onCambio: (filtros: Filtros) => void
  /** Si falta, no hay nada que limpiar y el boton no se dibuja. */
  onLimpiar?: () => void
}

/**
 * Lo que esta filtrado, dicho con todas sus letras y con una salida por cada
 * cosa.
 *
 * Los cuatro selectores ya llevan su valor, pero para saber por que la tabla
 * muestra 71 renglones hay que recorrerlos uno por uno. Aqui se lee de corrido
 * y se quita de a una. Para un responsable el primer chip explica ademas por
 * que arranca viendo solo su almacen.
 */
export function FiltrosActivos({ filtros, almacenes, onCambio, onLimpiar }: Props) {
  const quitar = (parche: Partial<Filtros>) => onCambio({ ...filtros, ...parche })

  const chips: { clave: string; etiqueta: string; quitar: () => void }[] = []

  if (filtros.termino !== '') {
    chips.push({
      clave: 'termino',
      etiqueta: `Buscar: ${filtros.termino}`,
      quitar: () => quitar({ termino: '' }),
    })
  }

  if (filtros.clasificacion !== 'todas') {
    const clasificacion = CLASIFICACIONES.find((c) => c.valor === filtros.clasificacion)
    chips.push({
      clave: 'clasificacion',
      etiqueta: `Tipo: ${clasificacion?.etiqueta ?? filtros.clasificacion}`,
      quitar: () => quitar({ clasificacion: 'todas' }),
    })
  }

  if (filtros.almacenId !== 'todos') {
    const almacen = almacenes.find((a) => a.id === filtros.almacenId)
    chips.push({
      clave: 'almacen',
      etiqueta: `Almacén: ${almacen?.clave ?? filtros.almacenId}`,
      quitar: () => quitar({ almacenId: 'todos' }),
    })
  }

  if (filtros.estado !== 'todos') {
    chips.push({
      clave: 'estado',
      etiqueta: `Estado: ${ESTADO[filtros.estado].etiqueta.toLowerCase()}`,
      quitar: () => quitar({ estado: 'todos' }),
    })
  }

  if (filtros.incluirBaja) {
    chips.push({
      clave: 'bajas',
      etiqueta: 'Incluye bajas',
      quitar: () => quitar({ incluirBaja: false }),
    })
  }

  if (chips.length === 0 && onLimpiar === undefined) return null

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
      {chips.map((chip) => (
        <Chip
          key={chip.clave}
          label={chip.etiqueta}
          size="small"
          onDelete={chip.quitar}
          // El chip entero es el objetivo: con foco, Supr lo quita. Sin este
          // nombre, un lector de pantalla solo lee la etiqueta y no dice que
          // se puede quitar.
          aria-label={`Quitar filtro. ${chip.etiqueta}`}
          deleteIcon={<Icon icon="mdi:close" width={16} aria-hidden />}
        />
      ))}

      {onLimpiar === undefined ? null : (
        <Button size="small" color="primary" onClick={onLimpiar} sx={{ minWidth: 0 }}>
          Limpiar filtros
        </Button>
      )}
    </Stack>
  )
}
