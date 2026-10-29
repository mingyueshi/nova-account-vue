import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { scopeNovaCss } from './scripts/scope-css.ts'
export default defineConfig({
  root: 'demo',
  base: './',
  plugins: [vue(), tailwindcss()],
  css: { postcss: { plugins: [scopeNovaCss()] } },
  build: { outDir: '../demo-dist', emptyOutDir: true },
})
