import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dos páginas: la app (index.html) y el modo presentación (presentacion.html).
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        presentacion: fileURLToPath(new URL('./presentacion.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  // Use the same LAN URL when testing the built app; stop dev before preview.
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
