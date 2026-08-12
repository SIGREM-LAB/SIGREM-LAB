/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // src/lib/supabase.ts falla al importarse sin estas variables, y esa
    // validacion es deliberada. Las pruebas inyectan un doble del cliente;
    // estos valores solo existen para que el modulo cargue.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'llave-de-prueba',
    },
    // referencia/ es el prototipo de diseno: no se compila ni se prueba.
    exclude: ['node_modules', 'dist', 'referencia'],
  },
})
