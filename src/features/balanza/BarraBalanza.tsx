import { Icon } from '@iconify/react'
import { Alert, Button, Chip, Stack, Typography } from '@mui/material'
import { useState } from 'react'

import { ErrorBalanza } from './balanza'
import { useBalanza } from './contextoBalanza'
import { DialogoPrepararBalanza } from './DialogoPrepararBalanza'

/**
 * El estado de la balanza: conectar, ver la lectura en vivo, soltar.
 *
 * Se usa donde hay espacio para mirarla —el panel de prácticas—. Un campo
 * suelto, en cambio, lleva `BotonBalanza`, que conecta solo y no ocupa una fila
 * entera.
 */
export function BarraBalanza() {
  const { estado, soportado, lectura, error, fallo, conectar, desconectar } = useBalanza()
  const [preparando, setPreparando] = useState(false)

  /**
   * El contexto ya deja puestos el estado y el mensaje para toda la pantalla.
   * Aqui solo se decide una cosa mas: si ademas hay que abrir la guia.
   */
  async function intentar(sinFiltro?: boolean) {
    try {
      await conectar(sinFiltro)
      setPreparando(false)
    } catch (e) {
      if (e instanceof ErrorBalanza && e.caso === 'sin-puerto') setPreparando(true)
    }
  }

  if (!soportado) {
    return (
      <Alert severity="info" icon={<Icon icon="mdi:scale-balance" />}>
        Este navegador no puede leer la balanza. Hace falta Chrome o Edge de escritorio.
      </Alert>
    )
  }

  if (estado === 'conectada') {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          size="small"
          color={lectura?.estable === true ? 'success' : 'default'}
          icon={<Icon icon="mdi:scale-balance" />}
          label={lectura === null ? 'Sin lectura' : `${lectura.valor} ${lectura.unidad}`}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {lectura?.estable === true ? 'Peso estable' : 'Estabilizando…'}
        </Typography>
        <Button size="small" variant="text" color="secondary" onClick={() => void desconectar()}>
          Desconectar
        </Button>
      </Stack>
    )
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        startIcon={<Icon icon="mdi:scale-balance" />}
        onClick={() => void intentar()}
        disabled={estado === 'conectando'}
      >
        {estado === 'conectando' ? 'Conectando…' : 'Conectar balanza'}
      </Button>

      {error !== null ? (
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          {error}
        </Typography>
      ) : null}

      {/* La guía se abre sola al fallar, pero el diálogo se puede cerrar y la
          duda sigue ahí. Este botón la recupera sin tener que fallar otra vez. */}
      {fallo === 'sin-puerto' ? (
        <Button size="small" variant="text" onClick={() => setPreparando(true)}>
          ¿Qué hago?
        </Button>
      ) : null}

      <DialogoPrepararBalanza
        abierto={preparando}
        onCerrar={() => setPreparando(false)}
        onReintentar={intentar}
      />
    </Stack>
  )
}
