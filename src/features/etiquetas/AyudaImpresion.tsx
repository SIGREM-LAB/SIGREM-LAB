import { useState } from 'react'
import { Icon } from '@iconify/react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'

import { ETIQUETA_MM, ETIQUETA_PRUEBA } from './codigo'
import { HojaEtiquetas } from './HojaEtiquetas'

const MEDIDA = `${ETIQUETA_MM.ancho} × ${ETIQUETA_MM.alto} mm`

const PRIMERA_VEZ = [
  'Conecta la impresora Vretti por USB e instala el driver de la memoria USB que viene en su caja.',
  `En Windows abre Configuración › Impresoras y escáneres › Vretti › Preferencias de impresión. Crea un tamaño de papel de ${MEDIDA} (2 × 1 pulgadas), orientación horizontal, tipo «con separación» (gap), y déjalo como predeterminado.`,
  'Calibra el sensor: con el rollo cargado y la tapa cerrada, mantén presionado el botón azul hasta que avancen unas etiquetas y suéltalo. Si no responde así, sigue el manual de la impresora.',
  'Imprime la etiqueta de prueba de abajo y escanéala con la pistola.',
]

const CADA_VEZ: [string, string][] = [
  ['Destino', 'la impresora Vretti, no «Guardar como PDF»'],
  ['Márgenes', 'Ninguno'],
  ['Escala', '100 % o Predeterminada; nunca «Ajustar a la página»'],
  ['Encabezados y pies de página', 'desactivados'],
]

const RECOMENDACIONES = [
  'Pégala sobre una superficie plana, limpia y seca. En frascos, en la parte recta: si el QR queda doblado en la curva, la pistola lo lee mal.',
  'El papel es térmico: se oscurece con calor, sol directo, alcohol y solventes. Lejos de parrillas y estufas; en reactivos que se manejan con solventes, cúbrela con cinta transparente.',
  'Antes de un lote grande, imprime una sola y revisa que quede rollo suficiente.',
  'Limpia el cabezal y el rodillo con un hisopo y alcohol al cambiar de rollo, o cuando la impresión salga con rayas.',
  `La app imprime para etiquetas de ${MEDIDA}. Si compran otra medida, hay que ajustarla en el sistema antes de usarla.`,
]

const PROBLEMAS: [string, string][] = [
  [
    'Sale una etiqueta en blanco entre cada una, o la impresión se va recorriendo',
    `Vuelve a calibrar el sensor y revisa que el papel del driver sea de ${MEDIDA}.`,
  ],
  [
    'Sale chica, cortada o fuera de lugar',
    'En el cuadro de impresión, los márgenes no están en «Ninguno» o la escala no está al 100 %.',
  ],
  [
    'Sale en blanco por completo',
    'El rollo está al revés. Rasca una etiqueta con la uña: la cara que se oscurece va hacia arriba.',
  ],
  [
    'Sale muy clara o la pistola no la lee',
    'Sube la densidad (darkness) en las preferencias del driver y limpia el cabezal. Si la etiqueta está rayada o arrugada, imprímela de nuevo.',
  ],
]

/**
 * El botón (?) que va junto a cada «Imprimir»: abre la guía para dejar lista la
 * impresora y para no equivocarse en el cuadro de impresión del navegador.
 */
export function AyudaImpresion() {
  const [abierta, setAbierta] = useState(false)
  const [probando, setProbando] = useState(false)
  // Estable: `HojaEtiquetas` lo usa como dependencia de su efecto.
  const [terminar] = useState(() => () => setProbando(false))

  return (
    <>
      <Tooltip title="Cómo imprimir etiquetas">
        <IconButton size="small" aria-label="Cómo imprimir etiquetas" onClick={() => setAbierta(true)}>
          <Icon icon="mdi:help-circle-outline" width={20} />
        </IconButton>
      </Tooltip>

      <Dialog open={abierta} onClose={() => setAbierta(false)} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle>Cómo imprimir etiquetas</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" component="h3">
            La primera vez en esta computadora
          </Typography>
          <Box component="ol" sx={{ pl: 2.5, mt: 0.5, mb: 2, '& li': { mb: 0.75 } }}>
            {PRIMERA_VEZ.map((paso) => (
              <Typography component="li" variant="body2" key={paso}>
                {paso}
              </Typography>
            ))}
          </Box>

          <Typography variant="subtitle2" component="h3">
            Cada vez que imprimes
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            En el cuadro de impresión que abre el navegador:
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 2, '& li': { mb: 0.5 } }}>
            {CADA_VEZ.map(([opcion, valor]) => (
              <Typography component="li" variant="body2" key={opcion}>
                <strong>{opcion}:</strong> {valor}
              </Typography>
            ))}
          </Box>

          <Typography variant="subtitle2" component="h3">
            Recomendaciones
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 2, '& li': { mb: 0.75 } }}>
            {RECOMENDACIONES.map((r) => (
              <Typography component="li" variant="body2" key={r}>
                {r}
              </Typography>
            ))}
          </Box>

          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
            Si algo sale mal
          </Typography>
          {PROBLEMAS.map(([sintoma, solucion]) => (
            <Accordion key={sintoma} disableGutters variant="outlined">
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" width={20} />}>
                <Typography variant="body2">{sintoma}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {solucion}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}

          <Alert severity="info" sx={{ mt: 2 }}>
            La etiqueta de prueba lleva el código {ETIQUETA_PRUEBA.codigo}. Al escanearla, la app
            dirá que no lo encontró: es normal, lo que importa es que la pistola la lea completa.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<Icon icon="mdi:printer-outline" width={18} />}
            onClick={() => setProbando(true)}
          >
            Imprimir etiqueta de prueba
          </Button>
          <Button variant="contained" onClick={() => setAbierta(false)}>
            Listo
          </Button>
        </DialogActions>
      </Dialog>

      {probando ? <HojaEtiquetas etiquetas={[ETIQUETA_PRUEBA]} onTerminar={terminar} /> : null}
    </>
  )
}
