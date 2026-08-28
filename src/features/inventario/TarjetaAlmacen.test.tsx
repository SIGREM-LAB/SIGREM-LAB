import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import { TarjetaAlmacen } from './TarjetaAlmacen'
import type { Portada } from './menu'
import { tema } from '@/tema'

function portada(cambios: Partial<Portada> = {}): Portada {
  return {
    clave: 'N3',
    nombre: 'Almacén Nivel 3',
    propio: true,
    total: 100,
    disponible: 80,
    stockBajo: 12,
    agotado: 5,
    contaminado: 2,
    mantenimiento: 1,
    ...cambios,
  }
}

/** Enseña lo que le llegó por el state, que es lo que no se ve en el href. */
function Destino() {
  const { state } = useLocation()
  const almacenId = (state as { almacenId?: unknown } | null)?.almacenId
  return <p>llegó almacén {almacenId === undefined ? 'ninguno' : String(almacenId)}</p>
}

function pintar(props: Partial<Parameters<typeof TarjetaAlmacen>[0]> = {}) {
  render(
    <ThemeProvider theme={tema}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TarjetaAlmacen portada={portada()} almacenId={7} {...props} />} />
          <Route path="/inventario" element={<Destino />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('TarjetaAlmacen', () => {
  test('muestra el total y el desglose por estado', () => {
    pintar()

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  // total no cuenta las bajas, y el desglose nombrado son tres de los cinco
  // estados vivos: lo que sobra tiene que quedar dicho, no escondido en la
  // barra como un tramo gris sin explicacion.
  test('lo que no cae en los tres estados nombrados se declara aparte', () => {
    pintar()
    expect(screen.getByText(/en otro estado/)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('el aviso suma lo que hay que atender', () => {
    pintar()
    // 12 con stock bajo + 5 agotadas + 1 en mantenimiento
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText(/existencias necesitan atención/)).toBeInTheDocument()
  })

  test('sin nada pendiente no se inventa un aviso', () => {
    pintar({ portada: portada({ stockBajo: 0, agotado: 0, mantenimiento: 0 }) })
    expect(screen.queryByText(/necesitan atención/)).not.toBeInTheDocument()
  })

  test('marca el almacen propio', () => {
    pintar()
    expect(screen.getByText('TU ALMACÉN')).toBeInTheDocument()
  })

  test('la suma de la Unidad no se marca como propia', () => {
    pintar({
      portada: portada({ clave: null, nombre: 'Unidad Central de Laboratorios', propio: false }),
      almacenId: null,
    })
    expect(screen.queryByText('TU ALMACÉN')).not.toBeInTheDocument()
  })

  // El enlace es lo que hace util a la tarjeta: sin el almacen en el state, el
  // inventario abre sin filtrar y la persona tiene que volver a elegirlo.
  test('el enlace lleva el almacen al inventario', async () => {
    pintar()

    await userEvent.click(screen.getByRole('link', { name: /ver inventario de N3/i }))

    expect(screen.getByText('llegó almacén 7')).toBeInTheDocument()
  })

  test('la suma de la Unidad abre el inventario sin filtrar', async () => {
    pintar({
      portada: portada({ clave: null, nombre: 'Unidad Central de Laboratorios', propio: false }),
      almacenId: null,
    })

    await userEvent.click(screen.getByRole('link', { name: /ver todo el inventario/i }))

    expect(screen.getByText('llegó almacén ninguno')).toBeInTheDocument()
  })

  // La captura llega en un hito posterior. Un boton que no hace nada es peor
  // que uno que dice por que.
  test('registrar movimiento sigue apagado', () => {
    pintar()
    expect(screen.getByRole('button', { name: /registrar movimiento/i })).toBeDisabled()
  })
})
