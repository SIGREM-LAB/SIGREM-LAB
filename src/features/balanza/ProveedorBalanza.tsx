import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  crearTransporteWebSerial,
  parsearTramaOptika,
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

  const abortar = useRef<AbortController | null>(null)
  const ultima = useRef<LecturaBalanza | null>(null)

  const desconectar = useCallback(async () => {
    abortar.current?.abort()
    abortar.current = null
    ultima.current = null
    await transporte.desconectar()
    setLectura(null)
    setEstado('desconectada')
  }, [transporte])

  const conectar = useCallback(async () => {
    setEstado('conectando')
    setError(null)

    try {
      await transporte.conectar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la balanza')
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
          ultima.current = nueva

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
        // El puerto se cerro o se aborto; `desconectar` ya dejo el estado.
      }
    })()
  }, [transporte])

  const capturar = useCallback(async () => {
    const limite = Date.now() + ESPERA_ESTABLE_MS
    while (Date.now() < limite) {
      const actual = ultima.current
      if (actual !== null && actual.estable) return actual
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
    conectar,
    desconectar,
    capturar,
  }

  return <ContextoBalanza.Provider value={valor}>{children}</ContextoBalanza.Provider>
}
