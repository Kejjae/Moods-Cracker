import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/predict-': 'http://127.0.0.1:8000',
      '/webcam-session': 'http://127.0.0.1:8000',
      '/sessions': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    }
  }
})
