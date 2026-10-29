import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import dts from 'vite-plugin-dts'
import { scopeNovaCss } from './scripts/scope-css.ts'
export default defineConfig({
  plugins: [vue(), tailwindcss(), dts({ include: ['src'], entryRoot: 'src', bundleTypes: true })],
  css: { postcss: { plugins: [scopeNovaCss()] } },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'nova-account',
      cssFileName: 'nova-account',
    },
    rolldownOptions: { external: ['vue'] },
    sourcemap: true,
  },
})
