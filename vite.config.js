import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
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
    // Решаем проблему с process is not defined
    'process.env': {},
    // Альтернативный вариант, если нужно передать конкретные переменные
    // 'process.env': {
    //   NODE_ENV: JSON.stringify(process.env.NODE_ENV)
    // }
  },
  optimizeDeps: {
    include: ['uuid'],
    exclude: ['@llama-node/core'] // Исключаем проблемные зависимости, если есть
  }
})