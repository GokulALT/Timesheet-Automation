import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 127.0.0.1 (not "localhost") so the proxy can't resolve to ::1 and miss
      // an IPv4-only backend. Must match PORT in backend/.env.
      '/api': {
        target: 'http://127.0.0.1:3001',
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (err.code === 'ECONNREFUSED') {
              // Backend not up yet — return a clean 503 instead of crashing Vite's proxy
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Backend not ready' }))
              }
              return
            }
            console.error('[proxy]', err.message)
          })
        },
      }
    }
  }
})
