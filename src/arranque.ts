function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Si la app no llega ni a montar, el navegador queda en blanco -o en negro, si
 * el sistema esta en modo oscuro- y el motivo solo aparece en la consola. Esto
 * lo pone en la pantalla, con la instruccion para resolverlo.
 */
export function mensajeDeArranque(error: unknown): string {
  const detalle = escapar(error instanceof Error ? error.message : String(error))
  const faltaConfiguracion = detalle.includes('VITE_SUPABASE')

  const instrucciones = faltaConfiguracion
    ? `<ol>
         <li>Copia <code>.env.example</code> a <code>.env</code></li>
         <li>Arranca la base con <code>supabase start</code></li>
         <li>Copia los valores que imprime <code>supabase status -o env</code></li>
         <li>Reinicia <code>pnpm dev</code>: Vite lee el .env solo al arrancar</li>
       </ol>`
    : '<p>Revisa la consola del navegador para el detalle completo.</p>'

  return `<div style="font:16px/1.6 system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 1.5rem;color:#1A1416">
      <h1 style="font-size:1.4rem;margin:0 0 .5rem">SIGREM-LAB no pudo arrancar</h1>
      <p style="color:#6F6F6E;margin:0 0 1.25rem">${detalle}</p>
      ${instrucciones}
    </div>`
}
