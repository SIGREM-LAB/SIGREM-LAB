import { describe, expect, test } from 'vitest'

import { mensajeDeArranque } from './arranque'

describe('mensajeDeArranque', () => {
  // Si supabase.ts lanza por falta de variables, React nunca monta y el
  // navegador queda en blanco (o en negro, si el sistema esta en modo oscuro).
  // Un mensaje en pantalla ahorra media hora de buscar en la consola.
  test('dice que falta el .env cuando ese es el problema', () => {
    const html = mensajeDeArranque(
      new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y rellenalos.'),
    )

    expect(html).toContain('.env.example')
    expect(html).toContain('supabase status')
  })

  test('muestra el error tal cual cuando es cualquier otro', () => {
    const html = mensajeDeArranque(new Error('Algo raro exploto'))

    expect(html).toContain('Algo raro exploto')
  })

  test('escapa el contenido para no inyectar HTML', () => {
    const html = mensajeDeArranque(new Error('<img src=x onerror=alert(1)>'))

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  // Corre fuera de React y sin tema: si solo fijara el color del texto, con el
  // sistema en oscuro el navegador pintaria el fondo oscuro y quedaria texto
  // casi negro sobre negro. Justo la pantalla que no puede fallar.
  test('fija su propio fondo, no solo el color del texto', () => {
    const html = mensajeDeArranque(new Error('Algo raro exploto'))

    expect(html).toContain('background:#F5F6F8')
    expect(html).toContain('color:#202226')
  })
})
