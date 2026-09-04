import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Alert, Button, FormControlLabel, Grid, Snackbar, Switch } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { ColumnaAcademica } from './ColumnaAcademica'
import { DialogoAsignatura } from './DialogoAsignatura'
import { DialogoPractica } from './DialogoPractica'
import { DialogoPrograma } from './DialogoPrograma'
import { ListaAsignaturas } from './ListaAsignaturas'
import { ListaPracticas } from './ListaPracticas'
import { ListaProgramas } from './ListaProgramas'
import {
  mensajeDeError,
  useAsignaturas,
  useAsignaturasDePrograma,
  useCambiarSemestre,
  useCrearPractica,
  useCrearPrograma,
  useDesvincularAsignatura,
  useEditarPractica,
  usePracticas,
  useProgramas,
  useRenombrarPrograma,
  useRetirarPractica,
  useRetirarPrograma,
  useVincularAsignatura,
  type AsignaturaVinculada,
  type PracticaCatalogo,
  type Programa,
} from './consultas'
import { elegirAsignatura, elegirPractica, elegirPrograma, SELECCION_VACIA } from './seleccion'

/** Qué diálogo está abierto y sobre qué fila. */
type Dialogo =
  | { tipo: 'programa'; programa?: Programa }
  | { tipo: 'asignatura'; asignatura?: AsignaturaVinculada }
  | { tipo: 'practica'; practica?: PracticaCatalogo }
  | null

