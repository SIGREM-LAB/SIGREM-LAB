import { Icon } from '@iconify/react'
import { Button, Tooltip } from '@mui/material'

type Props = {
  etiqueta: string
  icono: string
  variante: 'contained' | 'outlined'
}

/**
 * Un botón de una pantalla que todavía no existe.
 * Se dibuja apagado y con su motivo, igual que las entradas del menú: quien usa
 * el sistema ve a dónde va sin toparse con un botón que no hace nada. Y un
 * botón deshabilitado no se puede pulsar por accidente ni con teclado.
 */
export function AccionPendiente({ etiqueta, icono, variante }: Props) {
  return (
    // Tooltip necesita un elemento que reciba eventos; un boton deshabilitado
    // no los emite, de ahi el span.
    <Tooltip title={`${etiqueta}: se entrega en un hito posterior`}>
      <span>
        <Button disabled variant={variante} startIcon={<Icon icon={icono} width={18} />}>
          {etiqueta}
        </Button>
      </span>
    </Tooltip>
  )
}
