import { Icon } from '@iconify/react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

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

/** Lo que `restaurarBorrador` devuelve cuando el borrador se entiende. */
type Restaurado = NonNullable<ReturnType<typeof restaurarBorrador>>

function Captura({ inicial }: { inicial: Restaurado | null }) {
  const navegar = useNavigate()
  const [cabecera, setCabecera] = useState<CabeceraParcial>(inicial?.cabecera ?? { fecha: hoy() })
  const [elementos, setElementos] = useState<ElementoCaptura[]>(inicial?.elementos ?? [])
  const [seleccionado, setSeleccionado] = useState<number | null>(
    inicial?.elementos[0]?.existenciaId ?? null,
  )
  const [buscando, setBuscando] = useState(false)
  const [termino, setTermino] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)

  const programas = useProgramas()
  const semestres = useSemestresDePrograma(cabecera.programaId ?? null)
  const asignaturas = useAsignaturasDeSemestre(
    cabecera.programaId ?? null,
    cabecera.semestre ?? null,
  )
  const practicas = usePracticasDeAsignatura(cabecera.asignaturaId ?? null)
  const laboratorios = useLaboratorios()
  const motivos = useMotivos()
  const existencias = useBuscarExistencias(termino, buscando)

  const guardar = useGuardarBorrador()
  const borrar = useBorrarBorrador()
  const registrar = useRegistrarPractica()

  const elemento = elementos.find((e) => e.existenciaId === seleccionado) ?? null
  const hayAlgo = elementos.length > 0 || cabecera.programaId !== undefined
  const todosCompletos = elementos.length > 0 && elementos.every(estaCompleto)
  const cabeceraValida = esquemaCabecera.safeParse(cabecera).success

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
    // Los nombres se resuelven contra los catálogos ya cargados y no se
    // arrastran del borrador anterior: si alguien cambió de asignatura y el
    // catálogo todavía no llega, un nulo es honesto y el nombre viejo sería
    // mentira. El renglón "En curso" muestra "—" hasta el siguiente guardado.
    const nombres = {
      asignatura: asignaturas.data?.find((a) => a.id === cabecera.asignaturaId)?.nombre ?? null,
      laboratorio: laboratorios.data?.find((l) => l.id === cabecera.laboratorioId)?.nombre ?? null,
    }

    guardar.mutate(serializarBorrador(cabecera, nombres, elementos), {
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
          // El borrador ya cumplió. Si esto falla no importa: la práctica ya está.
          borrar.mutate()
          // Se vuelve al listado, donde la práctica recién registrada ya es un
          // renglón "Finalizada" con su folio. El folio es lo único que esta
          // pantalla no podía saber antes de guardar: lo asigna el trigger, y
          // viaja en el estado de la navegación para anunciarlo allá.
          navegar('/practicas', { replace: true, state: { folio } })
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
              variant="text"
              color="secondary"
              startIcon={<Icon icon="mdi:arrow-left" />}
              onClick={() => navegar('/practicas')}
            >
              Volver
            </Button>
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
        filas={existencias.filas}
        cargando={existencias.cargando}
        error={existencias.error}
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

/**
 * Espera a saber si hay borrador y, sólo entonces, monta la captura con él
 * dentro.
 *
 * Es lo que evita el efecto que rellenaba el formulario después de montarlo:
 * `useState` sólo lee su valor inicial al montar, así que restaurar «después»
 * obligaba a un setState dentro de un efecto —renders en cascada, y un parpadeo
 * de formulario vacío antes de que llegara el borrador—. Naciendo con los
 * valores no hay ni una cosa ni la otra.
 *
 * El diálogo de «¿lo recuperas?» ya no existe: sólo se llega aquí por
 * "Continuar", que quiere el borrador, o por "Registrar práctica", que sólo se
 * ofrece cuando no hay ninguno. En los dos casos preguntar sobra.
 *
 * Un borrador que no se entiende entra como `null` —captura limpia— y se queda
 * guardado hasta que el siguiente guardado lo pise. Quien tenga que enterarse
 * es el listado, que es donde se ve que existe.
 */
export function PaginaNuevaPractica() {
  const borrador = useBorrador()

  if (borrador.data === undefined) {
    return (
      <CuerpoPagina>
        <Skeleton variant="rounded" height={320} />
      </CuerpoPagina>
    )
  }

  return <Captura inicial={restaurarBorrador(borrador.data?.contenido)} />
}
