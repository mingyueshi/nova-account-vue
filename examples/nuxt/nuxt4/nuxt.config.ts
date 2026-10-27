export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: false },
  telemetry: false,
  css: ['nova-account/style.css'],
  app: { head: { htmlAttrs: { lang: 'zh-CN' }, title: 'Nova Nuxt integration' } },
})
