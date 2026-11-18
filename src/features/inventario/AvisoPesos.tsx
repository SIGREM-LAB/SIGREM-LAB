import { Icon } from '@iconify/react'
import { Stack, Typography } from '@mui/material'

/** Por qué la cantidad no se llenó sola con los pesos del frasco. */
export function AvisoPesos({ texto }: { texto: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'warning.main' }}>
      <Icon icon="mdi:scale-off" width={16} />
      <Typography variant="caption" role="status">
        {texto}
      </Typography>
    </Stack>
  )
}
