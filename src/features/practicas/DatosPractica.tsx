import { FormControl, Grid, InputLabel, MenuItem, Select, TextField } from '@mui/material'

import { etiquetaSemestre } from '@/features/academico/semestres'
import type { CabeceraParcial } from './borrador'
import type { Asignatura, Laboratorio, PracticaCatalogo, Programa } from './consultas'

type Props = {
  valores: CabeceraParcial
  /** Recibe sólo lo que cambió, ya con los de abajo limpiados. */
  onCambiar: (parcial: CabeceraParcial) => void
  programas: Programa[]
  semestres: (number | null)[]
  asignaturas: Asignatura[]
  practicas: PracticaCatalogo[]
  laboratorios: Laboratorio[]
  deshabilitado: boolean
}

/**
 * `null` no viaja en un `<Select>` de MUI: su `value` es una cadena. La
 * optativa se representa con este centinela, que nunca es un semestre real.
 */
const OPTATIVA = 'optativa'

export function DatosPractica({
  valores,
  onCambiar,
  programas,
  semestres,
  asignaturas,
  practicas,
  laboratorios,
  deshabilitado,
}: Props) {
  const sinPrograma = valores.programaId === undefined
  const sinSemestre = valores.semestre === undefined
  const sinAsignatura = valores.asignaturaId === undefined

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado}>
          <InputLabel id="rot-programa">Programa educativo</InputLabel>
          <Select
            labelId="rot-programa"
            label="Programa educativo"
            value={valores.programaId ?? ''}
            // Elegir otro programa TIENE que limpiar lo de abajo. El prototipo
            // lo parcheaba a mano en cada onChange; aquí está en un solo sitio y
            // con prueba.
            onChange={(e) =>
              onCambiar({
                programaId: Number(e.target.value),
                semestre: undefined,
                asignaturaId: undefined,
                practicaCatalogoId: undefined,
              })
            }
          >
            {programas.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado || sinPrograma}>
          <InputLabel id="rot-semestre">Semestre</InputLabel>
          <Select
            labelId="rot-semestre"
            label="Semestre"
            value={valores.semestre === undefined ? '' : (valores.semestre ?? OPTATIVA)}
            onChange={(e) =>
              onCambiar({
                semestre: e.target.value === OPTATIVA ? null : Number(e.target.value),
                asignaturaId: undefined,
                practicaCatalogoId: undefined,
              })
            }
          >
            {semestres.map((s) => (
              <MenuItem key={s ?? OPTATIVA} value={s ?? OPTATIVA}>
                {etiquetaSemestre(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado || sinPrograma || sinSemestre}>
          <InputLabel id="rot-asignatura">Asignatura</InputLabel>
          <Select
            labelId="rot-asignatura"
            label="Asignatura"
            value={valores.asignaturaId ?? ''}
            onChange={(e) =>
              onCambiar({
                asignaturaId: Number(e.target.value),
                practicaCatalogoId: undefined,
              })
            }
          >
            {asignaturas.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* El selector del catálogo, NO el folio. El folio (PRA-0001) lo asigna el
          trigger y sólo se conoce al finalizar; se muestra en el aviso de éxito. */}
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado || sinAsignatura}>
          <InputLabel id="rot-practica">Número de práctica</InputLabel>
          <Select
            labelId="rot-practica"
            label="Número de práctica"
            value={valores.practicaCatalogoId ?? ''}
            onChange={(e) => onCambiar({ practicaCatalogoId: Number(e.target.value) })}
          >
            {practicas.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {`Práctica ${p.numero} — ${p.nombre}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* No depende de la cascada y no puede ser "Todas": practica.laboratorio_id
          es NOT NULL y de él sale el almacen_id de la práctica, que es de dónde
          se descuenta y el ancla de toda la RLS. La lista ya viene filtrada al
          almacén de quien captura. */}
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado}>
          <InputLabel id="rot-laboratorio">Laboratorio</InputLabel>
          <Select
            labelId="rot-laboratorio"
            label="Laboratorio"
            value={valores.laboratorioId ?? ''}
            onChange={(e) => onCambiar({ laboratorioId: Number(e.target.value) })}
          >
            {laboratorios.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {`${l.nombre} · ${l.almacenClave}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          type="date"
          label="Fecha"
          value={valores.fecha ?? ''}
          disabled={deshabilitado}
          onChange={(e) => onCambiar({ fecha: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Grid>
    </Grid>
  )
}
