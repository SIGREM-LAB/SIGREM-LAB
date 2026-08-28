import { Icon } from '@iconify/react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import type { Enums, Json } from '@/types/database'
import {
  camposDeRenglon,
  cantidadDeRenglon,
  campoDeRenglon,
  esFichaNOM,
  esquemaDeCampos,
  leerProblemas,
  leerRenglon,
  nombreDeRenglon,
  origenDePendiente,
  renglonDesdeValores,
  ubicacionDeRenglon,
  valoresDeRenglon,
  type CampoRenglon,
  type Pendiente,
  type ValoresRenglon,
} from './pendientes'
import { cortarNombre, MOTIVO, REVISION } from './presentacion'
import type { Fila } from './TablaExistencias'

export type Resolucion = {
  renglon: Json
  veredicto: Enums<'veredicto_pendiente'>
  nota: string | null
}

export type Guardado = {
  renglon: Json
  nota: string | null
  estado?: Extract<Enums<'estado_pendiente'>, 'pendiente' | 'descartado'>
}

type Props = {
  pendiente: Pendiente | null
  /** `null` para admin y consulta: no hay almacén propio contra el que contrastar. */
  almacenPropio: number | null
  /** Con qué existencia chocó. `undefined` mientras su consulta está en vuelo. */
  choque: Fila | undefined
  /** En qué existencia se convirtió, cuando ya está cargado. */
  resuelta: Fila | undefined
  trabajando: boolean
  error: Error | null
  onResolver: (resolucion: Resolucion) => void
  onGuardar: (guardado: Guardado) => void
  onCerrar: () => void
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', width: 92, flexShrink: 0 }}>
        {etiqueta}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
        {valor}
      </Typography>
    </Stack>
  )
}

function Insignia({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {etiqueta}
      </Typography>
    </Stack>
  )
}

/**
 * Los dos lados de la pregunta que no se puede contestar de otra forma:
 * «¿son veinte frascos, o el mismo capturado veinte veces?». Se pintan los
 * mismos cinco datos en el mismo orden a izquierda y derecha, porque comparar
 * es leer en paralelo y cualquier reordenamiento obliga a buscar.
 */
function Comparacion({
  renglon,
  existencia,
  rotuloDerecha,
}: {
  renglon: Record<string, Json>
  existencia: Fila | undefined
  rotuloDerecha: string
}) {
  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Lo que dice el Excel
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          <Dato etiqueta="Artículo" valor={nombreDeRenglon(renglon)} />
          <Dato etiqueta="Marca" valor={campoDeRenglon(renglon, 'marca')} />
          <Dato etiqueta="Presentación" valor={campoDeRenglon(renglon, 'presentacion')} />
          <Dato etiqueta="Cantidad" valor={cantidadDeRenglon(renglon)} />
          <Dato etiqueta="Ubicación" valor={ubicacionDeRenglon(renglon)} />
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {rotuloDerecha}
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {existencia === undefined ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Cargando…
            </Typography>
          ) : (
            <>
              <Dato etiqueta="Artículo" valor={existencia.nombre_canonico ?? '—'} />
              <Dato etiqueta="Marca" valor={existencia.marca ?? '—'} />
              <Dato etiqueta="Código" valor={existencia.codigo ?? '—'} />
              <Dato
                etiqueta="Cantidad"
                valor={
                  existencia.cantidad === null
                    ? '—'
                    : `${existencia.cantidad} ${existencia.unidad_base ?? ''}`.trim()
                }
              />
              <Dato etiqueta="Ubicación" valor={existencia.ubicacion ?? '—'} />
            </>
          )}
        </Stack>
      </Grid>
    </Grid>
  )
}

function Campo({
  campo,
  control,
  editable,
}: {
  campo: CampoRenglon
  control: ReturnType<typeof useForm<ValoresRenglon>>['control']
  editable: boolean
}) {
  return (
    <Controller
      name={campo.clave}
      control={control}
      render={({ field, fieldState }) =>
        campo.tipo === 'booleano' ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={field.value === true}
                onChange={(e) => field.onChange(e.target.checked)}
                onBlur={field.onBlur}
                disabled={!editable}
              />
            }
            label={campo.etiqueta}
          />
        ) : (
          <TextField
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            label={campo.etiqueta}
            size="small"
            fullWidth
            disabled={!editable}
            multiline={campo.clave === 'observaciones'}
            error={fieldState.error !== undefined}
            helperText={fieldState.error?.message}
          />
        )
      }
    />
  )
}

