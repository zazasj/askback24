import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': r('./src'),
      '@shared': r('./shared'),
      '@data': r('./data'),
    },
  },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['shared/**/*.test.ts', 'api/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
