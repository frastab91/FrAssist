import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Try to read backend port
let backendPort = 3001
try {
  const portFile = path.resolve(__dirname, '../backend/port.json')
  if (fs.existsSync(portFile)) {
    backendPort = JSON.parse(fs.readFileSync(portFile, 'utf-8')).port
  }
} catch (e) {
  console.error('Could not read backend port, defaulting to 3001')
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
      '/socket.io': {
        target: `http://127.0.0.1:${backendPort}`,
        ws: true,
      },
      '/screenshots': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      }
    }
  },
})
