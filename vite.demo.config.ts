import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { novaPaletteSource, scopeNovaCss } from './scripts/scope-css.ts'
export default defineConfig({
  root: 'demo',
  base: './',
  plugins: [novaPaletteSource(), vue(), tailwindcss()],
  css: { postcss: { plugins: [scopeNovaCss()] } },
  build: { outDir: '../demo-dist', emptyOutDir: true },
})
