import { useMemo } from 'react'
import { Icon } from '@iconify/react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Controller, useForm, useWatch } from 'react-hook-form'

import {
  CAMPO_LABORATORIO,
  CAMPO_MOTIVO,
  campoDeCantidad,
  camposVisibles,
  esEditable,
  esquemaDeEdicion,
  payloadDeEdicion,
  valoresDe,
  type Campo,
  type Valores,
} from './campos'
import { FormularioPerfil } from './FormularioPerfil'
import { mensajeDe } from './presentacion'
import type { Fila } from './TablaExistencias'
import { useActualizarExistencia, useFormulario, useLaboratorios, useValoresExistencia } from './consultas'

type Props = {
  /** La existencia que se está corrigiendo. `null` = el diálogo no está abierto. */
  fila: Fila | null
  onCerrar: () => void
  /** Se avisa con el código, para poder decir cuál se guardó. */
  onGuardada: (codigo: string) => void
}

/**
 * La corrección de una existencia.
 *
 * Los campos salen de la base, igual que en el alta: `formulario(almacen,
 * clasificacion)` dice qué se pregunta para ESTE tipo de cosa en ESTE almacén,
 * y `valores_existencia` dice qué vale hoy cada uno. No hay ni un condicional
 * por clasificación en este archivo.
 *
 * Lo que sí cambia respecto del alta son dos cosas, y las dos salen del
 * `destino` del campo, no de una lista escrita aquí:
 *
 * 1. **Los campos del ARTÍCULO se ven pero no se editan.** El artículo lo
 *    comparten todos los frascos de la misma sustancia: corregir el CAS del
 *    frasco que tengo abierto se lo cambiaría a los catorce. Se pintan
 *    bloqueados, con su valor a la vista y la razón escrita debajo, porque son
 *    la ficha de seguridad del reactivo y quien corrige tiene que poder leerla.
 *
 * 2. **La cantidad es un conteo.** No se escribe el saldo: si lo contado
 *    difiere, la base registra un `ajuste_conteo` y el trigger mueve el saldo.
 *    Por eso, cuando el número cambia, se pide el motivo: es lo que va a quedar
 *    escrito en la bitácora.
 */
export function DialogoEditarExistencia({ fila, onCerrar, onGuardada }: Props) {
  // Las columnas de una vista llegan anulables —a través de una vista Postgres
  // no promete la no-nulidad— y sin estas tres no hay nada que editar. Quien
  // abre el diálogo ya lo comprueba; esto es para que el tipo diga la verdad.
  if (fila === null || fila.id === null || fila.almacen_id === null) return null

  return (
    <Editar
      fila={fila}
      existenciaId={fila.id}
      almacenId={fila.almacen_id}
      onCerrar={onCerrar}
      onGuardada={onGuardada}
    />
  )
}

type PropsEditar = {
  fila: Fila
  existenciaId: number
  almacenId: number
  onCerrar: () => void
  onGuardada: (codigo: string) => void
}

function Editar({ fila, existenciaId, almacenId, onCerrar, onGuardada }: PropsEditar) {
  const formulario = useFormulario(almacenId, fila.clasificacion)
  const actuales = useValoresExistencia(existenciaId)
  const guardar = useActualizarExistencia()

  const unidad = fila.unidad_base ?? ''
  const saldo = fila.cantidad

  const campos = useMemo(
    () => paraEditar(camposVisibles(formulario.data ?? []), saldo, unidad),
    [formulario.data, saldo, unidad],
  )

  const cargando = formulario.isPending || actuales.isPending
  const error = formulario.error ?? actuales.error

  return (
    <Dialog open onClose={cerrarSiSePuede} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle
        component="div"
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pb: 1.5 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>
            Editar existencia
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
              {fila.codigo}
            </Box>{' '}
            · {fila.nombre_canonico}
          </Typography>
        </Box>
        <IconButton onClick={cerrarSiSePuede} aria-label="Cerrar" size="small">
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </DialogTitle>

      {/* La barra vive fuera del contenido para que recargar no empuje los
          campos hacia abajo. */}
      <Box sx={{ height: 4 }}>
        {formulario.isFetching || actuales.isFetching || guardar.isPending ? <LinearProgress /> : null}
      </Box>

      <DialogContent dividers sx={{ pt: 2.5 }}>
        {error !== null && error !== undefined ? (
          <Alert severity="error">No se pudo leer esta existencia. {mensajeDe(error)}</Alert>
        ) : cargando ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
          </Stack>
        ) : campos.length === 0 ? (
          // Sin perfil no hay formulario, y un diálogo vacío con un botón de
          // guardar invita a mandar un envío que no dice nada.
          <Alert severity="warning">
            Este almacén no tiene un perfil de captura para este tipo de artículo, así que no hay
            campos que corregir. Un administrador tiene que darlo de alta.
          </Alert>
        ) : (
          <Captura
            campos={campos}
            almacenId={almacenId}
            saldo={saldo}
            unidad={unidad}
            actuales={actuales.data ?? {}}
            guardando={guardar.isPending}
            error={guardar.error}
            onGuardar={(valores, motivo) =>
              guardar.mutate(
                { existenciaId, valores, motivo },
                {
                  onSuccess: (guardada) => {
                    onGuardada(guardada?.codigo ?? fila.codigo ?? '')
                    onCerrar()
                  },
                },
              )
            }
          />
        )}
      </DialogContent>
    </Dialog>
  )

  function cerrarSiSePuede() {
    // Cerrar a media escritura tiraría la corrección sin avisar.
    if (guardar.isPending) return
    guardar.reset()
    onCerrar()
  }
}

