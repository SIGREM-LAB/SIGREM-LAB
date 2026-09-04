import { Icon } from '@iconify/react'
import { Alert, Button, Card, CardContent, Grid, Snackbar, Stack, Typography } from '@mui/material'
import { useState } from 'react'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { AgregarProductos } from './AgregarProductos'
import { restaurarBorrador, serializarBorrador, type CabeceraParcial } from './borrador'
import {
  mensajeDeError,
  useAsignaturasDeSemestre,
  useBorrador,
  useBorrarBorrador,
  useBuscarExistencias,
  useGuardarBorrador,
  useLaboratorios,
  useMotivos,
  usePracticasDeAsignatura,
  useProgramas,
  useRegistrarPractica,
  useSemestresDePrograma,
} from './consultas'
import { DatosPractica } from './DatosPractica'
import { DialogoBuscar } from './DialogoBuscar'
import {
  aPayloadElementos,
  elementoDesdeExistencia,
  esquemaCabecera,
  estaCompleto,
  type ElementoCaptura,
  type FilaUtilizable,
} from './esquemas'
import { PanelControl } from './PanelControl'
import { TablaProductos } from './TablaProductos'

/** La fecha de hoy en el formato que espera un `<input type="date">`. */
function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

type Aviso = { tipo: 'success' | 'error' | 'info'; texto: string }

