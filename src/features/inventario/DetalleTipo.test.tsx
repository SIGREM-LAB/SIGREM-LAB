import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { DetalleTipo, type DatosTipo } from './DetalleTipo'

const VACIO: DatosTipo = {
  cas: null,
  estadoFisico: null,
  colorAlmacenaje: null,
  tieneHojaSeguridad: null,
  riesgoSalud: null,
  riesgoInflamabilidad: null,
  riesgoReactividad: null,
  numeroSerie: null,
  numeroInventario: null,
  funcionamiento: null,
  fechaChequeo: null,
  metodoConservacion: null,
  temperatura: null,
  origenEspecie: null,
}

describe('DetalleTipo', () => {
  test('un reactivo muestra el CAS y el rombo NFPA', () => {
    render(
      <DetalleTipo
        clasificacion="reactivo"
        datos={{
          ...VACIO,
          cas: '67-64-1',
          riesgoSalud: 2,
          riesgoInflamabilidad: 3,
          riesgoReactividad: 0,
        }}
      />,
    )

    expect(screen.getByText('67-64-1')).toBeInTheDocument()
    expect(screen.getByText(/salud/i)).toBeInTheDocument()
    expect(screen.getByText(/inflamabilidad/i)).toBeInTheDocument()
  })

  // Un riesgo 0 es un dato, no un hueco: significa "sin riesgo", y esconderlo
  // lo vuelve indistinguible de "no lo sabemos".
  test('un riesgo de grado 0 se muestra, no se esconde', () => {
    render(<DetalleTipo clasificacion="reactivo" datos={{ ...VACIO, riesgoReactividad: 0 }} />)
    expect(screen.getByText('0 de 4')).toBeInTheDocument()
  })

  // El formato pregunta "existencia de hoja de seguridad": si la tienes, no si
  // hace falta. Un false tiene que leerse como "no la tenemos", sin ambiguedad.
  test('dice cuando NO hay hoja de seguridad, en vez de callarse', () => {
    render(<DetalleTipo clasificacion="reactivo" datos={{ ...VACIO, tieneHojaSeguridad: false }} />)
    expect(screen.getByText(/sin hoja de seguridad/i)).toBeInTheDocument()
  })

  test('un equipo muestra la serie y el inventario UAEH', () => {
    render(
      <DetalleTipo
        clasificacion="equipo"
        datos={{ ...VACIO, numeroSerie: 'B417000341', numeroInventario: 'UAEH-9912' }}
      />,
    )

    expect(screen.getByText('B417000341')).toBeInTheDocument()
    expect(screen.getByText('UAEH-9912')).toBeInTheDocument()
  })

  test('un equipo con fallas lo dice en palabras', () => {
    render(
      <DetalleTipo clasificacion="equipo" datos={{ ...VACIO, funcionamiento: 'presenta_fallas' }} />,
    )
    expect(screen.getByText('Presenta fallas')).toBeInTheDocument()
  })

  test('la materia biologica muestra especie y conservacion', () => {
    render(
      <DetalleTipo
        clasificacion="materia_biologica"
        datos={{ ...VACIO, origenEspecie: 'Zea mays', metodoConservacion: 'Refrigeración' }}
      />,
    )

    expect(screen.getByText('Zea mays')).toBeInTheDocument()
    expect(screen.getByText('Refrigeración')).toBeInTheDocument()
  })

  // Material, insumo y componente no tienen campos propios: mejor nada que un
  // encabezado vacio.
  test('un material no pinta nada', () => {
    const { container } = render(<DetalleTipo clasificacion="material" datos={VACIO} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('un componente no pinta nada', () => {
    const { container } = render(<DetalleTipo clasificacion="componente" datos={VACIO} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('sin datos todavia no pinta nada', () => {
    const { container } = render(<DetalleTipo clasificacion="reactivo" datos={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  // Un reactivo del que no se capturo ningun dato normativo tampoco necesita
  // encabezado: seria un titulo sobre el vacio.
  test('un reactivo sin ningun dato capturado no pinta el encabezado', () => {
    const { container } = render(<DetalleTipo clasificacion="reactivo" datos={VACIO} />)
    expect(container).toBeEmptyDOMElement()
  })
})
