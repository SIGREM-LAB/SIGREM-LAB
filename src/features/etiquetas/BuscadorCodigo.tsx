import { useState, type FormEvent } from 'react'
import { Icon } from '@iconify/react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from '@mui/material'

import { esCodigo } from './codigo'

type Props = {
  /** A dónde ir con el código ya validado. */
  onBuscar: (codigo: string) => void
}

const MENSAJE = 'Escribe un código como N3-00717'

/**
 * «Buscar código» en la barra lateral: para teclearlo a mano o para escanear con
 * el cursor aquí. En la barra angosta es un icono que abre el mismo campo en un
 * diálogo.
 *
 * Un solo campo de texto: el estado local basta y no amerita react-hook-form.
 */
export function BuscadorCodigo({ onBuscar }: Props) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState(false)
  const [dialogo, setDialogo] = useState(false)

  function buscar(evento: FormEvent) {
    evento.preventDefault()
    if (!esCodigo(texto)) {
      setError(true)
      return
    }
    onBuscar(texto)
    setTexto('')
    setError(false)
    setDialogo(false)
  }

  function campo(enBarra: boolean) {
    return (
      <TextField
        size="small"
        fullWidth
        autoFocus={!enBarra}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setError(false)
        }}
        placeholder="Buscar código"
        error={error}
        helperText={error ? MENSAJE : undefined}
        slotProps={{
          htmlInput: { 'aria-label': 'Buscar código', autoComplete: 'off', spellCheck: false },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Icon icon="mdi:qrcode-scan" width={18} />
              </InputAdornment>
            ),
          },
          formHelperText: enBarra ? { sx: { color: '#fff !important', mx: 0 } } : undefined,
        }}
        sx={
          enBarra
            ? {
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'common.white',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
                  '&.Mui-focused fieldset': { borderColor: 'common.white' },
                },
                '& input::placeholder': { color: 'rgba(255,255,255,0.8)', opacity: 1 },
              }
            : undefined
        }
      />
    )
  }

  return (
    <>
      <Box
        component="form"
        role="search"
        onSubmit={buscar}
        sx={{ display: { xs: 'none', md: 'block' } }}
      >
        {campo(true)}
      </Box>

      <Tooltip title="Buscar código" placement="right">
        <IconButton
          aria-label="Buscar código"
          onClick={() => setDialogo(true)}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'common.white', alignSelf: 'center' }}
        >
          <Icon icon="mdi:qrcode-scan" width={22} />
        </IconButton>
      </Tooltip>

      <Dialog open={dialogo} onClose={() => setDialogo(false)} fullWidth maxWidth="xs">
        <form onSubmit={buscar}>
          <DialogTitle>Buscar código</DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>{campo(false)}</DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">
              Buscar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}
