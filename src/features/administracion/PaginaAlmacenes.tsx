import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Alert, Button, FormControlLabel, Grid, Snackbar, Stack, Switch } from '@mui/material'

import { ColumnaAcademica } from '@/features/academico/ColumnaAcademica'
import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { DialogoLaboratorio } from './DialogoLaboratorio'
import { FichaAlmacen } from './FichaAlmacen'
import { ListaAlmacenes } from './ListaAlmacenes'
import { ListaLaboratorios } from './ListaLaboratorios'
import {
  mensajeDeError,
  useAlmacenes,
  useCrearLaboratorio,
  useGuardarFichaAlmacen,
  useLaboratoriosDeAlmacen,
  useRenombrarLaboratorio,
  useRetirarLaboratorio,
  type Laboratorio,
} from './consultas'

/** Qué diálogo está abierto y sobre qué fila. */
type Dialogo = { laboratorio?: Laboratorio } | null

/**
 * Almacenes y laboratorios.
 *
 * El almacén es el sujeto y los laboratorios cuelgan de él, no al revés: un
 * laboratorio no existe sin su almacén —es la FK compuesta de `existencia`— y
 * una pantalla de laboratorios suelta necesitaría igual un selector de almacén
 * arriba, o sea dibujarlo dos veces.
 */
export function PaginaAlmacenes() {
  const { data: perfil } = usePerfil()
  const almacenes = useAlmacenes()

  const [elegido, setElegido] = useState<number | null>(null)
  const [verRetirados, setVerRetirados] = useState(false)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Tener almacén y ser responsable son lo mismo desde
  // 20260909130000_almacen_solo_responsable.sql, así que esto es «soy
  // responsable» dicho con el dato que hace falta después.
  const propio = perfil?.almacen?.id ?? null

  // El responsable ve sólo el suyo. No es seguridad —`almacen_lectura` deja
  // leer los cinco— es no enseñarle cuatro fichas que no puede tocar.
  const visibles = (almacenes.data ?? []).filter((a) => propio === null || a.id === propio)

  const almacen = visibles.find((a) => a.id === (elegido ?? visibles[0]?.id)) ?? null
  const puedeEditar = perfil?.rol === 'admin' || (almacen !== null && almacen.id === propio)

  const laboratorios = useLaboratoriosDeAlmacen(almacen?.id ?? null, verRetirados)

  const guardarFicha = useGuardarFichaAlmacen()
  const crear = useCrearLaboratorio()
  const renombrar = useRenombrarLaboratorio()
  const retirar = useRetirarLaboratorio()

  /** Todas las mutaciones fallan igual: aviso en español y el diálogo se queda. */
  function alFallar(error: unknown) {
    setAviso(mensajeDeError(error))
  }

  function guardarLaboratorio(nombre: string) {
    if (almacen === null) return

    const alTerminar = { onSuccess: () => setDialogo(null), onError: alFallar }

    if (dialogo?.laboratorio === undefined) {
      crear.mutate({ almacenId: almacen.id, nombre }, alTerminar)
    } else {
      renombrar.mutate({ id: dialogo.laboratorio.id, nombre }, alTerminar)
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Almacenes y laboratorios"
        descripcion="Los datos del almacén y los laboratorios a los que surte"
        padre={{ etiqueta: 'Administración', ruta: '/administracion' }}
        acciones={
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={verRetirados}
                onChange={(e) => setVerRetirados(e.target.checked)}
              />
            }
            label="Ver retirados"
            slotProps={{ typography: { sx: { fontSize: '0.85rem' } } }}
          />
        }
      />

      <CuerpoPagina>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColumnaAcademica
              titulo="Almacenes"
              cargando={almacenes.isPending}
              vacio="No hay almacenes que mostrar."
            >
              {visibles.length === 0 ? null : (
                <ListaAlmacenes
                  almacenes={visibles}
                  seleccionado={almacen?.id ?? null}
                  onElegir={setElegido}
                />
              )}
            </ColumnaAcademica>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            {almacen === null ? null : (
              <Stack spacing={2}>
                <FichaAlmacen
                  almacen={almacen}
                  puedeEditar={puedeEditar}
                  guardando={guardarFicha.isPending}
                  onGuardar={(valores) =>
                    guardarFicha.mutate({ id: almacen.id, ...valores }, { onError: alFallar })
                  }
                />

                <ColumnaAcademica
                  titulo="Laboratorios"
                  subtitulo={almacen.clave}
                  cargando={laboratorios.isPending}
                  vacio="Este almacén todavía no tiene laboratorios."
                  acciones={
                    puedeEditar ? (
                      <Button
                        size="small"
                        startIcon={<Icon icon="mdi:plus" width={16} />}
                        onClick={() => setDialogo({})}
                      >
                        Laboratorio
                      </Button>
                    ) : undefined
                  }
                >
                  {laboratorios.data === undefined || laboratorios.data.length === 0 ? null : (
                    <ListaLaboratorios
                      laboratorios={laboratorios.data}
                      puedeEditar={puedeEditar}
                      onEditar={(laboratorio) => setDialogo({ laboratorio })}
                      onRetirar={(laboratorio) =>
                        retirar.mutate(
                          { id: laboratorio.id, activo: !laboratorio.activo },
                          { onError: alFallar },
                        )
                      }
                    />
                  )}
                </ColumnaAcademica>
              </Stack>
            )}
          </Grid>
        </Grid>
      </CuerpoPagina>

      <DialogoLaboratorio
        abierto={dialogo !== null}
        almacen={almacen?.clave ?? ''}
        inicial={dialogo?.laboratorio}
        guardando={crear.isPending || renombrar.isPending}
        onGuardar={(valores) => guardarLaboratorio(valores.nombre)}
        onCerrar={() => setDialogo(null)}
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
