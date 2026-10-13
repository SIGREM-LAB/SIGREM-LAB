import { useEffect, useRef } from 'react'

import { interpretarTecla, RAFAGA_VACIA, type Rafaga } from './codigo'

/** Si el foco está donde se escribe, la pistola teclea ahí y no se le roba. */
function escribiendoEnUnCampo(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) return false
  if (objetivo.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(objetivo.tagName)
}

/**
 * Escucha la pistola lectora en toda la pantalla y llama a `onCodigo` cuando
 * llega un escaneo completo. Se monta una sola vez, en `Layout`.
 *
 * Es una suscripción a un evento del navegador, no una lectura de datos: por eso
 * va en `useEffect` y no en TanStack Query.
 */
export function useLectorCodigo(onCodigo: (codigo: string) => void) {
  // En un ref para no volver a suscribirse cada vez que cambia el callback.
  const alLeer = useRef(onCodigo)
  useEffect(() => {
    alLeer.current = onCodigo
  }, [onCodigo])

  useEffect(() => {
    let rafaga: Rafaga = RAFAGA_VACIA

    function alTeclear(evento: KeyboardEvent) {
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return
      if (escribiendoEnUnCampo(evento.target)) {
        rafaga = RAFAGA_VACIA
        return
      }

      const r = interpretarTecla(rafaga, evento.key, evento.timeStamp)
      rafaga = r.rafaga
      if (r.codigo !== null) {
        // El Enter de la pistola no debe además pulsar el botón que tenga el foco.
        evento.preventDefault()
        alLeer.current(r.codigo)
      }
    }

    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [])
}
