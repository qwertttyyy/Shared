import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  const config = { plugins: [react(), tailwindcss()] }
  if (command === 'build') return config

  const env = loadEnv(mode, '.', ['DEV_SERVER_PORT', 'API_PROXY_TARGET'])
  const apiTarget = new URL(env.API_PROXY_TARGET || 'http://localhost:8080')

  return {
    ...config,
    server: {
      port: Number(env.DEV_SERVER_PORT || '5173'),
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget.toString(),
          changeOrigin: true,
          ws: true,
          configure(proxy) {
            proxy.on('error', (_error, _request, response) => {
              if (!response || !('writeHead' in response) || response.headersSent || response.writableEnded) return

              response.writeHead(502, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store',
              })
              response.end(JSON.stringify({ error: `API недоступен. Проверьте, что сервер запущен по адресу ${apiTarget.origin}.` }))
            })
          },
        },
      },
    },
  }
})
