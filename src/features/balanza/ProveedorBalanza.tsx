import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  crearTransporteWebSerial,
  ErrorBalanza,
  parsearTramaOptika,
  type FalloBalanza,
  type LecturaBalanza,
  type TransporteBalanza,
} from './balanza'
import { ContextoBalanza, type EstadoBalanza, type ValorBalanza } from './contextoBalanza'

/** Cuanto se espera a que el peso se fije antes de rendirse. */
const ESPERA_ESTABLE_MS = 5000
/** Cada cuanto se revisa la ultima lectura mientras se espera. */
const SONDA_MS = 100

/**
 * Conecta una vez y comparte la balanza con toda la app.
 *
 * Va montado arriba del enrutador para que la conexion no se caiga al cambiar
 * de producto ni de pantalla: el puerto se abre con un clic y dura hasta que se
 * cierra o se recarga.
 *
 * `crearTransporte` se inyecta en las pruebas con un doble, igual que
 * `ProveedorSesion` recibe su `auth`.
 */
export function ProveedorBalanza({
  crearTransporte = crearTransporteWebSerial,
  children,
}: {
  crearTransporte?: () => TransporteBalanza
  children: ReactNode
}) {
  const transporte = useMemo(() => crearTransporte(), [crearTransporte])

  const [estado, setEstado] = useState<EstadoBalanza>('desconectada')
  const [lectura, setLectura] = useState<LecturaBalanza | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fallo, setFallo] = useState<FalloBalanza | null>(null)

  const abortar = useRef<AbortController | null>(null)
  // Numerada: `capturar` necesita distinguir una trama nueva de la de hace un
  // rato, y el numero es lo unico que no depende del reloj.
  const ultima = useRef<{ lectura: LecturaBalanza; n: number } | null>(null)

  const desconectar = useCallback(async () => {
    abortar.current?.abort()
    abortar.current = null
    ultima.current = null
    await transporte.desconectar()
    setLectura(null)
    setFallo(null)
    setEstado('desconectada')
  }, [transporte])

  const conectar = useCallback(async (sinFiltro = false) => {
    setEstado('conectando')
    setError(null)
    setFallo(null)

    try {
      await transporte.conectar(sinFiltro)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la balanza')
      setFallo(e instanceof ErrorBalanza ? e.caso : 'desconocido')
      setEstado('error')
      // Se relanza para que quien llamó —un botón de campo— pueda decir qué
      // pasó. El estado y el mensaje ya quedaron puestos para el resto de la
      // pantalla, así que la barra también lo muestra.
      throw e
    }

    const control = new AbortController()
    abortar.current = control
    setEstado('conectada')

    void (async () => {
      try {
        for await (const trama of transporte.tramas(control.signal)) {
          const nueva = parsearTramaOptika(trama)
          if (nueva === null) continue
          ultima.current = { lectura: nueva, n: (ultima.current?.n ?? 0) + 1 }

          // En continuo llegan ~10 tramas por segundo. Devolver el mismo objeto
          // cuando nada cambio hace que React no vuelva a pintar por trama.
          setLectura((anterior) =>
            anterior !== null &&
            anterior.valor === nueva.valor &&
            anterior.unidad === nueva.unidad &&
            anterior.estable === nueva.estable
              ? anterior
              : nueva,
          )
        }
      } catch {
        // El flujo se rompio. Termina igual que si se hubiera acabado, y lo
        // que sigue decide si eso fue a proposito o no.
      }

      // Llegar aqui sin que nadie haya abortado significa que el puerto se
      // murio solo: se desenchufo el cable o se apago la balanza. Sin esto la
      // pantalla se queda en «conectada» con el ultimo peso congelado, y
      // `capturar` lo sigue entregando como si fuera de ahora.
      if (control.signal.aborted) return
      if (abortar.current === control) abortar.current = null
      ultima.current = null
      await transporte.desconectar()
      setLectura(null)
      setError('Se perdió la conexión con la balanza. Revisa el cable y vuelve a conectar.')
      // Ya no hay puerto, que es el mismo caso que no encontrarlo. La primera
      // linea del dialogo de preparacion —revisa el cable— es justo la que toca.
      setFallo('sin-puerto')
      setEstado('error')
    })()
  }, [transporte])

  const capturar = useCallback(async () => {
    // Solo cuenta una trama llegada DESPUES de pedirla. Sin esa condicion, la
    // ultima lectura estable se queda en memoria y se devuelve al instante
    // aunque sea de antes de poner la muestra —o de antes de que se aflojara
    // el cable—: un numero creible, y el que no es. En continuo llegan ~10 por
    // segundo, asi que la espera real es de milisegundos.
    const desde = ultima.current?.n ?? 0
    const limite = Date.now() + ESPERA_ESTABLE_MS
    while (Date.now() < limite) {
      const actual = ultima.current
      if (actual !== null && actual.n > desde && actual.lectura.estable) return actual.lectura
      await new Promise((listo) => setTimeout(listo, SONDA_MS))
    }
    return null
  }, [])

  // Al desmontar se suelta el puerto: sin esto queda abierto y la siguiente
  // conexion lo encuentra ocupado.
  useEffect(
    () => () => {
      abortar.current?.abort()
      void transporte.desconectar()
    },
    [transporte],
  )

  const valor: ValorBalanza = {
    estado,
    soportado: transporte.soportado,
    lectura,
    error,
    fallo,
    conectar,
    desconectar,
    capturar,
  }

  return <ContextoBalanza.Provider value={valor}>{children}</ContextoBalanza.Provider>
}