type PropsCaptura = {
  campos: Campo[]
  almacenId: number
  saldo: number | null
  unidad: string
  actuales: Record<string, unknown>
  guardando: boolean
  error: unknown
  onGuardar: (valores: Record<string, string | boolean>, motivo: string | null) => void
}

/**
 * Separado del diálogo para poder montar `useForm` con los campos y sus valores
 * ya en la mano: los hooks no se pueden llamar después de un `return` temprano,
 * y tanto el esquema como los valores iniciales se construyen con lo que
 * devolvió la base.
 */
function Captura({
  campos,
  almacenId,
  saldo,
  unidad,
  actuales,
  guardando,
  error,
  onGuardar,
}: PropsCaptura) {
  const esquema = useMemo(() => esquemaDeEdicion(campos, saldo), [campos, saldo])

  const { control, handleSubmit } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { ...valoresDe(campos, actuales), [CAMPO_MOTIVO]: '' },
  })

  const pideLaboratorio = campos.some((c) => c.campo === CAMPO_LABORATORIO)
  const laboratorios = useLaboratorios(almacenId, pideLaboratorio)

  const cantidad = campoDeCantidad(campos)
  // Los hooks no se pueden llamar condicionalmente, y hay perfiles sin cantidad
  // —Equipos, regla 9—. Cuando no la hay se observa el motivo, que existe
  // siempre; `ajusta` es falso de todos modos y nadie lee este valor.
  const contada = useWatch({ control, name: cantidad?.campo ?? CAMPO_MOTIVO })

  // El ajuste se anuncia ANTES de guardar, no después: quien corrige un anaquel
  // y de paso teclea mal la cantidad tiene que ver que eso va a mover el saldo.
  const ajusta =
    cantidad !== undefined &&
    saldo !== null &&
    typeof contada === 'string' &&
    contada.trim() !== '' &&
    Number(contada) !== saldo

  return (
    <Box
      component="form"
      onSubmit={handleSubmit((valores) =>
        onGuardar(
          payloadDeEdicion(campos, valores),
          ajusta ? String(valores[CAMPO_MOTIVO] ?? '').trim() : null,
        ),
      )}
      noValidate
    >
      <Stack spacing={2.5}>
        <FormularioPerfil
          campos={campos}
          control={control}
          laboratorios={laboratorios.data ?? []}
          unidad={unidad}
          soloLectura={(campo) => !esEditable(campo)}
          valores={actuales}
          ayudaSoloLectura="Del catálogo: se comparte con las demás existencias"
        />

        {ajusta ? (
          <Alert severity="info" icon={<Icon icon="mdi:scale-balance" width={20} />}>
            <Stack spacing={1.5}>
              <Typography variant="body2">
                El saldo pasa de {saldo} a {contada} {unidad}. Se va a registrar un ajuste de conteo
                en la bitácora.
              </Typography>
              <Controller
                name={CAMPO_MOTIVO}
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={typeof field.value === 'boolean' ? '' : field.value}
                    fullWidth
                    size="small"
                    required
                    label="Motivo del ajuste"
                    placeholder="Conteo de septiembre, derrame, frasco roto…"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? 'Queda escrito junto al movimiento'}
                  />
                )}
              />
            </Stack>
          </Alert>
        ) : null}

        {error === null || error === undefined ? null : (
          <Alert severity="error">No se pudo guardar. {mensajeDe(error)}</Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={guardando}
          startIcon={<Icon icon="mdi:content-save-outline" width={20} />}
        >
          {ajusta ? 'Guardar y registrar el ajuste' : 'Guardar cambios'}
        </Button>
      </Stack>
    </Box>
  )
}

/**
 * El único rótulo que la edición cambia.
 *
 * En el alta, «Cantidad en existencia» es lo que se está declarando; aquí es lo
 * que se acaba de contar, y la diferencia con el saldo es justamente lo que se
 * va a registrar. El campo se encuentra por su `destino` —el de la bitácora—,
 * no por su nombre: es el mismo dato de la base con el que se decide todo lo
 * demás.
 */
function paraEditar(campos: Campo[], saldo: number | null, unidad: string): Campo[] {
  const cantidad = campoDeCantidad(campos)
  if (cantidad === undefined) return campos

  return campos.map((campo) =>
    campo.campo === cantidad.campo
      ? {
          ...campo,
          etiqueta: 'Cantidad contada',
          ayuda: `Hoy el saldo dice ${saldo ?? 0} ${unidad}`.trim(),
        }
      : campo,
  )
}
