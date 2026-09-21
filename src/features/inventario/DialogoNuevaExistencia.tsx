import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
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
import { useForm, useWatch } from 'react-hook-form'

import type { Enums } from '@/types/database'
import {
  CAMPO_LABORATORIO,
  camposVisibles,
  esquemaDeCampos,
  payloadDe,
  TIPOS,
  valoresIniciales,
  type Campo,
  type Valores,
} from './campos'
import { FormularioPerfil } from './FormularioPerfil'
import { mensajeDe } from './presentacion'
import { useBuscarArticulo, useCrearExistencia, useFormulario, useLaboratorios } from './consultas'

type Props = {
  abierto: boolean
  almacen: { id: number; clave: string; nombre: string }
  onCerrar: () => void
  /** Se avisa con el código que asignó la base, para poder anunciarlo. */
  onCreada: (codigo: string) => void
}

/**
 * El alta de una existencia.
 *
 * **Los campos salen de la base.** El único control que decide algo es el
 * selector de tipo de arriba, y lo que decide es qué perfil pedir: a partir de
 * ahí, `formulario(almacen, clasificacion)` dice qué se pregunta, con qué
 * etiqueta, de qué tipo y si es obligatorio. No hay ni un condicional por
 * clasificación en este archivo, y por eso agregar un almacén con reglas
 * propias, o mover un campo de sitio, no obliga a tocar la pantalla.
 *
 * El almacén no se elige: es el del perfil. La RLS no dejaría escribir en otro
 * de todas formas, así que un selector solo ofrecería opciones que fallan.
 */
