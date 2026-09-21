import { useMemo } from 'react'
import { Icon } from '@iconify/react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { BotonBalanza } from '@/features/balanza/BotonBalanza'
import {
  useCambiarLaboratorio,
  useDetalleExistencia,
  useLaboratorios,
  useRegistrarMovimiento,
} from './consultas'
import {
  esquemaDeMovimiento,
  hoy,
  MOVIMIENTOS,
  registroDe,
  tiposPara,
  type TipoMovimiento,
  type ValoresMovimiento,
} from './movimientos'
import { aspectoDeEstado, mensajeDe } from './presentacion'
import type { Fila } from './TablaExistencias'

type Props = {
  /** La existencia sobre la que se registra. `null` = el diálogo está cerrado. */
  fila: Fila | null
  onCerrar: () => void
  /** Se avisa con lo que se hizo, para poder anunciarlo. */
  onRegistrado: (resumen: string) => void
}

/**
 * Registrar un movimiento de inventario.
 *
 * Seis tipos, y cada uno pregunta lo suyo: una entrada pide el proveedor, una
 * merma exige el motivo, y el ajuste no pregunta cuánto cambió sino cuánto HAY
 * —la diferencia con el saldo es lo que va a la bitácora—. Esas reglas viven en
 * `movimientos.ts`, no aquí: este archivo pinta lo que aquel decide.
 *
 * Dos de los seis no son movimientos del enum y se explican allá: «Producto
 * caducado» se guarda como merma con su motivo, y «Cambio de laboratorio» no
 * toca la bitácora porque no mueve cantidad.
 *
 * Quién puede registrar lo decide la RLS: `movimiento_alta` exige
 * `puede_escribir()` y el almacén propio. La pantalla no ofrece el botón donde
 * iba a fallar, pero el candado es aquélla.
 */
export function DialogoMovimiento({ fila, onCerrar, onRegistrado }: Props) {
  if (fila === null || fila.id === null || fila.almacen_id === null) return null

  return (
    <Registrar
      fila={fila}
      existenciaId={fila.id}
      almacenId={fila.almacen_id}
      onCerrar={onCerrar}
      onRegistrado={onRegistrado}
    />
  )
}

type PropsRegistrar = {
  fila: Fila
  existenciaId: number
  almacenId: number
  onCerrar: () => void
  onRegistrado: (resumen: string) => void
}