export function PaginaPracticas() {
  const [cabecera, setCabecera] = useState<CabeceraParcial>({ fecha: hoy() })
  const [elementos, setElementos] = useState<ElementoCaptura[]>([])
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [termino, setTermino] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [borradorAtendido, setBorradorAtendido] = useState(false)

  const programas = useProgramas()
  const semestres = useSemestresDePrograma(cabecera.programaId ?? null)
  const asignaturas = useAsignaturasDeSemestre(
    cabecera.programaId ?? null,
    cabecera.semestre ?? null,
  )
  const practicas = usePracticasDeAsignatura(cabecera.asignaturaId ?? null)
  const laboratorios = useLaboratorios()
  const motivos = useMotivos()
  const existencias = useBuscarExistencias(termino)
  const borrador = useBorrador()

  const guardar = useGuardarBorrador()
  const borrar = useBorrarBorrador()
  const registrar = useRegistrarPractica()

  const elemento = elementos.find((e) => e.existenciaId === seleccionado) ?? null
  const hayAlgo = elementos.length > 0 || cabecera.programaId !== undefined
  const todosCompletos = elementos.length > 0 && elementos.every(estaCompleto)
  const cabeceraValida = esquemaCabecera.safeParse(cabecera).success

  // Restaurar el borrador guardado. Se ofrece una vez y no se aplica solo: pisar
  // en silencio lo que alguien acaba de empezar a capturar sería peor que no
  // tener borrador.
  const hayBorrador = borrador.data !== null && borrador.data !== undefined
  const mostrarRestaurar = hayBorrador && !borradorAtendido && elementos.length === 0

  function restaurar() {
    setBorradorAtendido(true)
    const contenido = restaurarBorrador(borrador.data?.contenido)

    if (contenido === null) {
      // Un borrador de otra versión se descarta entero: media captura
      // restaurada es peor que ninguna, porque quien la ve no sabe qué falta.
      setAviso({
        tipo: 'info',
        texto: 'El borrador guardado es de una versión anterior y no se pudo recuperar',
      })
      borrar.mutate()
      return
    }

    setCabecera(contenido.cabecera)
    setElementos(contenido.elementos)
    setSeleccionado(contenido.elementos[0]?.existenciaId ?? null)
  }

  function agregar(fila: FilaUtilizable) {
    if (elementos.some((e) => e.existenciaId === fila.id)) return
    const nuevo = elementoDesdeExistencia(fila)
    setElementos([...elementos, nuevo])
    setSeleccionado(nuevo.existenciaId)
  }

  function quitar(existenciaId: number) {
    setElementos(elementos.filter((e) => e.existenciaId !== existenciaId))
    if (seleccionado === existenciaId) setSeleccionado(null)
  }

  function cambiarElemento(parcial: Partial<ElementoCaptura>) {
    setElementos(elementos.map((e) => (e.existenciaId === seleccionado ? { ...e, ...parcial } : e)))
  }

  function alGuardarBorrador() {
    setBorradorAtendido(true)
    guardar.mutate(serializarBorrador(cabecera, elementos), {
      onSuccess: () => setAviso({ tipo: 'success', texto: 'Borrador guardado' }),
      onError: (error) => setAviso({ tipo: 'error', texto: mensajeDeError(error) }),
    })
  }

  function finalizar() {
    const validada = esquemaCabecera.safeParse(cabecera)
    if (!validada.success) {
      setAviso({ tipo: 'error', texto: validada.error.issues[0].message })
      return
    }

    registrar.mutate(
      { cabecera: validada.data, elementos: aPayloadElementos(elementos) },
      {
        onSuccess: (folio) => {
          // El folio es lo único que la pantalla no podía saber antes de
          // guardar: lo asigna el trigger.
          setAviso({ tipo: 'success', texto: `Práctica ${folio} registrada` })
          setCabecera({ fecha: hoy() })
          setElementos([])
          setSeleccionado(null)
          // El borrador ya cumplió. Si esto falla no importa: la práctica ya está.
          borrar.mutate()
        },
        // Si falla, la captura NO se limpia: el trabajo no se pierde por un
        // error de red ni por un 42501.
        onError: (error) => setAviso({ tipo: 'error', texto: mensajeDeError(error) }),
      },
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Registro de práctica"
        descripcion="Captura de uso de reactivos, materiales y equipos"
        acciones={
          <>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<Icon icon="mdi:content-save-outline" />}
              onClick={alGuardarBorrador}
              disabled={!hayAlgo || guardar.isPending}
            >
              Guardar borrador
            </Button>
            <Button
              variant="contained"
              startIcon={<Icon icon="mdi:send-outline" />}
              onClick={finalizar}
              disabled={!todosCompletos || !cabeceraValida || registrar.isPending}
            >
              Finalizar práctica
            </Button>
          </>
        }
      />

      <CuerpoPagina>
        {mostrarRestaurar ? (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <>
                <Button size="small" onClick={restaurar}>
                  Recuperar
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setBorradorAtendido(true)
                    borrar.mutate()
                  }}
                >
                  Descartar
                </Button>
              </>
            }
          >
            Tienes una práctica a medio capturar
          </Alert>
        ) : null}

        <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                    Datos de la práctica
                  </Typography>
                  <DatosPractica
                    valores={cabecera}
                    onCambiar={(parcial) => setCabecera({ ...cabecera, ...parcial })}
                    programas={programas.data ?? []}
                    semestres={semestres.data ?? []}
                    asignaturas={asignaturas.data ?? []}
                    practicas={practicas.data ?? []}
                    laboratorios={laboratorios.data ?? []}
                    deshabilitado={registrar.isPending}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                    Agregar productos
                  </Typography>
                  <AgregarProductos
                    onBuscar={() => setBuscando(true)}
                    // Sin laboratorio no hay almacén, y la búsqueda sale
                    // filtrada por almacén.
                    deshabilitado={cabecera.laboratorioId === undefined || registrar.isPending}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <TablaProductos
                    elementos={elementos}
                    seleccionado={seleccionado}
                    onElegir={setSeleccionado}
                    onQuitar={quitar}
                  />
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* sticky para que el panel siga a la vista mientras se recorre una
              tabla larga: capturar obliga a mirar los dos lados. */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <CardContent>
                <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                  Panel de control
                </Typography>
                <PanelControl
                  elemento={elemento}
                  motivos={motivos.data ?? []}
                  onCambiar={cambiarElemento}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </CuerpoPagina>

      <DialogoBuscar
        abierto={buscando}
        termino={termino}
        onTermino={setTermino}
        filas={existencias.data ?? []}
        cargando={existencias.isPending}
        yaAgregados={elementos.map((e) => e.existenciaId)}
        onAgregar={agregar}
        onCerrar={() => setBuscando(false)}
      />

      <Snackbar
        open={aviso !== null}
        autoHideDuration={6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={aviso?.tipo ?? 'info'} onClose={() => setAviso(null)}>
          {aviso?.texto}
        </Alert>
      </Snackbar>
    </>
  )
}
