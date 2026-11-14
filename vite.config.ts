import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import dts from 'vite-plugin-dts'
import { novaPaletteSource, scopeNovaCss } from './scripts/scope-css.ts'
export default defineConfig({
  plugins: [
    novaPaletteSource(),
    vue(),
    tailwindcss(),
    dts({ include: ['src'], entryRoot: 'src', bundleTypes: true }),
  ],
  css: { postcss: { plugins: [scopeNovaCss()] } },
  build: {
    lib: {
      entry: { index: 'src/index.ts', charts: 'src/charts.ts' },
      formats: ['es'],
      fileName: (_format, name) => (name === 'index' ? 'nova-account.js' : 'charts.js'),
      cssFileName: 'nova-account',
    },
    rolldownOptions: { external: ['vue', /^echarts\//] },
    sourcemap: true,
  },
})
