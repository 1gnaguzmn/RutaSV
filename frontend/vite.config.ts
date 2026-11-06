import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
