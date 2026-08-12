import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { mensajeDeArranque } from './arranque'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontro el elemento #root en index.html')

// La importacion es dinamica a proposito: si un modulo de arriba lanza al
// cargarse (por ejemplo supabase.ts sin variables de entorno), un import
// estatico revienta antes de que corra nada y la pantalla queda vacia.
import('./App')
  .then(({ default: App }) => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    rootElement.innerHTML = mensajeDeArranque(error)
    console.error(error)
  })
