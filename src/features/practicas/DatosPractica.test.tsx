import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DatosPractica } from './DatosPractica'

const BASE = {
  programas: [
    { id: 1, nombre: 'Química en Alimentos' },
    { id: 2, nombre: 'Ingeniería en Biotecnología' },
  ],
  semestres: [1, 3, null],
  asignaturas: [{ id: 10, nombre: 'Bioquímica' }],
  practicas: [{ id: 100, numero: 2, nombre: 'Actividad enzimática' }],
  laboratorios: [{ id: 5, nombre: 'Laboratorio de docencia N3', almacenClave: 'N3' }],
  deshabilitado: false,
}

function montar(valores = {}, onCambiar = vi.fn()) {
  render(<DatosPractica {...BASE} valores={valores} onCambiar={onCambiar} />)
  return onCambiar
}

describe('DatosPractica', () => {
  test('sin programa elegido, los tres de abajo están apagados', () => {
    montar()

    expect(screen.getByLabelText('Semestre')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Asignatura')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Número de práctica')).toHaveAttribute('aria-disabled', 'true')
  })

  test('con programa y semestre, asignatura se enciende', () => {
    montar({ programaId: 1, semestre: 3 })

    expect(screen.getByLabelText('Asignatura')).not.toHaveAttribute('aria-disabled', 'true')
  })

  // Ésta es la que importa: sin ella queda una asignatura de un programa que ya
  // no está elegido, y la FK compuesta lo rechaza al finalizar.
  test('cambiar de programa limpia semestre, asignatura y práctica', async () => {
    const onCambiar = montar({
      programaId: 1,
      semestre: 3,
      asignaturaId: 10,
      practicaCatalogoId: 100,
    })

    await userEvent.click(screen.getByLabelText('Programa educativo'))
    await userEvent.click(screen.getByRole('option', { name: 'Ingeniería en Biotecnología' }))

    expect(onCambiar).toHaveBeenCalledWith({
      programaId: 2,
      semestre: undefined,
      asignaturaId: undefined,
      practicaCatalogoId: undefined,
    })
  })

  test('cambiar de semestre limpia asignatura y práctica, pero no el programa', async () => {
    const onCambiar = montar({
      programaId: 1,
      semestre: 3,
      asignaturaId: 10,
      practicaCatalogoId: 100,
    })

    await userEvent.click(screen.getByLabelText('Semestre'))
    await userEvent.click(screen.getByRole('option', { name: '1°' }))

    expect(onCambiar).toHaveBeenCalledWith({
      semestre: 1,
      asignaturaId: undefined,
      practicaCatalogoId: undefined,
    })
  })

  test('cambiar de asignatura limpia sólo la práctica', async () => {
    const onCambiar = montar({ programaId: 1, semestre: 3, practicaCatalogoId: 100 })

    await userEvent.click(screen.getByLabelText('Asignatura'))
    await userEvent.click(screen.getByRole('option', { name: 'Bioquímica' }))

    expect(onCambiar).toHaveBeenCalledWith({ asignaturaId: 10, practicaCatalogoId: undefined })
  })

  // null no es un hueco: es una optativa, que el plan de estudios sí contempla.
  test('el semestre nulo se ofrece como Optativa', async () => {
    montar({ programaId: 1 })

    await userEvent.click(screen.getByLabelText('Semestre'))

    expect(screen.getByRole('option', { name: 'Optativa' })).toBeInTheDocument()
  })

  test('la práctica se ofrece con su número y su nombre', async () => {
    montar({ programaId: 1, semestre: 3, asignaturaId: 10 })

    await userEvent.click(screen.getByLabelText('Número de práctica'))

    expect(
      screen.getByRole('option', { name: 'Práctica 2 — Actividad enzimática' }),
    ).toBeInTheDocument()
  })

  // El laboratorio NO depende de la cascada: sale del almacén de quien captura,
  // y de él sale el almacen_id de la práctica. No puede ser "Todas".
  test('el laboratorio se elige y no depende del programa', () => {
    montar()

    expect(screen.getByLabelText('Laboratorio')).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('el laboratorio dice de qué almacén es', async () => {
    montar()

    await userEvent.click(screen.getByLabelText('Laboratorio'))

    expect(
      screen.getByRole('option', { name: 'Laboratorio de docencia N3 · N3' }),
    ).toBeInTheDocument()
  })
})
