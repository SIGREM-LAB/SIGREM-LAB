import { Icon } from '@iconify/react'
import { Alert, IconButton, Snackbar, Tooltip } from '@mui/material'
import { useState } from 'react'

import { useBalanza } from './contextoBalanza'

type Props = {
  /** La unidad que espera el campo. Vacía o `null` = no se valida. */
  unidad?: string | null
  /** Recibe el peso ya leído, en la unidad que manda la balanza. */
  onPeso: (valor: number) => void
  deshabilitado?: boolean
}

/**
 * El botón de balanza de un campo suelto.
 *
 * Conecta solo la primera vez —el clic es el gesto que el navegador exige para
 * pedir el puerto— y después toma el peso. Si la unidad no coincide con la del
 * campo no escribe nada y lo dice: pasar gramos a mililitros necesita la
 * densidad, y un número convertido a ojo es peor que ninguno.
 */
export function BotonBalanza({ unidad, onPeso, deshabilitado = false }: Props) {
  const balanza = useBalanza()
  const [aviso, setAviso] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)

  const apagado = deshabilitado || !balanza.soportado

  async function leer() {
    setAviso(null)
    setLeyendo(true)

    try {
      if (balanza.estado !== 'conectada') {
        try {
          await balanza.conectar()
        } catch (e) {
          setAviso(e instanceof Error ? e.message : 'No se pudo abrir la balanza')
          return
        }
      }

      const lectura = await balanza.capturar()
      if (lectura === null) {
        setAviso('La balanza no dio un peso estable. Espera a que se fije y vuelve a intentar.')
        return
      }

      const esperada = (unidad ?? '').trim()
      if (esperada !== '' && lectura.unidad !== esperada) {
        setAviso(
          `La balanza mide en ${lectura.unidad} y este campo espera ${esperada}. No se convierte solo.`,
        )
        return
      }

      onPeso(lectura.valor)
    } finally {
      setLeyendo(false)
    }
  }

  const titulo = !balanza.soportado
    ? 'Este navegador no puede leer la balanza'
    : balanza.estado === 'conectada'
      ? 'Toma el peso que marca la balanza'
      : 'Conecta la balanza y toma el peso'

  return (
    <>
      <Tooltip title={titulo}>
        <span>
          <IconButton
            aria-label="Leer balanza"
            color="secondary"
            onClick={() => void leer()}
            disabled={apagado || leyendo}
          >
            <Icon icon="mdi:scale-balance" />
          </IconButton>
        </span>
      </Tooltip>

      <Snackbar
        open={aviso !== null}
        autoHideDuration={6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      </Snackbar>
    </>
  )
}
