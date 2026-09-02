import { Icon } from '@iconify/react'
import { IconButton, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'

import type { AsignaturaVinculada } from './consultas'
import { agruparPorSemestre } from './semestres'

type Props = {
  asignaturas: AsignaturaVinculada[]
  seleccionada: number | null
  onElegir: (asignaturaId: number) => void
  onCambiarSemestre: (asignatura: AsignaturaVinculada) => void
  onDesvincular: (asignatura: AsignaturaVinculada) => void
}

/**
 * La columna 2. Agrupada por semestre, con la optativa al final —ese orden lo
 * decide `agruparPorSemestre` y no la consulta, porque un `order by semestre`
 * pone los nulos primero y entonces lo primero que se ve del plan son las
 * optativas—.
 */
export function ListaAsignaturas({
  asignaturas,
  seleccionada,
  onElegir,
  onCambiarSemestre,
  onDesvincular,
}: Props) {
  return (
    <List dense disablePadding>
      {agruparPorSemestre(asignaturas).map((grupo) => (
        <li key={grupo.etiqueta}>
          <Typography
            variant="h3"
            component="h3"
            sx={{
              px: 2,
              pt: 1.5,
              pb: 0.5,
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            {grupo.etiqueta}
          </Typography>

          <List dense disablePadding>
            {grupo.filas.map((asignatura) => (
              <ListItemButton
                key={asignatura.asignaturaId}
                selected={asignatura.asignaturaId === seleccionada}
                onClick={() => onElegir(asignatura.asignaturaId)}
                sx={{ pl: 2, pr: 1 }}
              >
                <ListItemText
                  primary={asignatura.nombre}
                  slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
                />
                <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    aria-label={`Cambiar el semestre de ${asignatura.nombre}`}
                    onClick={(e) => {
                      // Sin esto el clic también elige la asignatura y la
                      // columna 3 se recarga detrás del diálogo.
                      e.stopPropagation()
                      onCambiarSemestre(asignatura)
                    }}
                  >
                    <Icon icon="mdi:calendar-edit-outline" width={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Quitar ${asignatura.nombre} del programa`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDesvincular(asignatura)
                    }}
                  >
                    <Icon icon="mdi:link-variant-off" width={16} />
                  </IconButton>
                </Stack>
              </ListItemButton>
            ))}
          </List>
        </li>
      ))}
    </List>
  )
}