export function PaginaAcademico() {
  const [seleccion, setSeleccion] = useState(SELECCION_VACIA)
  const [verRetiradas, setVerRetiradas] = useState(false)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const programas = useProgramas(verRetiradas)
  const asignaturas = useAsignaturasDePrograma(seleccion.programaId)
  const practicas = usePracticas(seleccion.asignaturaId, verRetiradas)
  const todasLasAsignaturas = useAsignaturas()

  const crearPrograma = useCrearPrograma()
  const renombrarPrograma = useRenombrarPrograma()
  const retirarPrograma = useRetirarPrograma()
  const vincular = useVincularAsignatura()
  const cambiarSemestre = useCambiarSemestre()
  const desvincular = useDesvincularAsignatura()
  const crearPractica = useCrearPractica()
  const editarPractica = useEditarPractica()
  const retirarPractica = useRetirarPractica()

  const programa = programas.data?.find((p) => p.id === seleccion.programaId) ?? null
  const asignatura =
    asignaturas.data?.find((a) => a.asignaturaId === seleccion.asignaturaId) ?? null

  // Las que este programa aún no tiene. Se filtra aquí y no en la consulta:
  // son decenas de filas y PostgREST no expresa bien un NOT IN (subconsulta).
  const yaVinculadas = new Set(asignaturas.data?.map((a) => a.asignaturaId) ?? [])
  const disponibles = (todasLasAsignaturas.data ?? []).filter((a) => !yaVinculadas.has(a.id))

  // Un número libre de salida, para no obligar a contar la lista a mano.
  const siguienteNumero = Math.max(0, ...(practicas.data?.map((p) => p.numero) ?? [])) + 1

  /** Todas las mutaciones fallan igual: aviso en español y el diálogo se queda. */
  function alFallar(error: unknown) {
    setAviso(mensajeDeError(error))
  }

  function cerrarDialogo() {
    setDialogo(null)
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Plan académico"
        descripcion="Programas, asignaturas y prácticas del plan de estudios"
        acciones={
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={verRetiradas}
                onChange={(e) => setVerRetiradas(e.target.checked)}
              />
            }
            label="Ver retiradas"
            slotProps={{ typography: { sx: { fontSize: '0.85rem' } } }}
          />
        }
      />

      <CuerpoPagina>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColumnaAcademica
              titulo="Programas"
              cargando={programas.isPending}
              vacio="Todavía no hay programas educativos."
              acciones={
                <Button
                  size="small"
                  startIcon={<Icon icon="mdi:plus" width={16} />}
                  onClick={() => setDialogo({ tipo: 'programa' })}
                >
                  Programa
                </Button>
              }
            >
              {programas.data === undefined || programas.data.length === 0 ? null : (
                <ListaProgramas
                  programas={programas.data}
                  seleccionado={seleccion.programaId}
                  onElegir={(id) => setSeleccion((s) => elegirPrograma(s, id))}
                  onEditar={(p) => setDialogo({ tipo: 'programa', programa: p })}
                  onRetirar={(p) =>
                    retirarPrograma.mutate({ id: p.id, activo: !p.activo }, { onError: alFallar })
                  }
                />
              )}
            </ColumnaAcademica>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <ColumnaAcademica
              titulo="Asignaturas"
              subtitulo={programa?.nombre}
              cargando={asignaturas.isPending && seleccion.programaId !== null}
              vacio={
                seleccion.programaId === null
                  ? 'Elige un programa para ver sus asignaturas.'
                  : 'Este programa todavía no tiene asignaturas.'
              }
              acciones={
                seleccion.programaId === null ? undefined : (
                  <Button
                    size="small"
                    startIcon={<Icon icon="mdi:plus" width={16} />}
                    onClick={() => setDialogo({ tipo: 'asignatura' })}
                  >
                    Asignatura
                  </Button>
                )
              }
            >
              {asignaturas.data === undefined || asignaturas.data.length === 0 ? null : (
                <ListaAsignaturas
                  asignaturas={asignaturas.data}
                  seleccionada={seleccion.asignaturaId}
                  onElegir={(id) => setSeleccion((s) => elegirAsignatura(s, id))}
                  onCambiarSemestre={(a) => setDialogo({ tipo: 'asignatura', asignatura: a })}
                  onDesvincular={(a) =>
                    desvincular.mutate(
                      { programaId: seleccion.programaId as number, asignaturaId: a.asignaturaId },
                      { onError: alFallar },
                    )
                  }
                />
              )}
            </ColumnaAcademica>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <ColumnaAcademica
              titulo="Prácticas"
              subtitulo={asignatura?.nombre}
              cargando={practicas.isPending && seleccion.asignaturaId !== null}
              vacio={
                seleccion.asignaturaId === null
                  ? 'Elige una asignatura para ver sus prácticas.'
                  : 'Esta asignatura todavía no tiene prácticas.'
              }
              acciones={
                seleccion.asignaturaId === null ? undefined : (
                  <Button
                    size="small"
                    startIcon={<Icon icon="mdi:plus" width={16} />}
                    onClick={() => setDialogo({ tipo: 'practica' })}
                  >
                    Práctica
                  </Button>
                )
              }
            >
              {practicas.data === undefined || practicas.data.length === 0 ? null : (
                <ListaPracticas
                  practicas={practicas.data}
                  seleccionada={seleccion.practicaId}
                  onEditar={(p) => {
                    setSeleccion((s) => elegirPractica(s, p.id))
                    setDialogo({ tipo: 'practica', practica: p })
                  }}
                  onRetirar={(p) =>
                    retirarPractica.mutate({ id: p.id, activo: !p.activo }, { onError: alFallar })
                  }
                />
              )}
            </ColumnaAcademica>
          </Grid>
        </Grid>
      </CuerpoPagina>

      <DialogoPrograma
        abierto={dialogo?.tipo === 'programa'}
        inicial={dialogo?.tipo === 'programa' ? dialogo.programa : undefined}
        guardando={crearPrograma.isPending || renombrarPrograma.isPending}
        onCerrar={cerrarDialogo}
        onGuardar={(v) => {
          const existente = dialogo?.tipo === 'programa' ? dialogo.programa : undefined
          const opciones = { onSuccess: cerrarDialogo, onError: alFallar }
          if (existente) renombrarPrograma.mutate({ id: existente.id, nombre: v.nombre }, opciones)
          else crearPrograma.mutate({ nombre: v.nombre }, opciones)
        }}
      />

      <DialogoAsignatura
        abierto={dialogo?.tipo === 'asignatura'}
        disponibles={disponibles}
        inicial={dialogo?.tipo === 'asignatura' ? dialogo.asignatura : undefined}
        guardando={vincular.isPending || cambiarSemestre.isPending}
        onCerrar={cerrarDialogo}
        onGuardar={(v) => {
          const existente = dialogo?.tipo === 'asignatura' ? dialogo.asignatura : undefined
          const opciones = { onSuccess: cerrarDialogo, onError: alFallar }
          if (existente) {
            cambiarSemestre.mutate(
              {
                programaId: seleccion.programaId as number,
                asignaturaId: existente.asignaturaId,
                semestre: v.semestre,
              },
              opciones,
            )
          } else {
            vincular.mutate(
              {
                programaId: seleccion.programaId as number,
                nombre: v.nombre,
                semestre: v.semestre,
              },
              opciones,
            )
          }
        }}
      />

      <DialogoPractica
        abierto={dialogo?.tipo === 'practica'}
        asignatura={asignatura?.nombre ?? ''}
        inicial={dialogo?.tipo === 'practica' ? dialogo.practica : undefined}
        siguienteNumero={siguienteNumero}
        guardando={crearPractica.isPending || editarPractica.isPending}
        onCerrar={cerrarDialogo}
        onGuardar={(v) => {
          const existente = dialogo?.tipo === 'practica' ? dialogo.practica : undefined
          const opciones = { onSuccess: cerrarDialogo, onError: alFallar }
          if (existente) {
            editarPractica.mutate(
              { id: existente.id, numero: v.numero, nombre: v.nombre },
              opciones,
            )
          } else {
            crearPractica.mutate(
              {
                asignaturaId: seleccion.asignaturaId as number,
                numero: v.numero,
                nombre: v.nombre,
              },
              opciones,
            )
          }
        }}
      />

      <Snackbar
        open={aviso !== null}
        autoHideDuration={6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      </Snackbar>
    </>
  )
}
