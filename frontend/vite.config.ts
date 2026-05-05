import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from 'frontend' directory
  const env = loadEnv(mode, process.cwd(), '');
  
  // Try to read backend port from env or port.json
  let backendPort = parseInt(env.VITE_BACKEND_PORT) || 3001
  
  try {
    const portFile = path.resolve(__dirname, '../backend/port.json')
    if (fs.existsSync(portFile) && !env.VITE_BACKEND_PORT) {
      backendPort = JSON.parse(fs.readFileSync(portFile, 'utf-8')).port
    }
  } catch (e) {
    if (!env.VITE_BACKEND_PORT) {
      console.error('Could not read backend port, defaulting to 3001')
    }
  }

  return {
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
        },
        '/audio': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        }
      }
    },
  }
})