export function DialogoNuevaExistencia({ abierto, almacen, onCerrar, onCreada }: Props) {
  const [tipo, setTipo] = useState<Enums<'clasificacion_articulo'>>('reactivo')

  const formulario = useFormulario(almacen.id, abierto ? tipo : null)
  const campos = useMemo(() => formulario.data ?? [], [formulario.data])

  const crear = useCrearExistencia()

  // El diálogo se desmonta al cerrarse (`keepMounted` apagado, que es el
  // comportamiento por omisión de Dialog), así que el formulario nace limpio en
  // cada apertura sin necesidad de un reset.
  return (
    <Dialog open={abierto} onClose={cerrarSiSePuede} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle
        component="div"
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pb: 1.5 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>
            Nueva existencia
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Entra al inventario de {almacen.clave} · {almacen.nombre}
          </Typography>
        </Box>
        <IconButton onClick={cerrarSiSePuede} aria-label="Cerrar" size="small">
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </DialogTitle>

      {/* La barra vive fuera del contenido para que cambiar de tipo no empuje
          los campos hacia abajo mientras llega el perfil nuevo. */}
      <Box sx={{ height: 4 }}>
        {formulario.isFetching || crear.isPending ? <LinearProgress /> : null}
      </Box>

      <DialogContent dividers sx={{ pt: 2.5 }}>
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              fullWidth
              size="small"
              required
              label="Tipo de producto"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Enums<'clasificacion_articulo'>)}
              helperText="Decide qué campos pide el formulario"
            >
              {TIPOS.map((t) => (
                <MenuItem key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              size="small"
              disabled
              label="Código"
              value=""
              placeholder={`${almacen.clave}-00000`}
              helperText="Lo asigna la base al guardar; es lo que va en la etiqueta"
            />
          </Grid>
        </Grid>

        {formulario.isError ? (
          <Alert severity="error">
            No se pudieron cargar los campos de este tipo. {mensajeDe(formulario.error)}
          </Alert>
        ) : campos.length === 0 ? (
          // Sin perfil no hay formulario, y pintar un diálogo vacío con un botón
          // de guardar invita a mandar una existencia sin un solo dato.
          formulario.isPending ? null : (
            <Alert severity="warning">
              Este almacén no tiene un perfil de captura para{' '}
              {TIPOS.find((t) => t.valor === tipo)?.etiqueta}. Un administrador tiene que darlo de
              alta antes de poder registrar existencias de este tipo.
            </Alert>
          )
        ) : (
          <Captura
            // Al cambiar de tipo el formulario se rehace desde cero: sin esta
            // llave, react-hook-form conservaría lo capturado del tipo anterior
            // en los campos que se llaman igual.
            key={tipo}
            campos={campos}
            almacen={almacen}
            tipo={tipo}
            guardando={crear.isPending}
            error={crear.error}
            onGuardar={(valores) =>
              crear.mutate(
                { almacenId: almacen.id, clasificacion: tipo, valores },
                {
                  onSuccess: (fila) => {
                    onCreada(fila?.codigo ?? '')
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
    // Cerrar a media escritura tiraría el alta sin avisar.
    if (crear.isPending) return
    crear.reset()
    onCerrar()
  }
}

type PropsCaptura = {
  campos: Campo[]
  almacen: { id: number; clave: string; nombre: string }
  tipo: Enums<'clasificacion_articulo'>
  guardando: boolean
  error: unknown
  onGuardar: (valores: Record<string, string | boolean>) => void
}

/**
 * Separado del diálogo para poder montar `useForm` con los campos ya en la
 * mano: los hooks no se pueden llamar después de un `return` temprano, y el
 * esquema de validación se construye a partir de la lista que devolvió la base.
 */
function Captura({ campos, almacen, tipo, guardando, error, onGuardar }: PropsCaptura) {
  const esquema = useMemo(() => esquemaDeCampos(campos), [campos])

  const { control, handleSubmit } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales(campos),
  })

  const visibles = useMemo(() => camposVisibles(campos), [campos])
  const pideLaboratorio = visibles.some((c) => c.campo === CAMPO_LABORATORIO)
  const laboratorios = useLaboratorios(almacen.id, pideLaboratorio)

  // La unidad es un campo más del formulario, así que se lee de ahí: es contra
  // ella contra la que se coteja lo que manda la balanza.
  const unidad = useWatch({ control, name: 'unidad' })

  return (
    <Box
      component="form"
      onSubmit={handleSubmit((valores) => onGuardar(payloadDe(campos, valores)))}
      noValidate
    >
      <Stack spacing={2.5}>
        <FormularioPerfil
          campos={visibles}
          control={control}
          laboratorios={laboratorios.data ?? []}
          unidad={typeof unidad === 'string' ? unidad : ''}
          debajoDe={(campo) =>
            campo.destino === 'articulo.nombre_canonico' ? (
              <Sugerencias campo={campo.campo} control={control} tipo={tipo} />
            ) : null
          }
        />

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Almacén
          </Typography>
          <Chip size="small" label={`${almacen.clave} · ${almacen.nombre}`} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            No se elige: es el almacén de tu perfil.
          </Typography>
        </Stack>

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
          Guardar existencia
        </Button>
      </Stack>
    </Box>
  )
}

/**
 * Buscar antes de crear.
 *
 * El spec lo pide en el alta: el catálogo crece por errata si nadie mira lo que
 * ya está. No bloquea —«Zinc en polvo 95%» y «Zinc en polvo 93%» son dos
 * artículos y los dos se parecen muchísimo— pero enseña los candidatos mientras
 * se teclea, que es cuando sirven.
 */
function Sugerencias({
  campo,
  control,
  tipo,
}: {
  campo: string
  control: ReturnType<typeof useForm<Valores>>['control']
  tipo: Enums<'clasificacion_articulo'>
}) {
  const escrito = useWatch({ control, name: campo })
  const termino = typeof escrito === 'string' ? escrito : ''

  // Sin esta espera se pide al catálogo en cada tecla. Medio segundo es lo que
  // tarda una pausa al teclear y no se nota como retraso.
  const [reposado, setReposado] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setReposado(termino), 400)
    return () => clearTimeout(id)
  }, [termino])

  const busqueda = useBuscarArticulo(reposado)

  // Solo los del mismo tipo: un reactivo que se parece a un material no es el
  // mismo artículo escrito de otra forma.
  const candidatos = (busqueda.data ?? []).filter((a) => a.clasificacion === tipo)
  if (candidatos.length === 0) return null

  return (
    <Box sx={{ mt: 0.25, mb: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Ya en el catálogo, por si es alguno de estos:
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {candidatos.map((a) => (
          <Chip
            key={a.articulo_id}
            size="small"
            variant="outlined"
            label={a.nombre_canonico}
            title={`${a.unidad_base} · ${a.verificado ? 'verificado' : 'sin verificar'}`}
          />
        ))}
      </Stack>
    </Box>
  )
}


