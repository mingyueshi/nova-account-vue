import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/index.ts', 'src/locales.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      thresholds: {
        lines: 90,
        statements: 85,
        functions: 70,
        branches: 75,
        'src/composables/**': { lines: 95, statements: 90, functions: 85, branches: 80 },
        'src/components/NovaCaptcha.vue': {
          lines: 95,
          statements: 95,
          functions: 90,
          branches: 85,
        },
        'src/components/NovaAuthForm.vue': {
          lines: 90,
          statements: 90,
          functions: 75,
          branches: 85,
        },
      },
    },
  },
})