function Registrar({ fila, existenciaId, almacenId, onCerrar, onRegistrado }: PropsRegistrar) {
  const detalle = useDetalleExistencia(existenciaId)
  const laboratorios = useLaboratorios(almacenId, true)
  const movimiento = useRegistrarMovimiento()
  const cambio = useCambiarLaboratorio()

  const saldo = fila.cantidad ?? 0
  const unidad = fila.unidad_base ?? ''

  // El detalle trae el ID; el nombre sale de la lista que ya se pide para el
  // selector de destino, porque la FK compuesta impide traerlo embebido.
  const laboratorioActual = detalle.data?.laboratorio_id ?? null
  const nombreLaboratorio =
    (laboratorios.data ?? []).find((l) => l.id === laboratorioActual)?.nombre ?? null

  const tipos = useMemo(() => tiposPara(fila.clasificacion), [fila.clasificacion])

  const esquema = useMemo(
    () => esquemaDeMovimiento({ saldo, unidad, laboratorioActual }),
    [saldo, unidad, laboratorioActual],
  )

  const { control, handleSubmit } = useForm<ValoresMovimiento>({
    resolver: zodResolver(esquema),
    defaultValues: { tipo: 'entrada', cantidad: '', motivo: '', fecha: hoy(), laboratorio: '' },
  })

  const tipo = useWatch({ control, name: 'tipo' }) as TipoMovimiento
  const definicion = MOVIMIENTOS[tipo]
  const guardando = movimiento.isPending || cambio.isPending
  const error = movimiento.error ?? cambio.error

  return (
    <Dialog open onClose={cerrarSiSePuede} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle
        component="div"
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pb: 1.5 }}
      >
        <Typography variant="h6" sx={{ flex: 1, color: 'primary.main', fontWeight: 700 }}>
          Movimiento de inventario
        </Typography>
        <IconButton onClick={cerrarSiSePuede} aria-label="Cerrar" size="small">
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </DialogTitle>

      <Box sx={{ height: 4 }}>{guardando ? <LinearProgress /> : null}</Box>

      <Box component="form" onSubmit={handleSubmit(guardar)} noValidate>
        <DialogContent dividers sx={{ pt: 2.5 }}>
          <Ficha
            fila={fila}
            unidad={unidad}
            minimo={detalle.data?.cantidad_minima ?? null}
            laboratorio={nombreLaboratorio}
          />

          <Stack spacing={2.5} sx={{ mt: 2.5 }}>
            <Controller
              name="tipo"
              control={control}
              render={({ field }) => (
                <TextField {...field} select fullWidth size="small" required label="Tipo de movimiento">
                  {tipos.map((t) => (
                    <MenuItem key={t} value={t}>
                      {MOVIMIENTOS[t].etiqueta}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            {definicion.cantidad !== null && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="cantidad"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                        <TextField
                          {...field}
                          fullWidth
                          size="small"
                          required
                          type="number"
                          label={definicion.cantidad?.etiqueta}
                          slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                          error={!!fieldState.error}
                          helperText={
                            fieldState.error?.message ??
                            (definicion.cantidad?.modo === 'absoluto'
                              ? `Cuánto hay de verdad; hoy el saldo dice ${saldo} ${unidad}`.trim()
                              : ' ')
                          }
                        />
                        <BotonBalanza
                          unidad={unidad}
                          onPeso={(valor) => field.onChange(String(valor))}
                        />
                      </Stack>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="fecha"
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        size="small"
                        type="date"
                        label="Fecha"
                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy() } }}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message ?? ' '}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            )}

            {definicion.motivo !== null && (
              <Controller
                name="motivo"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    required={definicion.motivo?.obligatorio}
                    label={definicion.motivo?.etiqueta}
                    placeholder={definicion.motivo?.ayuda}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? 'Queda escrito junto al movimiento'}
                  />
                )}
              />
            )}

            {tipo === 'cambio_lab' && (
              <>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      disabled
                      label="Laboratorio origen"
                      value={nombreLaboratorio ?? '—'}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="laboratorio"
                      control={control}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          size="small"
                          required
                          label="Laboratorio destino"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message ?? ' '}
                        >
                          {(laboratorios.data ?? []).map((l) => (
                            <MenuItem key={l.id} value={String(l.id)}>
                              {l.nombre}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                </Grid>

                {/* Se dice donde se decide, no en un comentario del código: la
                    bitácora es de cantidades, y aquí no se mueve ninguna. */}
                <Alert severity="info">
                  Cambiar de laboratorio mueve el frasco de sitio, no su existencia, así que no deja
                  renglón en «Movimientos».
                </Alert>
              </>
            )}

            {tipo === 'caducado' && (
              <Alert severity="info">
                Se registra como merma, con la caducidad escrita en el motivo.
              </Alert>
            )}

            {error === null || error === undefined ? null : (
              <Alert severity="error">No se pudo registrar. {mensajeDe(error)}</Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={cerrarSiSePuede} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            loading={guardando}
            startIcon={<Icon icon="mdi:swap-horizontal" width={20} />}
          >
            Guardar movimiento
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )

  function guardar(valores: ValoresMovimiento) {
    const registro = registroDe(valores, { saldo, unidad, laboratorioActual })

    if (registro.clase === 'laboratorio') {
      cambio.mutate(
        { existenciaId, laboratorioId: registro.laboratorioId },
        { onSuccess: () => avisar('Laboratorio cambiado') },
      )
      return
    }

    movimiento.mutate(
      {
        existenciaId,
        tipo: registro.tipo,
        cantidad: registro.cantidad,
        motivo: registro.motivo,
        ocurridoEn: registro.ocurridoEn,
      },
      {
        onSuccess: () =>
          avisar(
            `${MOVIMIENTOS[valores.tipo].etiqueta}: ${registro.cantidad > 0 ? '+' : ''}${registro.cantidad} ${unidad}`.trim(),
          ),
      },
    )
  }

  function avisar(resumen: string) {
    onRegistrado(`${fila.codigo ?? ''} · ${resumen}`.trim())
    onCerrar()
  }

  function cerrarSiSePuede() {
    // Cerrar a media escritura tiraría lo capturado sin avisar.
    if (guardando) return
    movimiento.reset()
    cambio.reset()
    onCerrar()
  }
}

/**
 * La ficha de solo lectura de arriba: con qué frasco se está trabajando. Es lo
 * que evita registrar una merma de 40 litros en el frasco equivocado por haber
 * pulsado un renglón de más en la tabla.
 */
function Ficha({
  fila,
  unidad,
  minimo,
  laboratorio,
}: {
  fila: Fila
  unidad: string
  minimo: number | null
  laboratorio: string | null
}) {
  const estado = aspectoDeEstado(fila.estado)

  const datos: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Código', valor: fila.codigo ?? '—' },
    { etiqueta: 'Producto', valor: fila.nombre_canonico ?? '—' },
    { etiqueta: 'Almacén', valor: fila.almacen_clave ?? '—' },
    { etiqueta: 'Laboratorio', valor: laboratorio ?? '—' },
    { etiqueta: 'Existencia actual', valor: `${fila.cantidad ?? 0} ${unidad}`.trim() },
    { etiqueta: 'Stock mínimo', valor: minimo === null ? '—' : `${minimo} ${unidad}`.trim() },
    { etiqueta: 'Estado', valor: estado.etiqueta },
  ]

  return (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Grid container spacing={1.5}>
        {datos.map((d) => (
          <Grid key={d.etiqueta} size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {d.etiqueta}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {d.valor}
            </Typography>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
