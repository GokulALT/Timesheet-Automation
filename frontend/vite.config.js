import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 127.0.0.1 (not "localhost") so the proxy can't resolve to ::1 and miss
      // an IPv4-only backend. Must match PORT in backend/.env.
      '/api': 'http://127.0.0.1:3001'
    }
  }
})
