import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  // Загружаем env переменные
  const env = loadEnv(mode, process.cwd(), ['VITE_'])

  return {
    server: {
      host: '0.0.0.0',
      port: parseInt(env.VITE_PORT || 5173), // Используем порт из env
      proxy: {
        '/ollama': {
          target: 'http://localhost:11434',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ollama/, '')
        },
        '/api': {
          target: env.VITE_API_BASE,
          changeOrigin: true
        }
      }
    },
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    define: {
      'process.env': {},
      '__APP_ENV__': JSON.stringify(env)
    },
    optimizeDeps: {
      include: ['uuid']
    }
  }
})