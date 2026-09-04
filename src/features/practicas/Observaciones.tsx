import { Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material'

import { motivosDeMetodo, type Motivo } from './consultas'
import type { ElementoCaptura } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  motivos: Motivo[]
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

/**
 * Las casillas del producto elegido. **Qué casillas se ofrecen no está escrito
 * aquí**: sale de `motivo_observacion.metodos`, que es lo que hace que mover
 * «No tenemos» a otro panel sea un `update` y no un redespliegue.
 *
 * Van por producto y no por práctica: «Contaminado» es una propiedad del frasco,
 * y colgadas de la sesión no dirían cuál de los tres productos se contaminó.
 */
export function Observaciones({ elemento, motivos, onCambiar }: Props) {
  const disponibles = motivosDeMetodo(motivos, elemento.metodo)
  const marcados = new Set(elemento.motivos)

  function alternar(clave: string) {
    const siguiente = marcados.has(clave)
      ? elemento.motivos.filter((m) => m !== clave)
      : [...elemento.motivos, clave]
    onCambiar({ motivos: siguiente })
  }

  return (
    <Stack spacing={1}>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        Observaciones
      </Typography>

      <FormGroup>
        {disponibles.map((motivo) => (
          <FormControlLabel
            key={motivo.clave}
            label={motivo.etiqueta}
            control={
              <Checkbox
                checked={marcados.has(motivo.clave)}
                onChange={() => alternar(motivo.clave)}
              />
            }
          />
        ))}
      </FormGroup>

      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Descripción adicional"
        placeholder="Lo que no cabe en una casilla…"
        value={elemento.observaciones}
        onChange={(e) => onCambiar({ observaciones: e.target.value })}
      />
    </Stack>
  )
}
