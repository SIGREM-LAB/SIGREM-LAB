import { useEffect, useState } from 'react'
import type { UseFormSetValue, UseFormWatch } from 'react-hook-form'

import { campoDeDensidad, camposDePeso, cantidadDesdePesos, type Campo, type Valores } from './campos'

type Opciones = {
  campos: Campo[]
  watch: UseFormWatch<Valores>
  setValue: UseFormSetValue<Valores>
  /** La unidad del artículo: la de la existencia al editar, la del campo en el alta. */
  unidad: string
  /**
   * La densidad cuando no está en el formulario. Al editar es un campo del
   * ARTÍCULO, se pinta bloqueado y no vive en el estado: llega de
   * `valores_existencia`. En el alta sí es un campo y se lee de ahí.
   */
  densidadFija?: unknown
}

/**
 * Al cambiar uno de los dos pesos del frasco, la cantidad se llena con «lleno
 * menos vacío». Es una sugerencia: se puede sobrescribir a mano.
 *
 * Solo reacciona a un cambio HECHO por quien captura —teclear o leer la
 * balanza—, nunca al abrir el formulario. Si al abrir la edición se
 * recalculara, un frasco cuyos pesos ya no cuadran con su saldo cambiaría de
 * cantidad sin que nadie tocara nada, y al guardar otra cosa se registraría un
 * ajuste de conteo que nadie pidió.
 *
 * Devuelve por qué no se pudo calcular, si es el caso, para pintarlo bajo la
 * cantidad: un campo que a veces se llena solo y a veces no, sin decir por qué,
 * se lee como una falla.
 */
export function useCantidadDesdePesos({ campos, watch, setValue, unidad, densidadFija }: Opciones) {
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const pesos = camposDePeso(campos)
    if (pesos === undefined) return

    const densidad = campoDeDensidad(campos)

    const suscripcion = watch((valores, { name, type }) => {
      // `type === 'change'` es el cambio que viene de un control —incluida la
      // balanza, que escribe por `field.onChange`—. Un `setValue` no lo trae,
      // y así el propio llenado de la cantidad no vuelve a entrar aquí.
      if (type !== 'change') return
      if (name !== pesos.lleno.campo && name !== pesos.vacio.campo) return

      const enFormulario = densidad === undefined ? undefined : valores[densidad.campo]
      const valorDensidad = typeof enFormulario === 'string' ? enFormulario : densidadFija

      const resultado = cantidadDesdePesos(
        texto(valores[pesos.lleno.campo]),
        texto(valores[pesos.vacio.campo]),
        unidad,
        texto(valorDensidad),
      )

      if (resultado === null) {
        setAviso(null)
        return
      }

      if (resultado.tipo === 'sin-calculo') {
        setAviso(resultado.razon)
        return
      }

      setAviso(null)
      setValue(pesos.cantidad.campo, resultado.cantidad, {
        shouldDirty: true,
        shouldValidate: true,
      })
    })

    return () => suscripcion.unsubscribe()
  }, [campos, watch, setValue, unidad, densidadFija])

  return aviso
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || typeof valor === 'boolean') return ''
  return String(valor)
}
