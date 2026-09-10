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
import { CampoCaptura } from './CampoCaptura'
import {
  CAMPO_LABORATORIO,
  camposVisibles,
  esquemaDeCampos,
  grupoDe,
  payloadDe,
  TIPOS,
  valoresIniciales,
  type Campo,
  type Grupo,
  type Valores,
} from './campos'
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

  const grupos = useMemo(() => agrupar(visibles), [visibles])

  return (
    <Box
      component="form"
      onSubmit={handleSubmit((valores) => onGuardar(payloadDe(campos, valores)))}
      noValidate
    >
      <Stack spacing={2.5}>
        {/* Los campos de la ficha del artículo van primero y en su propio
            recuadro: son lo que distingue una sustancia de otra, y el resto del
            formulario describe el frasco. El recuadro sale del prefijo de
            `destino`, no de una lista de clasificaciones escrita aquí. */}
        <Recuadro grupo="reactivo" campos={grupos.reactivo}>
          <Rejilla campos={grupos.reactivo} control={control} laboratorios={[]} />
        </Recuadro>

        <Recuadro grupo="biologico" campos={grupos.biologico}>
          <Rejilla campos={grupos.biologico} control={control} laboratorios={[]} />
        </Recuadro>

        <Rejilla
          campos={grupos.general}
          control={control}
          laboratorios={laboratorios.data ?? []}
          tipo={tipo}
        />

        <Recuadro grupo="ubicacion" campos={grupos.ubicacion}>
          <Rejilla campos={grupos.ubicacion} control={control} laboratorios={[]} />
        </Recuadro>

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

function Rejilla({
  campos,
  control,
  laboratorios,
  tipo,
}: {
  campos: Campo[]
  control: ReturnType<typeof useForm<Valores>>['control']
  laboratorios: { id: number; nombre: string }[]
  tipo?: Enums<'clasificacion_articulo'>
}) {
  return (
    <Grid container spacing={2}>
      {campos.map((campo) => (
        <Grid key={campo.campo} size={anchoDe(campo)}>
          <CampoCaptura campo={campo} control={control} laboratorios={laboratorios} />
          {tipo !== undefined && campo.destino === 'articulo.nombre_canonico' ? (
            <Sugerencias campo={campo.campo} control={control} tipo={tipo} />
          ) : null}
        </Grid>
      ))}
    </Grid>
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

const RECUADROS: Record<
  Exclude<Grupo, 'general'>,
  { titulo: string; color: string; fondo: string }
> = {
  // Los mismos tonos que ya están razonados en `presentacion.ts`: el violeta de
  // `contaminado` para lo biológico y el guinda del tema para la ficha NOM.
  reactivo: { titulo: 'Ficha del reactivo — NOM-005-STPS', color: 'primary.main', fondo: 'primary' },
  biologico: { titulo: 'Materia biológica — campos especiales', color: '#7C3AED', fondo: 'bio' },
  ubicacion: { titulo: 'Ubicación en el almacén', color: 'text.secondary', fondo: 'neutro' },
}

function Recuadro({
  grupo,
  campos,
  children,
}: {
  grupo: Exclude<Grupo, 'general'>
  campos: Campo[]
  children: React.ReactNode
}) {
  if (campos.length === 0) return null
  const aspecto = RECUADROS[grupo]

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        // `color-mix` sobre el color del tema en vez de un hex: así el recuadro
        // sigue al modo oscuro sin declarar un par de colores por grupo.
        borderColor:
          aspecto.fondo === 'neutro'
            ? 'divider'
            : `color-mix(in srgb, ${resolver(aspecto.color)} 28%, transparent)`,
        bgcolor:
          aspecto.fondo === 'neutro'
            ? 'action.hover'
            : `color-mix(in srgb, ${resolver(aspecto.color)} 6%, transparent)`,
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: aspecto.color, fontWeight: 700, display: 'block', mb: 1.5 }}
      >
        {aspecto.titulo}
      </Typography>
      {children}
    </Box>
  )
}

/** `color-mix` necesita un color CSS; los tokens del tema no lo son. */
function resolver(color: string): string {
  return color === 'primary.main' ? 'var(--mui-palette-primary-main)' : color
}

/**
 * Cuánto ocupa cada campo. Los párrafos a lo ancho; el resto a media fila, que
 * es lo que da la retícula de dos columnas de la maqueta. En pantallas de ~1024
 * px —las de las máquinas del almacén— sigue siendo de dos columnas; solo se
 * apila en móvil.
 */
function anchoDe(campo: Campo): { xs: number; sm: number } {
  const anchoCompleto = campo.campo === 'observaciones' || campo.campo === 'especificacion'
  return anchoCompleto ? { xs: 12, sm: 12 } : { xs: 12, sm: 6 }
}

function agrupar(campos: Campo[]): Record<Grupo, Campo[]> {
  const grupos: Record<Grupo, Campo[]> = {
    reactivo: [],
    biologico: [],
    ubicacion: [],
    general: [],
  }
  // El orden dentro de cada grupo es el de `orden`, que ya viene aplicado desde
  // la base: `formulario()` ordena por él.
  for (const campo of campos) grupos[grupoDe(campo)].push(campo)
  return grupos
}

/**
 * Lo que sale del `error` de supabase-js. Los mensajes de Postgres que llegan
 * aquí son los que el propio esquema escribió para que se lean —«El renglon no
 * trae unidad...»— así que se muestran tal cual en vez de taparlos con un «algo
 * salió mal» que no dice qué corregir.
 */
function mensajeDe(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Vuelve a intentarlo.'
}
