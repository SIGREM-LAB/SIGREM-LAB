import type { ReactNode } from 'react'
import { Box, Grid, Stack, TextField, Typography } from '@mui/material'
import type { Control } from 'react-hook-form'

import { CampoCaptura } from './CampoCaptura'
import { grupoDe, textoDeValor, type Campo, type Grupo, type Valores } from './campos'

type Props = {
  /** Los campos que devolvió `formulario()`, ya sin los que no se pintan. */
  campos: Campo[]
  control: Control<Valores>
  /** Los laboratorios del almacén, para el único campo que no trae sus opciones. */
  laboratorios: { id: number; nombre: string }[]

  /**
   * Qué campos se muestran pero no se editan. En el alta no hay ninguno; en la
   * edición son los del artículo, que se comparte con los demás frascos.
   * Su valor sale de `valores`, no del formulario: no están en el estado.
   */
  soloLectura?: (campo: Campo) => boolean
  valores?: Record<string, unknown>
  /** La razón, una sola para todos, que se escribe bajo cada campo bloqueado. */
  ayudaSoloLectura?: string

  /** Lo que va debajo de un campo concreto. El alta cuelga aquí las sugerencias. */
  debajoDe?: (campo: Campo) => ReactNode
}

/**
 * Los campos del perfil, repartidos en sus recuadros.
 *
 * Lo comparten el alta y la edición: los dos pintan la misma lista que devolvió
 * `formulario(almacen, clasificacion)` y ninguno de los dos decide qué campos
 * son. Vive aparte de los dos diálogos porque duplicarlo era la vía directa a
 * que un recuadro nuevo apareciera solo en una de las dos pantallas.
 */
export function FormularioPerfil({
  campos,
  control,
  laboratorios,
  soloLectura,
  valores,
  ayudaSoloLectura,
  debajoDe,
}: Props) {
  const grupos = agrupar(campos)

  const rejilla = (delGrupo: Campo[]) => (
    <Grid container spacing={2}>
      {delGrupo.map((campo) => (
        <Grid key={campo.campo} size={anchoDe(campo)}>
          {soloLectura !== undefined && soloLectura(campo) ? (
            <TextField
              fullWidth
              size="small"
              disabled
              label={campo.etiqueta}
              value={textoDeValor(campo, valores?.[campo.campo])}
              helperText={ayudaSoloLectura ?? ' '}
            />
          ) : (
            <CampoCaptura campo={campo} control={control} laboratorios={laboratorios} />
          )}
          {debajoDe?.(campo)}
        </Grid>
      ))}
    </Grid>
  )

  return (
    <Stack spacing={2.5}>
      {/* Los campos de la ficha del artículo van primero y en su propio
          recuadro: son lo que distingue una sustancia de otra, y el resto del
          formulario describe el frasco. El recuadro sale del prefijo de
          `destino`, no de una lista de clasificaciones escrita aquí. */}
      <Recuadro grupo="reactivo" campos={grupos.reactivo}>
        {rejilla(grupos.reactivo)}
      </Recuadro>

      <Recuadro grupo="biologico" campos={grupos.biologico}>
        {rejilla(grupos.biologico)}
      </Recuadro>

      {rejilla(grupos.general)}

      <Recuadro grupo="ubicacion" campos={grupos.ubicacion}>
        {rejilla(grupos.ubicacion)}
      </Recuadro>
    </Stack>
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
  children: ReactNode
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
