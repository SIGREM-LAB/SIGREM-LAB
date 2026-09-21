import { render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, test } from 'vitest'

import { CampoCaptura } from './CampoCaptura'
import type { Campo, Valores } from './campos'

function campo(parcial: Partial<Campo>): Campo {
  return {
    campo: 'x',
    etiqueta: 'X',
    tipo_dato: 'numero',
    destino: 'existencia.marca',
    opciones: null,
    ayuda: null,
    obligatorio: false,
    orden: 1,
    ...parcial,
  }
}

function Montaje({ el }: { el: Campo }) {
  const { control } = useForm<Valores>({ defaultValues: { [el.campo]: '' } })
  return <CampoCaptura campo={el} control={control} laboratorios={[]} unidad="g" />
}

describe('CampoCaptura — qué números llevan balanza', () => {
  test('los dos pesos del frasco', () => {
    render(<Montaje el={campo({ campo: 'peso_total', destino: 'existencia.peso_total' })} />)

    expect(screen.getByRole('button', { name: /leer balanza/i })).toBeInTheDocument()
  })

  test('la cantidad, que en los reactivos se pesa', () => {
    render(<Montaje el={campo({ campo: 'cantidad', destino: 'movimiento.carga_inicial' })} />)

    expect(screen.getByRole('button', { name: /leer balanza/i })).toBeInTheDocument()
  })

  // La densidad y los grados NFPA son números, pero una balanza ahí no dice
  // nada: ofrecer el botón sería invitar a escribir una masa donde va un 0-4.
  test('la densidad no', () => {
    render(<Montaje el={campo({ campo: 'densidad', destino: 'articulo_reactivo.densidad' })} />)

    expect(screen.queryByRole('button', { name: /leer balanza/i })).not.toBeInTheDocument()
  })

  test('el riesgo NFPA tampoco', () => {
    render(
      <Montaje el={campo({ campo: 'riesgo_salud', destino: 'articulo_reactivo.riesgo_salud' })} />,
    )

    expect(screen.queryByRole('button', { name: /leer balanza/i })).not.toBeInTheDocument()
  })
})
