import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL ?? ''

  return {
    plugins: [react()],
    server: {
      allowedHosts: [
        'danica-ungross-destinee.ngrok-free.dev',
        '.ngrok-free.dev',
      ],
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
});