/**
 * El formulario del renglón. Va en su propio componente y el panel lo monta con
 * `key={pendiente.id}`: así cambiar de renglón lo REMONTA en vez de tener que
 * acordarse de un `reset()`, que es la forma habitual de acabar editando un
 * frasco con los valores del anterior.
 */
function FormularioRenglon({
  pendiente,
  editable,
  trabajando,
  onResolver,
  onGuardar,
  codigoChoque,
}: {
  pendiente: Pendiente
  editable: boolean
  trabajando: boolean
  onResolver: (resolucion: Resolucion) => void
  onGuardar: (guardado: Guardado) => void
  /** El código de la existencia con la que chocó; `null` si no chocó con ninguna. */
  codigoChoque: string | null
}) {
  const renglon = leerRenglon(pendiente.renglon)
  const campos = camposDeRenglon(renglon)
  const ficha = campos.filter((c) => esFichaNOM(c.clave))
  const principales = campos.filter((c) => !esFichaNOM(c.clave))

  const { control, handleSubmit, getValues } = useForm<ValoresRenglon>({
    resolver: zodResolver(esquemaDeCampos(campos)),
    defaultValues: { ...valoresDeRenglon(renglon), nota: pendiente.nota ?? '' },
  })

  // La nota no es un campo del renglón: es lo que quien revisa le deja al
  // siguiente, y viaja en su propia columna. El esquema de zod solo describe el
  // renglón, así que `nota` no llega en los valores validados y se lee del
  // formulario.
  const nota = () => {
    const valor = getValues('nota')
    const texto = typeof valor === 'string' ? valor.trim() : ''
    return texto === '' ? null : texto
  }

  const enviar = (veredicto: Enums<'veredicto_pendiente'>) =>
    handleSubmit((valores) =>
      onResolver({ renglon: renglonDesdeValores(renglon, valores), veredicto, nota: nota() }),
    )

  const guardar = (estado?: Guardado['estado']) =>
    handleSubmit((valores) =>
      onGuardar({ renglon: renglonDesdeValores(renglon, valores), nota: nota(), estado }),
    )

  return (
    <Box component="form" onSubmit={enviar('nueva')}>
      <Stack spacing={2}>
        {principales.map((campo) => (
          <Campo key={campo.clave} campo={campo} control={control} editable={editable} />
        ))}
      </Stack>

      {ficha.length === 0 ? null : (
        <Accordion disableGutters elevation={0} sx={{ mt: 2, bgcolor: 'transparent' }}>
          <AccordionSummary
            expandIcon={<Icon icon="mdi:chevron-down" width={20} />}
            sx={{ px: 0 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Ficha NOM del reactivo ({ficha.length} campos)
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <Stack spacing={2}>
              {ficha.map((campo) => (
                <Campo key={campo.clave} campo={campo} control={control} editable={editable} />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      <Controller
        name="nota"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={typeof field.value === 'string' ? field.value : ''}
            label="Nota de la revisión"
            placeholder="Qué averiguaste, para quien lo vuelva a mirar"
            size="small"
            fullWidth
            multiline
            minRows={2}
            disabled={!editable}
            sx={{ mt: 2 }}
          />
        )}
      />

      {!editable ? null : (
        <Stack spacing={1} sx={{ mt: 2.5 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={trabajando}
            startIcon={<Icon icon="mdi:database-import-outline" width={20} />}
          >
            Cargar al inventario
          </Button>

          {codigoChoque === null ? null : (
            <Button
              type="button"
              variant="outlined"
              disabled={trabajando}
              onClick={enviar('duplicado')}
              startIcon={<Icon icon="mdi:call-merge" width={20} />}
            >
              Es la misma: suma a {codigoChoque}
            </Button>
          )}

          <Stack direction="row" spacing={1}>
            <Button
              type="button"
              fullWidth
              disabled={trabajando}
              onClick={guardar()}
              startIcon={<Icon icon="mdi:content-save-outline" width={20} />}
            >
              Guardar sin cerrar
            </Button>
            <Button
              type="button"
              fullWidth
              color="error"
              disabled={trabajando}
              onClick={guardar('descartado')}
              startIcon={<Icon icon="mdi:archive-cancel-outline" width={20} />}
            >
              Descartar
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  )
}

/**
 * El renglón, uno por uno: lo que decía el Excel, lo que el cargador le ve, y
 * los controles para corregirlo y darle el visto bueno.
 *
 * El visto bueno NO es marcar una casilla: pasa por `resolver_pendiente`, que
 * crea la existencia con el dato ya corregido. Marcar «revisado» sin cargar era
 * exactamente el agujero que dejaba a N3 con 337 renglones revisados y 1278
 * existencias.
 */
export function PanelPendiente({
  pendiente,
  almacenPropio,
  choque,
  resuelta,
  trabajando,
  error,
  onResolver,
  onGuardar,
  onCerrar,
}: Props) {
  if (pendiente === null) return null

  const renglon = leerRenglon(pendiente.renglon)
  const problemas = leerProblemas(pendiente.problemas)
  const ajeno = almacenPropio !== null && pendiente.almacen_id !== almacenPropio
  const editable = pendiente.estado === 'pendiente' && !ajeno
  const motivo = MOTIVO[pendiente.motivo]
  const revision = REVISION[pendiente.estado]

  return (
    <Drawer
      anchor="right"
      open
      onClose={onCerrar}
      // El rol y el nombre van en el papel y no en la raíz del Drawer: su raíz
      // lleva `role="presentation"` y un `aria-labelledby` puesto ahí no nombra
      // nada. El nombre es hoja y fila, que es como se localiza el renglón en el
      // archivo.
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'pendiente-titulo',
          sx: { width: { xs: '100%', sm: 560 }, p: 2.5 },
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="pendiente-titulo" sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
            {origenDePendiente(pendiente)}
          </Typography>
          {/* Qué es y cuánta hay, en el encabezado y no solo dentro del
              formulario: la unidad es la mitad del problema en 105 de los 337
              renglones, y tenerla que buscar entre veinticinco controles es
              tenerla escondida. */}
          <Typography
            variant="body2"
            sx={{ fontWeight: 600 }}
            title={nombreDeRenglon(renglon)}
          >
            {cortarNombre(nombreDeRenglon(renglon)).cabeza} · {cantidadDeRenglon(renglon)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {pendiente.archivo}
          </Typography>
        </Box>
        <IconButton onClick={onCerrar} aria-label="Cerrar la revisión" size="small">
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
        <Insignia color={motivo.color} etiqueta={motivo.etiqueta} />
        <Insignia color={revision.color} etiqueta={revision.etiqueta} />
      </Stack>

      {ajeno && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Este renglón es de otro almacén. Puedes consultarlo, no revisarlo.
        </Alert>
      )}

      {pendiente.estado === 'resuelto' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Ya está en el inventario{resuelta === undefined ? '' : ` como ${resuelta.codigo}`}.
        </Alert>
      )}

      {pendiente.estado === 'descartado' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Se descartó: se revisó y no debe cargarse.
        </Alert>
      )}

      {/* severity="warning" y no "error": el renglón no está roto, le falta un
          dato que solo sabe quien conoce el almacén. */}
      {problemas.length === 0 ? null : (
        <Alert severity="warning" icon={<Icon icon="mdi:alert-outline" width={22} />} sx={{ mb: 2 }}>
          <Stack spacing={1}>
            {problemas.map((p, i) => (
              <Box key={i}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {p.regla}
                </Typography>
                <Typography variant="body2">{p.detalle}</Typography>
                {p.columna === '' && p.valor === '' ? null : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {p.columna === '' ? '' : `Columna ${p.columna} · `}
                    {p.valor === '' ? '' : `dice «${p.valor}»`}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Alert>
      )}

      {pendiente.existencia_id === null ? null : (
        <Comparacion
          renglon={renglon}
          existencia={choque}
          rotuloDerecha="La existencia con la que choca"
        />
      )}

      {error === null ? null : (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudo guardar: {error.message}
        </Alert>
      )}

      <Divider sx={{ mb: 2 }} />

      <FormularioRenglon
        key={pendiente.id}
        pendiente={pendiente}
        editable={editable}
        trabajando={trabajando}
        onResolver={onResolver}
        onGuardar={onGuardar}
        codigoChoque={pendiente.existencia_id === null ? null : (choque?.codigo ?? null)}
      />
    </Drawer>
  )
}
