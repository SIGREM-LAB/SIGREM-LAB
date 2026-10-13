import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Alert, Button, FormControlLabel, Grid, Snackbar, Switch } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { ColumnaAcademica } from '@/features/academico/ColumnaAcademica'
import { DialogoMotivo } from './DialogoMotivo'
import { ListaMotivos } from './ListaMotivos'
import {
  mensajeDeError,
  useCrearMotivo,
  useEditarMotivo,
  useMotivos,
  useRetirarMotivo,
  type Motivo,
} from './consultas'
import type { ValoresMotivo } from './esquemas'

/** Qué diálogo está abierto y sobre qué fila. */
type Dialogo = { motivo?: Motivo } | null

/** Motivos de observación: el catálogo que ofrece Prácticas al cerrar un elemento. */
export function PaginaMotivos() {
  const [verRetirados, setVerRetirados] = useState(false)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const motivos = useMotivos(verRetirados)
  const crear = useCrearMotivo()
  const editar = useEditarMotivo()
  const retirar = useRetirarMotivo()

  function alFallar(error: unknown) {
    setAviso(mensajeDeError(error))
  }

  function guardar(valores: ValoresMotivo) {
    const alTerminar = { onSuccess: () => setDialogo(null), onError: alFallar }
    if (dialogo?.motivo === undefined) crear.mutate(valores, alTerminar)
    else editar.mutate(valores, alTerminar)
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Motivos de observación"
        descripcion="Lo que se puede anotar al cerrar un elemento de una práctica"
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
          <Grid size={{ xs: 12, md: 6 }}>
            <ColumnaAcademica
              titulo="Motivos"
              cargando={motivos.isPending}
              vacio="Todavía no hay motivos."
              acciones={
                <Button
                  size="small"
                  startIcon={<Icon icon="mdi:plus" width={16} />}
                  onClick={() => setDialogo({})}
                >
                  Motivo
                </Button>
              }
            >
              {motivos.data === undefined || motivos.data.length === 0 ? null : (
                <ListaMotivos
                  motivos={motivos.data}
                  onEditar={(motivo) => setDialogo({ motivo })}
                  onRetirar={(motivo) =>
                    retirar.mutate(
                      { clave: motivo.clave, activo: !motivo.activo },
                      { onError: alFallar },
                    )
                  }
                />
              )}
            </ColumnaAcademica>
          </Grid>
        </Grid>
      </CuerpoPagina>

      <DialogoMotivo
        abierto={dialogo !== null}
        inicial={
          dialogo?.motivo
            ? {
                clave: dialogo.motivo.clave,
                etiqueta: dialogo.motivo.etiqueta,
                orden: dialogo.motivo.orden,
                metodos: dialogo.motivo.metodos,
              }
            : undefined
        }
        guardando={crear.isPending || editar.isPending}
        onGuardar={guardar}
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
